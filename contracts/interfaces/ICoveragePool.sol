// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICoveragePool
 * @notice Interface for CoveragePool insurance
 */
interface ICoveragePool {
    enum RiskTier {
        Low,
        Medium,
        High,
        Critical
    }
    enum ClaimStatus {
        Pending,
        UnderReview,
        Approved,
        Rejected,
        Paid,
        Expired
    }

    // ============ Policies ============

    function createPolicy(
        address _protocol,
        address _insured,
        uint256 _coverageAmount,
        uint256 _duration
    ) external returns (uint256 policyId);

    function renewPolicy(uint256 _policyId, uint256 _newDuration) external;

    function cancelPolicy(uint256 _policyId) external;

    // ============ Claims ============

    function submitClaim(
        uint256 _policyId,
        uint256 _amount,
        string calldata _description,
        bytes32 _evidenceHash
    ) external returns (uint256 claimId);

    function reviewClaim(uint256 _claimId, uint256 _evaluatorScore) external;

    function approveClaim(uint256 _claimId, uint256 _payoutAmount) external;

    function rejectClaim(uint256 _claimId, string calldata _reason) external;

    function executePayout(uint256 _claimId) external;

    // ============ Risk Assessment ============

    function assessProtocolRisk(address _protocol, RiskTier _tier) external;

    function calculatePremium(
        address _protocol,
        uint256 _coverageAmount,
        uint256 _duration
    ) external view returns (uint256 premium, uint256 premiumRate);

    // ============ Pool Management ============

    function depositToPool(uint256 _amount) external;

    function withdrawFromPool(uint256 _amount) external;

    // ============ View Functions ============

    function getPolicy(
        uint256 _policyId
    )
        external
        view
        returns (
            address protocol,
            address insured,
            uint256 coverageAmount,
            uint256 premium,
            uint256 endTime,
            bool isActive,
            RiskTier riskTier
        );

    function getClaim(
        uint256 _claimId
    )
        external
        view
        returns (
            uint256 policyId,
            address claimant,
            uint256 amount,
            uint256 payoutAmount,
            ClaimStatus status,
            uint256 submittedAt,
            uint256 approvalCount
        );

    function getPoolStats()
        external
        view
        returns (
            uint256 poolValue,
            uint256 premiumsCollected,
            uint256 claimsPaid,
            uint256 deployedCoverage,
            uint256 availablePool,
            uint256 totalPolicies,
            uint256 activePolicies
        );
}
