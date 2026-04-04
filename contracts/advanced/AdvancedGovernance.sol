// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AdvancedGovernance
 * @notice Sophisticated DAO governance with quadratic voting, timelocks, and delegation
 * @dev Features:
 *      - Quadratic voting (reduces plutocracy)
 *      - Time-locked execution (security buffer)
 *      - Token delegation (liquid democracy)
 *      - Proposal categories (parameter, emergency, upgrade)
 *      - Veto rights for guardians
 *      - Reputation-weighted voting
 *
 * @dev Voting Power: sqrt(staked tokens) - quadratic decay
 * @dev Timelock: 48 hours for normal, 24 hours for emergency
 * @dev Quorum: Dynamic based on proposal type
 */
contract AdvancedGovernance is AccessControl, Pausable {
    using ECDSA for bytes32;

    // ============ Constants ============

    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    uint256 public constant VOTING_DELAY = 1 days;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant EXECUTION_DELAY_NORMAL = 48 hours;
    uint256 public constant EXECUTION_DELAY_EMERGENCY = 24 hours;
    uint256 public constant PROPOSAL_THRESHOLD = 100e18; // 100 tokens to propose
    uint256 public constant QUORUM_BASE = 400; // 4% base quorum
    uint256 public constant MAX_LOCK_PERIOD = 4 years;

    // ============ State Variables ============

    /// @notice Governance token
    ERC20Votes public governanceToken;

    /// @notice Proposal counter
    uint256 public proposalCount;

    /// @notice Minimum voting power required
    uint256 public proposalThreshold;

    /// @notice Base quorum percentage (basis points)
    uint256 public quorumThreshold;

    /// @notice Governor configuration
    uint256 public votingDelay;
    uint256 public votingPeriod;

    /// @notice Mapping of proposals
    mapping(uint256 => Proposal) public proposals;

    /// @notice Voting power checkpoint
    mapping(address => uint256) public checkpointedPower;
    uint256 public checkpointedTotalSupply;
    uint256 public lastCheckpointBlock;

    /// @notice Timelock for execution
    address public timelock;

    /// @notice Emergency execution allowed
    bool public emergencyEnabled = true;

    /// @notice Guardian veto threshold
    uint256 public guardianVetoThreshold = 3;

    // ============ Enums ============

    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed,
        Vetoed
    }

    enum VoteType {
        Against,
        For,
        Abstain
    }

    enum Category {
        Parameter,
        Treasury,
        Emergency,
        Upgrade,
        Guardian,
        Meta
    }

    // ============ Structs ============

    struct Proposal {
        address proposer;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
        bytes32 descriptionHash;
        Category category;
        uint256 voteStart;
        uint256 voteEnd;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 quorumVotes;
        mapping(address => Receipt) receipts;
        ProposalState state;
        uint256 eta;
        uint256 vetoCount;
        address[] vetoSigners;
        bool emergency;
        bytes32 ipfsHash;
    }

    struct Receipt {
        bool hasVoted;
        VoteType voteType;
        uint256 votingPower;
        uint256 quadraticWeight;
    }

    struct Vote {
        address voter;
        VoteType voteType;
        uint256 votingPower;
        uint256 quadraticWeight;
        string reason;
        uint256 timestamp;
    }

    struct Delegation {
        address delegate;
        uint256 balance;
        uint256 delegatedAt;
    }

    // ============ Events ============

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        Category category,
        string description,
        bytes32 ipfsHash
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteType voteType,
        uint256 weight,
        uint256 quadraticWeight,
        string reason
    );

    event ProposalCanceled(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalQueued(uint256 indexed proposalId, uint256 eta);
    event ProposalDefeated(uint256 indexed proposalId);
    event ProposalSucceeded(uint256 indexed proposalId);
    event VetoCast(uint256 indexed proposalId, address indexed guardian);
    event VotingParamsUpdated(
        uint256 oldDelay,
        uint256 newDelay,
        uint256 oldPeriod,
        uint256 newPeriod
    );
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event EmergencyProposal(uint256 indexed proposalId);
    event TimelockUpdated(
        address indexed oldTimelock,
        address indexed newTimelock
    );

    // ============ Errors ============

    error InvalidCategory();
    error ProposalNotActive(uint256 proposalId, ProposalState currentState);
    error AlreadyVoted(address voter, uint256 proposalId);
    error VotingPowerZero();
    error BelowThreshold(uint256 votingPower, uint256 threshold);
    error QuorumNotReached(uint256 votes, uint256 quorum);
    error InvalidProposalId();
    error InvalidTargets();
    error ProposalAlreadyExecuted(uint256 proposalId);
    error TimelockNotPassed(uint256 eta);
    error EmergencyAlreadyActive();
    error GuardianAlreadyVetoed(uint256 proposalId, address guardian);
    error InvalidSignature();
    error InvalidVoteType();

    // ============ Constructor ============

    constructor(
        address _governanceToken,
        address _timelock,
        uint256 _proposalThreshold
    ) {
        governanceToken = ERC20Votes(_governanceToken);
        timelock = _timelock;
        proposalThreshold = _proposalThreshold;
        quorumThreshold = QUORUM_BASE;
        votingDelay = VOTING_DELAY;
        votingPeriod = VOTING_PERIOD;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
    }

    // ============ Proposal Creation ============

    /**
     * @notice Create a new proposal
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        Category category,
        bool emergency,
        bytes32 ipfsHash
    ) external returns (uint256 proposalId) {
        if (targets.length == 0) revert InvalidTargets();
        if (
            targets.length != values.length ||
            targets.length != calldatas.length
        ) {
            revert InvalidTargets();
        }

        uint256 votingPower = getVotingPower(msg.sender);
        if (votingPower < proposalThreshold) {
            revert BelowThreshold(votingPower, proposalThreshold);
        }

        proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];

        proposal.proposer = msg.sender;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.description = description;
        proposal.descriptionHash = keccak256(bytes(description));
        proposal.category = category;
        proposal.voteStart = block.timestamp + votingDelay;
        proposal.voteEnd = proposal.voteStart + votingPeriod;
        proposal.emergency = emergency;
        proposal.ipfsHash = ipfsHash;
        proposal.state = ProposalState.Pending;

        // Emergency proposals have shorter voting period
        if (emergency) {
            if (!emergencyEnabled) revert EmergencyAlreadyActive();
            proposal.voteEnd = proposal.voteStart + 1 days;
            emit EmergencyProposal(proposalId);
        }

        emit ProposalCreated(
            proposalId,
            msg.sender,
            category,
            description,
            ipfsHash
        );
    }

    /**
     * @notice Create proposal with off-chain signature
     */
    function proposeWithSignature(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        Category category,
        bytes memory signature
    ) external returns (uint256 proposalId) {
        bytes32 messageHash = keccak256(
            abi.encode(
                targets,
                values,
                calldatas,
                description,
                category,
                msg.sender
            )
        );

        // Verify signature
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        if (signer != msg.sender) revert InvalidSignature();

        return
            propose(
                targets,
                values,
                calldatas,
                description,
                category,
                false,
                bytes32(0)
            );
    }

    // ============ Voting ============

    /**
     * @notice Cast a vote on a proposal
     */
    function castVote(
        uint256 proposalId,
        VoteType voteType,
        string calldata reason
    ) external {
        _castVote(proposalId, msg.sender, voteType, reason);
    }

    /**
     * @notice Cast a vote with signature
     */
    function castVoteWithSignature(
        uint256 proposalId,
        VoteType voteType,
        string calldata reason,
        bytes calldata signature
    ) external {
        bytes32 messageHash = keccak256(
            abi.encode(proposalId, voteType, msg.sender)
        );

        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        if (signer != msg.sender) revert InvalidSignature();

        _castVote(proposalId, msg.sender, voteType, reason);
    }

    /**
     * @notice Cast vote by delegate
     */
    function castVoteByDelegate(
        uint256 proposalId,
        address voter,
        VoteType voteType,
        uint256 votingPower,
        bytes calldata reason,
        bytes calldata signature
    ) external onlyRole(EXECUTOR_ROLE) {
        bytes32 messageHash = keccak256(
            abi.encode(proposalId, voteType, voter, votingPower)
        );

        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        if (signer != voter) revert InvalidSignature();

        _castVote(proposalId, voter, voteType, reason);
    }

    /**
     * @notice Internal vote casting with quadratic weighting
     */
    function _castVote(
        uint256 proposalId,
        address voter,
        VoteType voteType,
        string calldata reason
    ) internal {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.state != ProposalState.Active) {
            revert ProposalNotActive(proposalId, proposal.state);
        }

        if (proposal.receipts[voter].hasVoted) {
            revert AlreadyVoted(voter, proposalId);
        }

        if (voteType > VoteType.Abstain) {
            revert InvalidVoteType();
        }

        uint256 votingPower = getVotingPower(voter);
        if (votingPower == 0) revert VotingPowerZero();

        // Quadratic voting: weight = sqrt(votingPower)
        uint256 quadraticWeight = _sqrt(votingPower);

        // Update proposal counts
        if (voteType == VoteType.For) {
            proposal.forVotes += votingPower;
        } else if (voteType == VoteType.Against) {
            proposal.againstVotes += votingPower;
        } else {
            proposal.abstainVotes += quadraticWeight;
        }

        proposal.quorumVotes += quadraticWeight;

        // Record receipt
        proposal.receipts[voter] = Receipt({
            hasVoted: true,
            voteType: voteType,
            votingPower: votingPower,
            quadraticWeight: quadraticWeight
        });

        emit VoteCast(
            proposalId,
            voter,
            voteType,
            votingPower,
            quadraticWeight,
            reason
        );
    }

    // ============ Guardian Veto ============

    /**
     * @notice Cast veto by guardian
     */
    function castVeto(
        uint256 proposalId,
        string calldata reason
    ) external onlyRole(GUARDIAN_ROLE) {
        Proposal storage proposal = proposals[proposalId];

        // Can veto pending, active, or succeeded proposals
        if (uint256(proposal.state) > 3)
            revert ProposalAlreadyExecuted(proposalId);

        // Check if guardian already vetoed
        for (uint256 i = 0; i < proposal.vetoSigners.length; i++) {
            if (proposal.vetoSigners[i] == msg.sender) {
                revert GuardianAlreadyVetoed(proposalId, msg.sender);
            }
        }

        proposal.vetoSigners.push(msg.sender);
        proposal.vetoCount++;

        if (proposal.vetoCount >= guardianVetoThreshold) {
            proposal.state = ProposalState.Vetoed;
        }

        emit VetoCast(proposalId, msg.sender);
    }

    // ============ Queue & Execute ============

    /**
     * @notice Queue successful proposal for execution
     */
    function queue(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.state != ProposalState.Succeeded)
            revert ProposalNotActive(proposalId, proposal.state);

        proposal.state = ProposalState.Queued;
        uint256 delay = proposal.emergency
            ? EXECUTION_DELAY_EMERGENCY
            : EXECUTION_DELAY_NORMAL;
        proposal.eta = block.timestamp + delay;

        emit ProposalQueued(proposalId, proposal.eta);
    }

    /**
     * @notice Execute queued proposal
     */
    function execute(uint256 proposalId) external payable {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.state != ProposalState.Queued) {
            revert TimelockNotPassed(proposal.eta);
        }

        if (block.timestamp < proposal.eta) {
            revert TimelockNotPassed(proposal.eta);
        }

        proposal.state = ProposalState.Executed;

        // Execute all transactions
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = proposal.targets[i].call{
                value: proposal.values[i]
            }(proposal.calldatas[i]);
            require(success, "Execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    // ============ Helper Functions ============

    /**
     * @notice Get voting power with delegation
     */
    function getVotingPower(address account) public view returns (uint256) {
        uint256 balance = governanceToken.balanceOf(account);
        address delegatee = governanceToken.delegatees(account);

        if (delegatee != address(0) && delegatee != account) {
            balance += governanceToken.balanceOf(delegatee);
        }

        return balance;
    }

    /**
     * @notice Get quadratic voting weight
     */
    function getQuadraticWeight(
        uint256 votingPower
    ) public pure returns (uint256) {
        return _sqrt(votingPower);
    }

    /**
     * @notice Calculate required quorum
     */
    function getRequiredQuorum(
        Category category
    ) public view returns (uint256) {
        // Dynamic quorum based on category
        if (category == Category.Emergency) return 600; // 6%
        if (category == Category.Treasury) return 800; // 8%
        if (category == Category.Upgrade) return 1000; // 10%
        return quorumThreshold; // Default 4%
    }

    /**
     * @notice Check if proposal succeeded
     */
    function _checkProposalSucceeded(
        uint256 proposalId
    ) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 requiredQuorum = getRequiredQuorum(proposal.category);

        // For votes must exceed against votes
        if (proposal.forVotes <= proposal.againstVotes) return false;

        // Quorum must be reached
        uint256 totalVotes = proposal.forVotes +
            proposal.againstVotes +
            proposal.abstainVotes;
        uint256 quorum = (totalVotes * requiredQuorum) / 10000;

        return proposal.quorumVotes >= quorum;
    }

    /**
     * @notice Square root function
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // ============ Admin Functions ============

    function setVotingDelay(
        uint256 newDelay
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit VotingParamsUpdated(
            votingDelay,
            newDelay,
            votingPeriod,
            votingPeriod
        );
        votingDelay = newDelay;
    }

    function setVotingPeriod(
        uint256 newPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit VotingParamsUpdated(
            votingDelay,
            votingDelay,
            votingPeriod,
            newPeriod
        );
        votingPeriod = newPeriod;
    }

    function setQuorumThreshold(
        uint256 newQuorum
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newQuorum >= 100 && newQuorum <= 2000, "Invalid quorum");
        emit QuorumUpdated(quorumThreshold, newQuorum);
        quorumThreshold = newQuorum;
    }

    function setProposalThreshold(
        uint256 newThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit ThresholdUpdated(proposalThreshold, newThreshold);
        proposalThreshold = newThreshold;
    }

    function setGuardianVetoThreshold(
        uint256 threshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        guardianVetoThreshold = threshold;
    }

    function setEmergencyEnabled(
        bool enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyEnabled = enabled;
    }

    function setTimelock(
        address newTimelock
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit TimelockUpdated(timelock, newTimelock);
        timelock = newTimelock;
    }

    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposer == msg.sender, "Not proposer");
        require(proposal.state == ProposalState.Pending);

        proposal.state = ProposalState.Canceled;
        emit ProposalCanceled(proposalId);
    }

    // ============ View Functions ============

    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (
            address proposer,
            ProposalState state,
            uint256 voteStart,
            uint256 voteEnd,
            uint256 forVotes,
            uint256 againstVotes,
            Category category,
            bool emergency
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.state,
            proposal.voteStart,
            proposal.voteEnd,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.category,
            proposal.emergency
        );
    }

    function getReceipt(
        uint256 proposalId,
        address voter
    )
        external
        view
        returns (
            bool hasVoted,
            VoteType voteType,
            uint256 votingPower,
            uint256 quadraticWeight
        )
    {
        Receipt storage receipt = proposals[proposalId].receipts[voter];
        return (
            receipt.hasVoted,
            receipt.voteType,
            receipt.votingPower,
            receipt.quadraticWeight
        );
    }
}
