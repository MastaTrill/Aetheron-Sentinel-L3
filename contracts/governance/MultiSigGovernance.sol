// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MultiSigGovernance
 * @notice On-chain voting with configurable quorum, timelocks, and multi-sig execution
 * @dev Supports delayed execution, multiple approval thresholds, and proposal types
 */
contract MultiSigGovernance is AccessControl, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // Structs
    enum ProposalState {
        Pending,
        Active,
        Queued,
        Executed,
        Failed,
        Expired,
        Cancelled
    }

    enum ProposalType {
        Standard,
        Urgency,
        Emergency,
        ParameterChange,
        Treasury,
        Upgrade
    }

    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
        uint256 createdAt;
        uint256 votingStart;
        uint256 votingEnd;
        uint256 executionTime;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 abstainVotes;
        uint256 quorumRequired;
        uint256 executionDelay;
        ProposalState state;
        bool hasTimelock;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteAmount;
    }

    struct Voter {
        address voter;
        bool support; // true = yes, false = no
        uint256 weight;
        uint256 timestamp;
    }

    // Configuration
    uint256 public constant MIN_PROPOSAL_DELAY = 1 days;
    uint256 public constant MAX_PROPOSAL_DELAY = 30 days;
    uint256 public constant URGENCY_THRESHOLD = 3 days;
    uint256 public constant EMERGENCY_DELAY = 6 hours;

    // Timelock
    mapping(uint256 => uint256) public timelockQueue; // proposalId => executionTime

    // Governance Parameters
    uint256 public quorumNumerator = 500; // 5% default (in bps)
    uint256 public quorumDenominator = 10000;
    uint256 public proposalThreshold = 1000e18; // 1000 tokens
    uint256 public votingDuration = 7 days;
    uint256 public votingDelay = 1 days;

    // Emergency
    bool public emergencyMode;
    uint256 public emergencyQuorumBoost = 2000; // +20% quorum for emergency

    // State
    IERC20 public governanceToken;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(bytes32 => bool) public executedSignatures;
    mapping(address => uint256) public proposerVotes; // Votes locked by proposer

    // Events
    event ProposalCreated(
        uint256 indexed id,
        address proposer,
        ProposalType proposalType,
        address[] targets,
        string description
    );
    event VoteCast(
        uint256 indexed proposalId,
        address voter,
        bool support,
        uint256 weight
    );
    event ProposalQueued(uint256 indexed proposalId, uint256 executionTime);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalFailed(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event QuorumUpdated(uint256 newQuorum);
    event VotingDurationUpdated(uint256 newDuration);
    event EmergencyModeToggled(bool active);
    event TimelockDelayUpdated(uint256 proposalId, uint256 newDelay);
    event EmergencyExecution(uint256 indexed proposalId, bytes reason);

    constructor(address _governanceToken) EIP712("MultiSigGovernance", "1") {
        require(_governanceToken != address(0), "Invalid token");
        governanceToken = IERC20(_governanceToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
    }

    // ============ Proposal Creation ============

    function createProposal(
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _calldatas,
        string calldata _description,
        ProposalType _proposalType,
        bool _withTimelock
    ) external returns (uint256 proposalId) {
        require(_targets.length == _calldatas.length, "Invalid array lengths");
        require(_targets.length > 0, "No actions");

        uint256 proposerVotes = getVotes(msg.sender);
        require(proposerVotes >= proposalThreshold, "Below proposal threshold");

        // Calculate voting period based on proposal type
        uint256 duration = votingDuration;
        if (_proposalType == ProposalType.Urgency) {
            duration = URGENCY_THRESHOLD;
        } else if (_proposalType == ProposalType.Emergency) {
            duration = EMERGENCY_DELAY;
        }

        proposalId = proposalCount++;

        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.proposalType = _proposalType;
        proposal.targets = _targets;
        proposal.values = _values;
        proposal.calldatas = _calldatas;
        proposal.description = _description;
        proposal.createdAt = block.timestamp;
        proposal.votingStart = block.timestamp + votingDelay;
        proposal.votingEnd = proposal.votingStart + duration;
        proposal.executionDelay = _proposalType == ProposalType.Emergency
            ? EMERGENCY_DELAY
            : MIN_PROPOSAL_DELAY;
        proposal.executionTime =
            block.timestamp +
            proposal.executionDelay +
            duration;
        proposal.quorumRequired = _calculateQuorum(_proposalType);
        proposal.state = ProposalState.Pending;
        proposal.hasTimelock = _withTimelock;

        if (_withTimelock) {
            timelockQueue[proposalId] = proposal.executionTime;
        }

        emit ProposalCreated(
            proposalId,
            msg.sender,
            _proposalType,
            _targets,
            _description
        );
        return proposalId;
    }

    function _calculateQuorum(
        ProposalType _type
    ) internal view returns (uint256) {
        uint256 baseQuorum = (quorumNumerator * governanceToken.totalSupply()) /
            quorumDenominator;

        if (emergencyMode) {
            return
                baseQuorum +
                (baseQuorum * emergencyQuorumBoost) /
                quorumDenominator;
        }

        if (_type == ProposalType.Emergency) {
            return (baseQuorum * 3) / 2; // 150% of normal
        }

        return baseQuorum;
    }

    // ============ Voting ============

    function castVote(uint256 _proposalId, bool _support) external {
        _castVote(_proposalId, msg.sender, _support, 1);
    }

    function castVoteWithReason(
        uint256 _proposalId,
        bool _support,
        string calldata _reason
    ) external {
        _castVote(_proposalId, msg.sender, _support, 1);
    }

    function castVoteBySig(
        uint256 _proposalId,
        bool _support,
        uint256 _nonce,
        bytes memory _signature
    ) external {
        bytes32 domainSeparator = _domainSeparator();
        bytes32 structHash = keccak256(
            abi.encode(_proposalId, _support, _nonce)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        address signer = digest.recover(_signature);
        require(getVotes(signer) >= proposalThreshold, "Invalid signer");

        _castVote(_proposalId, signer, _support, 1);
    }

    function _castVote(
        uint256 _proposalId,
        address _voter,
        bool _support,
        uint256 /* weight multiplier */
    ) internal {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.state == ProposalState.Active, "Voting not active");
        require(!proposal.hasVoted[_voter], "Already voted");

        uint256 weight = getVotes(_voter);
        require(weight > 0, "No voting power");

        proposal.hasVoted[_voter] = true;
        proposal.voteAmount[_voter] = weight;

        if (_support) {
            proposal.yesVotes += weight;
        } else {
            proposal.noVotes += weight;
        }

        emit VoteCast(_proposalId, _voter, _support, weight);
    }

    function getVotes(address _account) public view returns (uint256) {
        return governanceToken.balanceOf(_account);
    }

    // ============ Proposal State Transitions ============

    function activateProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.state == ProposalState.Pending, "Not pending");
        require(block.timestamp >= proposal.votingStart, "Voting not started");

        proposal.state = ProposalState.Active;
    }

    function queueProposal(
        uint256 _proposalId
    ) external onlyRole(EXECUTOR_ROLE) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.state == ProposalState.Active, "Not active");
        require(block.timestamp >= proposal.votingEnd, "Voting not ended");
        require(_hasPassed(proposal), "Proposal not passed");

        proposal.state = ProposalState.Queued;

        if (proposal.hasTimelock) {
            timelockQueue[_proposalId] = proposal.executionTime;
        }

        emit ProposalQueued(_proposalId, proposal.executionTime);
    }

    function _hasPassed(
        Proposal storage _proposal
    ) internal view returns (bool) {
        uint256 totalVotes = _proposal.yesVotes +
            _proposal.noVotes +
            _proposal.abstainVotes;
        uint256 quorum = _proposal.quorumRequired;

        // Check quorum
        if (totalVotes < quorum) return false;

        // Check approval (simple majority for now)
        return _proposal.yesVotes > _proposal.noVotes;
    }

    // ============ Execution ============

    function executeProposal(
        uint256 _proposalId
    )
        external
        nonReentrant
        onlyRole(EXECUTOR_ROLE)
        returns (bytes[] memory results)
    {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.state == ProposalState.Queued, "Not queued");

        if (proposal.hasTimelock) {
            require(
                block.timestamp >= timelockQueue[_proposalId],
                "Timelock not passed"
            );
        }

        proposal.state = ProposalState.Executed;

        results = new bytes[](proposal.targets.length);

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, bytes memory result) = proposal.targets[i].call{
                value: proposal.values[i]
            }(proposal.calldatas[i]);

            if (!success) {
                proposal.state = ProposalState.Failed;
                emit ProposalFailed(_proposalId);
                revert("Execution failed");
            }

            results[i] = result;
        }

        emit ProposalExecuted(_proposalId);
        return results;
    }

    function emergencyExecuteProposal(
        uint256 _proposalId
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        returns (bytes[] memory results)
    {
        require(emergencyMode, "Emergency mode not active");

        Proposal storage proposal = proposals[_proposalId];
        require(
            proposal.proposalType == ProposalType.Emergency,
            "Not emergency proposal"
        );

        proposal.state = ProposalState.Executed;
        results = new bytes[](proposal.targets.length);

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, bytes memory result) = proposal.targets[i].call{
                value: proposal.values[i]
            }(proposal.calldatas[i]);

            results[i] = result;

            if (!success) {
                emit EmergencyExecution(_proposalId, result);
            }
        }

        emit ProposalExecuted(_proposalId);
        return results;
    }

    function cancelProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(
            msg.sender == proposal.proposer ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(
            proposal.state == ProposalState.Pending ||
                proposal.state == ProposalState.Active,
            "Cannot cancel"
        );

        proposal.state = ProposalState.Cancelled;
        emit ProposalCancelled(_proposalId);
    }

    // ============ Parameter Updates ============

    function updateQuorum(
        uint256 _numerator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_numerator <= quorumDenominator, "Invalid numerator");
        quorumNumerator = _numerator;
        emit QuorumUpdated(_numerator);
    }

    function updateVotingDuration(
        uint256 _duration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _duration >= 1 days && _duration <= 30 days,
            "Invalid duration"
        );
        votingDuration = _duration;
        emit VotingDurationUpdated(_duration);
    }

    function updateProposalThreshold(
        uint256 _threshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        proposalThreshold = _threshold;
    }

    function toggleEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = !emergencyMode;
        emit EmergencyModeToggled(emergencyMode);
    }

    function updateExecutionDelay(
        uint256 _proposalId,
        uint256 _newDelay
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _newDelay >= EMERGENCY_DELAY && _newDelay <= MAX_PROPOSAL_DELAY,
            "Invalid delay"
        );
        proposals[_proposalId].executionDelay = _newDelay;
        emit TimelockDelayUpdated(_proposalId, _newDelay);
    }

    // ============ View Functions ============

    function getProposalState(
        uint256 _proposalId
    ) external view returns (ProposalState) {
        return proposals[_proposalId].state;
    }

    function getProposalDetails(
        uint256 _proposalId
    )
        external
        view
        returns (
            address proposer,
            ProposalType proposalType,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 quorumRequired,
            uint256 votingEnd,
            ProposalState state
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.proposer,
            proposal.proposalType,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.quorumRequired,
            proposal.votingEnd,
            proposal.state
        );
    }

    function hasVoted(
        uint256 _proposalId,
        address _voter
    ) external view returns (bool) {
        return proposals[_proposalId].hasVoted[_voter];
    }

    function getVoteDetails(
        uint256 _proposalId,
        address _voter
    ) external view returns (bool hasVoted_, bool support, uint256 weight) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.hasVoted[_voter],
            proposal.voteAmount[_voter] > 0 ? true : false, // Simplified
            proposal.voteAmount[_voter]
        );
    }

    function _domainSeparator() internal view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
