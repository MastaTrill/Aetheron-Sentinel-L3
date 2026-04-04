// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CrossChainGovernance
 * @notice Unified voting across L2s with cross-chain message passing
 * @dev Coordinates governance across multiple chains with unified voting power
 */
contract CrossChainGovernance is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant CHAIN_REGISTRAR_ROLE =
        keccak256("CHAIN_REGISTRAR_ROLE");

    // Structs
    struct Chain {
        uint256 chainId;
        string name;
        address bridgeAddress;
        address messengerAddress;
        bool isActive;
        uint256 lastMessageTime;
        uint256 messageCount;
        bytes32 latestProposalHash;
    }

    struct CrossChainProposal {
        uint256 proposalId;
        address proposer;
        string title;
        string description;
        bytes32 contentHash;
        uint256 votingPowerRequired;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 abstainVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 crossChainVotes;
        uint256[] chainVoteCounts;
        ProposalStatus status;
        ProposalType proposalType;
        bytes[] executedCalls;
        bool executed;
    }

    enum ProposalStatus {
        Pending,
        Active,
        Queued,
        Executed,
        Defeated,
        Expired,
        Cancelled
    }

    enum ProposalType {
        ParameterChange,
        Treasury,
        Upgrade,
        Emergency,
        MemberAddition,
        MemberRemoval,
        BridgeUpdate,
        CrossChainMessage
    }

    struct ChainVote {
        uint256 chainId;
        address voter;
        bool support;
        uint256 weight;
        uint256 timestamp;
        bytes32 voteHash;
    }

    struct VoterWeight {
        address voter;
        uint256 totalWeight;
        uint256 nativeWeight;
        mapping(uint256 => uint256) chainWeights;
        uint256 lastVoteTime;
        bool isActive;
    }

    struct BridgeConfig {
        address bridge;
        uint256 chainId;
        uint256 messageGasLimit;
        uint256 confirmationBlocks;
        uint256 relayerReward;
        bool isActive;
    }

    struct Message {
        bytes32 messageId;
        uint256 sourceChain;
        uint256 destChain;
        address sender;
        bytes payload;
        uint256 timestamp;
        MessageType messageType;
        bool processed;
        bytes32 hash;
    }

    enum MessageType {
        VoteSubmission,
        ProposalCreated,
        ProposalExecuted,
        WeightSync,
        EmergencyAction,
        ParameterUpdate
    }

    // State
    IERC20 public immutable GOVERNANCE_TOKEN;
    uint256 public proposalCount;
    uint256 public chainCount;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Mappings
    mapping(uint256 => Chain) public chains;
    mapping(bytes32 => ChainVote[]) public chainVotes;
    mapping(address => VoterWeight) public voterWeights;
    mapping(uint256 => CrossChainProposal) public proposals;
    mapping(address => uint256[]) public voterProposals;
    mapping(bytes32 => Message) public messages;
    mapping(bytes32 => bool) public processedMessages;

    // Cross-chain tracking
    mapping(uint256 => bytes32[]) public chainMessageHistory;
    mapping(bytes32 => uint256[]) public messageVotes;

    // Configuration
    uint256 public votingPeriod = 7 days;
    uint256 public crossChainVotingDelay = 24 hours;
    uint256 public quorumNumerator = 400; // 4%
    uint256 public quorumDenominator = 10000;
    uint256 public proposalThreshold = 100e18;
    uint256 public emergencyQuorum = 6000; // 60% for emergency

    // Bridge configurations
    mapping(uint256 => BridgeConfig) public bridgeConfigs;
    mapping(address => uint256) public relayerStakes;
    uint256 public constant MIN_RELAYER_STAKE = 10 ether;

    // Events
    event ChainRegistered(
        uint256 indexed chainId,
        string name,
        address bridgeAddress
    );
    event ChainUpdated(uint256 indexed chainId, bool isActive);
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        ProposalType proposalType
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight,
        uint256 indexed chainId
    );
    event CrossChainVoteReceived(
        uint256 indexed proposalId,
        uint256 indexed chainId,
        address voter,
        bool support,
        uint256 weight
    );
    event MessageSent(
        bytes32 indexed messageId,
        uint256 indexed destChain,
        MessageType messageType
    );
    event MessageReceived(
        bytes32 indexed messageId,
        uint256 indexed sourceChain,
        bytes32 hash
    );
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event RelayerRegistered(address indexed relayer, uint256 stake);
    event RelayerSlashed(address indexed relayer, uint256 amount);
    event QuorumUpdated(uint256 newQuorum);
    event VotingPeriodUpdated(uint256 newPeriod);
    event WeightSynced(
        address indexed voter,
        uint256 indexed chainId,
        uint256 weight
    );
    event EmergencyActionTriggered(uint256 indexed proposalId, string action);

    constructor(address _governanceToken) {
        require(_governanceToken != address(0), "Invalid token");
        GOVERNANCE_TOKEN = IERC20(_governanceToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CHAIN_REGISTRAR_ROLE, msg.sender);
    }

    // ============ Chain Registration ============

    function registerChain(
        uint256 _chainId,
        string calldata _name,
        address _bridgeAddress,
        address _messengerAddress
    ) external onlyRole(CHAIN_REGISTRAR_ROLE) {
        require(_bridgeAddress != address(0), "Invalid bridge");
        require(!chains[_chainId].isActive, "Chain already registered");

        chains[_chainId] = Chain({
            chainId: _chainId,
            name: _name,
            bridgeAddress: _bridgeAddress,
            messengerAddress: _messengerAddress,
            isActive: true,
            lastMessageTime: 0,
            messageCount: 0,
            latestProposalHash: bytes32(0)
        });

        bridgeConfigs[_chainId] = BridgeConfig({
            bridge: _bridgeAddress,
            chainId: _chainId,
            messageGasLimit: 500000,
            confirmationBlocks: 12,
            relayerReward: 0.01 ether,
            isActive: true
        });

        chainCount++;

        emit ChainRegistered(_chainId, _name, _bridgeAddress);
    }

    function updateChainStatus(
        uint256 _chainId,
        bool _isActive
    ) external onlyRole(CHAIN_REGISTRAR_ROLE) {
        require(chains[_chainId].chainId == _chainId, "Chain not registered");
        chains[_chainId].isActive = _isActive;
        emit ChainUpdated(_chainId, _isActive);
    }

    // ============ Proposal Creation ============

    function createCrossChainProposal(
        string calldata _title,
        string calldata _description,
        bytes32 _contentHash,
        ProposalType _proposalType,
        uint256 _votingPeriod_
    ) external returns (uint256 proposalId) {
        require(bytes(_title).length > 0, "Empty title");
        require(bytes(_description).length > 0, "Empty description");

        uint256 voterWeight = getVotingWeight(msg.sender);
        require(voterWeight >= proposalThreshold, "Below proposal threshold");

        proposalId = proposalCount++;

        CrossChainProposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = _title;
        proposal.description = _description;
        proposal.contentHash = _contentHash;
        proposal.votingPowerRequired = _calculateQuorum(_proposalType);
        proposal.startTime = block.timestamp;
        proposal.endTime =
            block.timestamp +
            (_votingPeriod_ > 0 ? _votingPeriod_ : votingPeriod);
        proposal.status = ProposalStatus.Active;
        proposal.proposalType = _proposalType;
        proposal.chainVoteCounts = new uint256[](chainCount);

        voterProposals[msg.sender].push(proposalId);

        // Broadcast to all active chains
        _broadcastProposal(proposalId);

        emit ProposalCreated(proposalId, msg.sender, _title, _proposalType);
        return proposalId;
    }

    function _broadcastProposal(uint256 _proposalId) internal {
        CrossChainProposal storage proposal = proposals[_proposalId];
        bytes32 proposalHash = keccak256(
            abi.encode(proposal.title, proposal.contentHash)
        );

        for (uint256 i = 0; i < chainCount; i++) {
            if (chains[i + 1].isActive) {
                bytes32 messageId = _sendCrossChainMessage(
                    i + 1,
                    abi.encode(
                        MessageType.ProposalCreated,
                        _proposalId,
                        proposal.title,
                        proposal.contentHash,
                        proposal.endTime
                    )
                );
                proposal.chainVoteCounts[i] = 0;
            }
        }
    }

    function _calculateQuorum(
        ProposalType _type
    ) internal view returns (uint256) {
        uint256 baseQuorum = (quorumNumerator *
            GOVERNANCE_TOKEN.totalSupply()) / quorumDenominator;

        if (_type == ProposalType.Emergency) {
            return
                (emergencyQuorum * GOVERNANCE_TOKEN.totalSupply()) /
                quorumDenominator;
        }

        return baseQuorum;
    }

    // ============ Voting ============

    function castVote(uint256 _proposalId, bool _support) external {
        _castVote(_proposalId, msg.sender, _support);
    }

    function castVoteWithReason(
        uint256 _proposalId,
        bool _support,
        string calldata _reason
    ) external {
        _castVote(_proposalId, msg.sender, _support);
    }

    function castCrossChainVote(
        uint256 _proposalId,
        uint256 _chainId,
        bool _support,
        bytes calldata _signature
    ) external {
        require(chains[_chainId].isActive, "Chain not active");

        // Verify signature from other chain
        bytes32 voteHash = keccak256(
            abi.encode(_proposalId, msg.sender, _support, block.timestamp)
        );

        // Simplified - in production would verify actual cross-chain proof
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(_signature)
        ));
        address signer = ECDSA.recover(ethSignedHash, _signature);
        require(signer == msg.sender, "Invalid signature");

        CrossChainProposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Active, "Not active");

        uint256 weight = voterWeights[msg.sender].chainWeights[_chainId];
        require(weight > 0, "No voting weight on this chain");

        // Record vote
        ChainVote memory vote = ChainVote({
            chainId: _chainId,
            voter: msg.sender,
            support: _support,
            weight: weight,
            timestamp: block.timestamp,
            voteHash: voteHash
        });

        chainVotes[keccak256(abi.encode(_proposalId, _chainId))].push(vote);

        // Update proposal counts
        if (_support) {
            proposal.yesVotes += weight;
        } else {
            proposal.noVotes += weight;
        }

        proposal.crossChainVotes++;
        proposal.chainVoteCounts[_chainId - 1]++;

        // Update voter weight
        voterWeights[msg.sender].lastVoteTime = block.timestamp;

        emit CrossChainVoteReceived(
            _proposalId,
            _chainId,
            msg.sender,
            _support,
            weight
        );
    }

    function _castVote(
        uint256 _proposalId,
        address _voter,
        bool _support
    ) internal {
        CrossChainProposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Active, "Not active");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!hasVoted(_proposalId, _voter), "Already voted");

        uint256 weight = getVotingWeight(_voter);
        require(weight > 0, "No voting power");

        // Update voter weight
        VoterWeight storage voter = voterWeights[_voter];
        voter.lastVoteTime = block.timestamp;

        // Update proposal
        if (_support) {
            proposal.yesVotes += weight;
        } else {
            proposal.noVotes += weight;
        }

        voterProposals[_voter].push(_proposalId);

        // Broadcast vote to other chains
        _broadcastVote(_proposalId, _voter, _support, weight);

        emit VoteCast(_proposalId, _voter, _support, weight, 1); // 1 = native chain
    }

    function _broadcastVote(
        uint256 _proposalId,
        address _voter,
        bool _support,
        uint256 _weight
    ) internal {
        bytes memory payload = abi.encode(
            MessageType.VoteSubmission,
            _proposalId,
            _voter,
            _support,
            _weight,
            block.timestamp
        );

        for (uint256 i = 0; i < chainCount; i++) {
            if (chains[i + 1].isActive && i + 1 != 1) {
                // Skip native chain
                _sendCrossChainMessage(i + 1, payload);
            }
        }
    }

    // ============ Cross-Chain Messaging ============

    function _sendCrossChainMessage(
        uint256 _destChain,
        bytes memory _payload
    ) internal returns (bytes32 messageId) {
        require(chains[_destChain].isActive, "Destination not active");

        messageId = keccak256(
            abi.encode(
                _payload,
                block.timestamp,
                chains[_destChain].messageCount++
            )
        );

        messages[messageId] = Message({
            messageId: messageId,
            sourceChain: 1, // Native chain ID
            destChain: _destChain,
            sender: address(this),
            payload: _payload,
            timestamp: block.timestamp,
            messageType: MessageType.VoteSubmission,
            processed: false,
            hash: keccak256(_payload)
        });

        chains[_destChain].lastMessageTime = block.timestamp;
        chainMessageHistory[_destChain].push(messageId);

        emit MessageSent(messageId, _destChain, MessageType.VoteSubmission);

        return messageId;
    }

    function receiveCrossChainMessage(
        bytes32 _messageId,
        uint256 _sourceChain,
        bytes calldata _payload
    ) external onlyRole(RELAYER_ROLE) {
        require(!processedMessages[_messageId], "Already processed");

        bytes32 payloadHash = keccak256(_payload);

        messages[_messageId] = Message({
            messageId: _messageId,
            sourceChain: _sourceChain,
            destChain: 1,
            sender: chains[_sourceChain].messengerAddress,
            payload: _payload,
            timestamp: block.timestamp,
            messageType: MessageType.VoteSubmission,
            processed: false,
            hash: payloadHash
        });

        processedMessages[_messageId] = true;

        // Process the message based on type
        _processMessage(_messageId, _payload);

        emit MessageReceived(_messageId, _sourceChain, payloadHash);
    }

    function _processMessage(
        bytes32 _messageId,
        bytes calldata _payload
    ) internal {
        (MessageType msgType, ) = abi.decode(_payload, (MessageType, bytes));

        if (msgType == MessageType.VoteSubmission) {
            (
                ,
                uint256 proposalId,
                address voter,
                bool support,
                uint256 weight,

            ) = abi.decode(
                    _payload,
                    (MessageType, uint256, address, bool, uint256, uint256)
                );

            // Record cross-chain vote
            CrossChainProposal storage proposal = proposals[proposalId];
            if (proposal.status == ProposalStatus.Active) {
                ChainVote memory vote = ChainVote({
                    chainId: messages[_messageId].sourceChain,
                    voter: voter,
                    support: support,
                    weight: weight,
                    timestamp: block.timestamp,
                    voteHash: keccak256(abi.encode(proposalId, voter))
                });

                bytes32 voteKey = keccak256(
                    abi.encode(proposalId, messages[_messageId].sourceChain)
                );
                chainVotes[voteKey].push(vote);

                if (support) {
                    proposal.yesVotes += weight;
                } else {
                    proposal.noVotes += weight;
                }

                proposal.crossChainVotes++;

                emit CrossChainVoteReceived(
                    proposalId,
                    messages[_messageId].sourceChain,
                    voter,
                    support,
                    weight
                );
            }
        } else if (msgType == MessageType.WeightSync) {
            (, address voter, uint256 chainId, uint256 weight) = abi.decode(
                _payload,
                (MessageType, address, uint256, uint256)
            );

            voterWeights[voter].chainWeights[chainId] = weight;

            emit WeightSynced(voter, chainId, weight);
        }
    }

    // ============ Vote Weight Management ============

    function syncVotingWeight(
        address _voter,
        uint256 _chainId,
        uint256 _weight
    ) external onlyRole(RELAYER_ROLE) {
        voterWeights[_voter].chainWeights[_chainId] = _weight;
        _updateTotalWeight(_voter);

        emit WeightSynced(_voter, _chainId, _weight);
    }

    function _updateTotalWeight(address _voter) internal {
        VoterWeight storage voter = voterWeights[_voter];
        uint256 total;

        // Sum weights from all chains
        for (uint256 i = 0; i < chainCount; i++) {
            total += voter.chainWeights[i + 1];
        }

        voter.totalWeight = total;
        voter.isActive = total > 0;
    }

    function getVotingWeight(address _voter) public view returns (uint256) {
        VoterWeight storage voter = voterWeights[_voter];
        if (voter.totalWeight > 0) {
            return voter.totalWeight;
        }
        // Fallback to governance token balance
        return GOVERNANCE_TOKEN.balanceOf(_voter);
    }

    // ============ Proposal Execution ============

    function executeProposal(
        uint256 _proposalId,
        address[] calldata _targets,
        bytes[] calldata _datas
    ) external nonReentrant returns (bool success) {
        CrossChainProposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Active, "Not active");
        require(block.timestamp >= proposal.endTime, "Voting not ended");

        // Check quorum
        uint256 totalVotes = proposal.yesVotes +
            proposal.noVotes +
            proposal.abstainVotes;
        require(
            totalVotes >= proposal.votingPowerRequired,
            "Quorum not reached"
        );
        require(proposal.yesVotes > proposal.noVotes, "Proposal defeated");

        // Check cross-chain consensus (if applicable)
        if (proposal.proposalType == ProposalType.CrossChainMessage) {
            require(
                proposal.crossChainVotes >= chainCount / 2 + 1,
                "Insufficient cross-chain support"
            );
        }

        proposal.status = ProposalStatus.Executed;

        // Execute calls
        bytes[] memory results = new bytes[](_targets.length);
        for (uint256 i = 0; i < _targets.length; i++) {
            (success, results[i]) = _targets[i].call(_datas[i]);
            proposal.executedCalls.push(_datas[i]);
        }

        // Broadcast execution to all chains
        bytes memory payload = abi.encode(
            MessageType.ProposalExecuted,
            _proposalId,
            success
        );

        for (uint256 i = 0; i < chainCount; i++) {
            if (chains[i + 1].isActive) {
                _sendCrossChainMessage(i + 1, payload);
            }
        }

        emit ProposalExecuted(_proposalId, success);
        return success;
    }

    function queueProposal(uint256 _proposalId) external {
        CrossChainProposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Active, "Not active");
        require(block.timestamp >= proposal.endTime, "Voting not ended");

        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        require(proposal.yesVotes > proposal.noVotes, "Defeated");
        require(
            totalVotes >= proposal.votingPowerRequired,
            "Quorum not reached"
        );

        proposal.status = ProposalStatus.Queued;
    }

    // ============ Emergency Actions ============

    function triggerEmergencyAction(
        string calldata _action,
        bytes calldata _data
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Requires unanimous consent from all chain guardians
        // Simplified for demo

        emit EmergencyActionTriggered(0, _action);

        if (_data.length > 0) {
            (address target, ) = abi.decode(_data, (address, bytes));
            target.call(_data);
        }
    }

    // ============ Relayer Management ============

    function registerRelayer() external payable {
        require(msg.value >= MIN_RELAYER_STAKE, "Stake too low");
        require(!_isRelayer(msg.sender), "Already registered");

        relayerStakes[msg.sender] = msg.value;

        emit RelayerRegistered(msg.sender, msg.value);
    }

    function _isRelayer(address _relayer) internal view returns (bool) {
        return relayerStakes[_relayer] >= MIN_RELAYER_STAKE;
    }

    function slashRelayer(
        address _relayer,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(relayerStakes[_relayer] >= _amount, "Stake too low");
        relayerStakes[_relayer] -= _amount;

        emit RelayerSlashed(_relayer, _amount);
    }

    // ============ Admin Functions ============

    function updateQuorum(
        uint256 _numerator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_numerator <= quorumDenominator, "Invalid numerator");
        quorumNumerator = _numerator;
        emit QuorumUpdated(_numerator);
    }

    function updateVotingPeriod(
        uint256 _period
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_period >= 1 days && _period <= 30 days, "Invalid period");
        votingPeriod = _period;
        emit VotingPeriodUpdated(_period);
    }

    function updateBridgeConfig(
        uint256 _chainId,
        uint256 _gasLimit,
        uint256 _confirmationBlocks,
        uint256 _relayerReward
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        BridgeConfig storage config = bridgeConfigs[_chainId];
        config.messageGasLimit = _gasLimit;
        config.confirmationBlocks = _confirmationBlocks;
        config.relayerReward = _relayerReward;
    }

    // ============ View Functions ============

    function hasVoted(
        uint256 _proposalId,
        address _voter
    ) public view returns (bool) {
        uint256[] storage proposalVotes = voterProposals[_voter];
        for (uint256 i = 0; i < proposalVotes.length; i++) {
            if (proposalVotes[i] == _proposalId) return true;
        }
        return false;
    }

    function getProposalDetails(
        uint256 _proposalId
    )
        external
        view
        returns (
            address proposer,
            string memory title,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 crossChainVotes,
            uint256 endTime,
            ProposalStatus status,
            ProposalType proposalType
        )
    {
        CrossChainProposal storage proposal = proposals[_proposalId];
        return (
            proposal.proposer,
            proposal.title,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.crossChainVotes,
            proposal.endTime,
            proposal.status,
            proposal.proposalType
        );
    }

    function getChainVotes(
        uint256 _proposalId,
        uint256 _chainId
    ) external view returns (ChainVote[] memory) {
        bytes32 voteKey = keccak256(abi.encode(_proposalId, _chainId));
        return chainVotes[voteKey];
    }

    function getVoterWeight(
        address _voter
    )
        external
        view
        returns (uint256 totalWeight, uint256 nativeWeight, uint256 chainCount)
    {
        VoterWeight storage voter = voterWeights[_voter];
        return (
            voter.totalWeight > 0
                ? voter.totalWeight
                : GOVERNANCE_TOKEN.balanceOf(_voter),
            voter.chainWeights[1],
            chainCount
        );
    }

    function getChainInfo(
        uint256 _chainId
    )
        external
        view
        returns (
            string memory name,
            address bridge,
            bool isActive,
            uint256 lastMessage,
            uint256 messageCount
        )
    {
        Chain storage chain = chains[_chainId];
        return (
            chain.name,
            chain.bridgeAddress,
            chain.isActive,
            chain.lastMessageTime,
            chain.messageCount
        );
    }

    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposals[i].status == ProposalStatus.Active) {
                count++;
            }
        }

        uint256[] memory activeProposals = new uint256[](count);
        uint256 idx;
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposals[i].status == ProposalStatus.Active) {
                activeProposals[idx++] = i;
            }
        }

        return activeProposals;
    }

    function getCrossChainVoteStats(
        uint256 _proposalId
    )
        external
        view
        returns (uint256 totalCrossChainVotes, uint256 participatingChains)
    {
        CrossChainProposal storage proposal = proposals[_proposalId];
        uint256 chainsParticipating;

        for (uint256 i = 0; i < chainCount; i++) {
            if (proposal.chainVoteCounts[i] > 0) {
                chainsParticipating++;
            }
        }

        return (proposal.crossChainVotes, chainsParticipating);
    }

    function getGovernanceStats()
        external
        view
        returns (
            uint256 totalProposals,
            uint256 activeProposals,
            uint256 executedProposals,
            uint256 totalChains,
            uint256 activeChains
        )
    {
        uint256 active;
        uint256 executed;
        uint256 activeChainCount;

        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposals[i].status == ProposalStatus.Active) active++;
            if (proposals[i].status == ProposalStatus.Executed) executed++;
        }

        for (uint256 i = 0; i < chainCount; i++) {
            if (chains[i + 1].isActive) activeChainCount++;
        }

        return (proposalCount, active, executed, chainCount, activeChainCount);
    }
}
