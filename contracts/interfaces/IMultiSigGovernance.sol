// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMultiSigGovernance
 * @notice Interface for MultiSigGovernance
 */
interface IMultiSigGovernance {
    enum ProposalType {
        Standard,
        Urgency,
        Emergency,
        ParameterChange,
        Treasury,
        Upgrade
    }
    enum ProposalState {
        Pending,
        Active,
        Queued,
        Executed,
        Failed,
        Expired,
        Cancelled
    }

    // ============ Proposals ============

    function createProposal(
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _calldatas,
        string calldata _description,
        ProposalType _proposalType,
        bool _withTimelock
    ) external returns (uint256 proposalId);

    function queueProposal(uint256 _proposalId) external;

    function executeProposal(
        uint256 _proposalId
    ) external returns (bytes[] memory results);

    function cancelProposal(uint256 _proposalId) external;

    // ============ Voting ============

    function castVote(uint256 _proposalId, bool _support) external;

    function castVoteWithReason(
        uint256 _proposalId,
        bool _support,
        string calldata _reason
    ) external;

    function getVotes(address _account) external view returns (uint256);

    // ============ Configuration ============

    function updateQuorum(uint256 _numerator) external;

    function updateVotingDuration(uint256 _duration) external;

    function toggleEmergencyMode() external;

    // ============ View Functions ============

    function getProposalState(
        uint256 _proposalId
    ) external view returns (ProposalState);

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
        );

    function hasVoted(
        uint256 _proposalId,
        address _voter
    ) external view returns (bool);

    // ============ Additional functions for compatibility ============

    function getProposal(uint256 _proposalId)
        external
        view
        returns (
            bool approved,
            uint256 executedAt,
            uint256 createdAt,
            uint256 executionDelay
        );
}