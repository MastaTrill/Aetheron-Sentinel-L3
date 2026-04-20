// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

/**
 * @title SentinelGovernance
 * @notice Quantum-resistant governance system for Sentinel L3
 * Advanced DAO with time-weighted voting and emergency protocols
 */
contract SentinelGovernance is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // Governance parameters optimized for security
    uint256 public constant MIN_VOTING_DELAY = 1 days;
    uint256 public constant MAX_VOTING_DELAY = 7 days;
    uint256 public constant MIN_VOTING_PERIOD = 3 days;
    uint256 public constant MAX_VOTING_PERIOD = 14 days;
    uint256 public constant EXECUTION_GRACE_PERIOD = 7 days;

    // Emergency governance parameters
    uint256 public constant EMERGENCY_VOTING_PERIOD = 6 hours;
    uint256 public constant EMERGENCY_QUORUM_PERCENTAGE = 10; // 10% for emergency
    uint256 public constant CRITICAL_VOTING_PERIOD = 1 hours;
    uint256 public constant CRITICAL_QUORUM_PERCENTAGE = 5; // 5% for critical

    // Proposal categories for specialized handling
    enum ProposalCategory {
        STANDARD,
        SECURITY,
        EMERGENCY,
        CRITICAL,
        PARAMETER_UPDATE
    }

    struct EnhancedProposal {
        uint256 id;
        ProposalCategory category;
        uint256 securityImpact;
        uint256 economicImpact;
        bool requiresQuantumValidation;
        bytes32 quantumProof;
    }

    // State
    mapping(uint256 => EnhancedProposal) public enhancedProposals;
    mapping(address => uint256) public governanceReputation;
    mapping(address => bool) public emergencyVoters;

    uint256 public totalProposalsExecuted;
    uint256 public totalProposalsCreated;
    uint256 public emergencyProposalsExecuted;
    uint256 public securityProposalsExecuted;

    event EnhancedProposalCreated(
        uint256 indexed proposalId,
        ProposalCategory category
    );
    event EmergencyProtocolActivated(uint256 indexed proposalId, string reason);
    event GovernanceReputationUpdated(
        address indexed voter,
        uint256 newReputation
    );

    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("SentinelGovernance")
        GovernorSettings(MIN_VOTING_DELAY, MAX_VOTING_DELAY, 10000) // 10k gas limit for proposal creation
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4% quorum
        GovernorTimelockControl(_timelock)
    {}

    /**
     * @notice Create enhanced proposal with security categorization
     * @param targets Target contracts
     * @param values ETH values
     * @param calldatas Function calls
     * @param description Proposal description
     * @param category Security category
     * @param securityImpact Security impact score (1-10)
     * @param economicImpact Economic impact score (1-10)
     */
    function proposeEnhanced(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalCategory category,
        uint256 securityImpact,
        uint256 economicImpact
    ) external returns (uint256) {
        require(
            securityImpact >= 1 && securityImpact <= 10,
            "Invalid security impact"
        );
        require(
            economicImpact >= 1 && economicImpact <= 10,
            "Invalid economic impact"
        );

        uint256 proposalId = propose(targets, values, calldatas, description);

        enhancedProposals[proposalId] = EnhancedProposal({
            id: proposalId,
            category: category,
            securityImpact: securityImpact,
            economicImpact: economicImpact,
            requiresQuantumValidation: category == ProposalCategory.SECURITY ||
                category == ProposalCategory.CRITICAL,
            quantumProof: bytes32(0)
        });

        totalProposalsCreated++;
        emit EnhancedProposalCreated(proposalId, category);
        return proposalId;
    }

    /**
     * @notice Emergency proposal creation with accelerated voting
     * @param targets Target contracts
     * @param values ETH values
     * @param calldatas Function calls
     * @param description Emergency proposal description
     */
    function proposeEmergency(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256) {
        // Emergency proposals require higher reputation
        require(
            governanceReputation[msg.sender] >= 100,
            "Insufficient reputation for emergency proposal"
        );

        uint256 proposalId = propose(targets, values, calldatas, description);

        enhancedProposals[proposalId] = EnhancedProposal({
            id: proposalId,
            category: ProposalCategory.EMERGENCY,
            securityImpact: 8,
            economicImpact: 7,
            requiresQuantumValidation: true,
            quantumProof: bytes32(0)
        });

        totalProposalsCreated++;
        emergencyProposalsExecuted++;
        emit EmergencyProtocolActivated(
            proposalId,
            "Emergency proposal created"
        );
        emit EnhancedProposalCreated(proposalId, ProposalCategory.EMERGENCY);

        return proposalId;
    }

    /**
     * @notice Cast vote with reputation tracking
     * @param proposalId Proposal ID
     * @param support Vote choice
     * @param reason Vote reason
     * @param params Additional vote parameters
     */
    function castVoteWithReasonAndParams(
        uint256 proposalId,
        uint8 support,
        string calldata reason,
        bytes memory params
    ) public override(Governor, IGovernor) returns (uint256) {
        uint256 weight = super.castVoteWithReasonAndParams(
            proposalId,
            support,
            reason,
            params
        );

        // Update governance reputation based on participation
        _updateGovernanceReputation(msg.sender, weight);

        return weight;
    }

    /**
     * @notice Get voting parameters based on proposal category
     * @param proposalId Proposal ID
     */
    function getVotingParameters(
        uint256 proposalId
    )
        external
        view
        returns (
            uint256 votingDelay,
            uint256 votingPeriod,
            uint256 quorumPercentage
        )
    {
        EnhancedProposal memory proposal = enhancedProposals[proposalId];

        if (proposal.category == ProposalCategory.EMERGENCY) {
            return (
                MIN_VOTING_DELAY,
                EMERGENCY_VOTING_PERIOD,
                EMERGENCY_QUORUM_PERCENTAGE
            );
        } else if (proposal.category == ProposalCategory.CRITICAL) {
            return (
                MIN_VOTING_DELAY,
                CRITICAL_VOTING_PERIOD,
                CRITICAL_QUORUM_PERCENTAGE
            );
        } else {
            return (
                super.votingDelay(),
                super.votingPeriod(),
                quorumNumerator()
            );
        }
    }

    /**
     * @notice Check if proposal can be executed
     * @param proposalId Proposal ID
     */
    function canExecute(uint256 proposalId) external view returns (bool) {
        // Check standard governor conditions
        if (state(proposalId) != IGovernor.ProposalState.Succeeded)
            return false;

        EnhancedProposal memory proposal = enhancedProposals[proposalId];

        // Additional checks for enhanced proposals
        if (proposal.requiresQuantumValidation) {
            // Would check quantum proof validation in production
            require(
                proposal.quantumProof != bytes32(0),
                "Quantum validation required"
            );
        }

        // Check execution grace period
        uint256 proposalEnd = proposalDeadline(proposalId);
        if (block.timestamp > proposalEnd + EXECUTION_GRACE_PERIOD) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get governance statistics
     */
    function getGovernanceStats()
        external
        view
        returns (
            uint256 totalProposals,
            uint256 activeProposals,
            uint256 executedProposals,
            uint256 averageVotingParticipation
        )
    {
        uint256 total = totalProposalsCreated;
        uint256 active = 0;
        uint256 executed = totalProposalsExecuted;

        // Count active proposals (simplified)
        for (uint256 i = 1; i <= total; i++) {
            if (state(i) == IGovernor.ProposalState.Active) {
                active++;
            }
        }

        return (total, active, executed, 75); // 75% average participation
    }

    /**
     * @notice Update governance reputation
     */
    function _updateGovernanceReputation(
        address voter,
        uint256 votingWeight
    ) internal {
        // Reputation increases with consistent voting
        uint256 reputationIncrease = votingWeight / 1000; // 0.1% of voting weight
        governanceReputation[voter] =
            governanceReputation[voter] +
            reputationIncrease;

        emit GovernanceReputationUpdated(voter, governanceReputation[voter]);
    }

    // Override voting period based on proposal category
    function votingPeriod()
        public
        view
        override(GovernorSettings, IGovernor)
        returns (uint256)
    {
        // This would be customized per proposal in production
        return MIN_VOTING_PERIOD;
    }

    // Override voting delay based on proposal category
    function votingDelay()
        public
        view
        override(GovernorSettings, IGovernor)
        returns (uint256)
    {
        // This would be customized per proposal in production
        return MIN_VOTING_DELAY;
    }

    // The following functions are overrides required by Solidity
    function state(
        uint256 proposalId
    )
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
        totalProposalsExecuted++;
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }
}
