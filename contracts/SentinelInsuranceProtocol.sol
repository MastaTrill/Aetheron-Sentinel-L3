// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SentinelInsuranceProtocol
 * @notice Decentralized insurance for DeFi security incidents
 * Parametric insurance triggered by Sentinel security events
 */
contract SentinelInsuranceProtocol is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Insurance policy structure
    struct InsurancePolicy {
        uint256 policyId;
        address policyHolder;
        address coveredContract;
        uint256 coverageAmount;
        uint256 premiumAmount;
        uint256 coveragePeriod;
        uint256 startTime;
        uint256 endTime;
        InsuranceType insuranceType;
        PolicyStatus status;
        uint256 claimCount;
        uint256 totalPaid;
    }

    // Insurance types
    enum InsuranceType {
        HACK_COVERAGE, // Coverage for smart contract exploits
        ORACLE_FAILURE, // Coverage for oracle manipulation
        GOVERNANCE_ATTACK, // Coverage for governance exploits
        BRIDGE_FAILURE, // Coverage for cross-chain bridge issues
        LIQUIDITY_THEFT, // Coverage for AMM liquidity theft
        WALLET_DRAIN, // Coverage for wallet draining attacks
        PHISHING_LOSS, // Coverage for social engineering attacks
        PROTOCOL_EXPLOIT // General protocol exploit coverage
    }

    // Policy status
    enum PolicyStatus {
        ACTIVE,
        EXPIRED,
        CLAIMED,
        CANCELLED,
        DEFAULTED
    }

    // Insurance pool structure
    struct InsurancePool {
        InsuranceType poolType;
        uint256 totalCoverage;
        uint256 totalPremiums;
        uint256 lockedFunds;
        uint256 claimReserve;
        uint256 utilizationRate;
        bool isActive;
        address[] policies;
    }

    // Claim structure
    struct InsuranceClaim {
        uint256 claimId;
        uint256 policyId;
        address claimant;
        uint256 claimAmount;
        uint256 incidentTimestamp;
        bytes32 incidentHash;
        ClaimStatus status;
        uint256 processingTime;
        bytes evidence;
    }

    enum ClaimStatus {
        SUBMITTED,
        UNDER_REVIEW,
        APPROVED,
        REJECTED,
        PAID
    }

    // State variables
    mapping(uint256 => InsurancePolicy) public policies;
    mapping(uint256 => InsurancePool) public insurancePools;
    mapping(uint256 => InsuranceClaim) public claims;

    uint256 public policyCount;
    uint256 public claimCount;
    uint256 public totalCoverageProvided;
    uint256 public totalPremiumsCollected;

    // Insurance parameters
    uint256 public constant MIN_COVERAGE = 1 ether;
    uint256 public constant MAX_COVERAGE = 10000 ether;
    uint256 public constant MIN_PREMIUM_RATE = 0.001 ether; // 0.1% minimum
    uint256 public constant MAX_PREMIUM_RATE = 0.05 ether; // 5% maximum
    uint256 public constant CLAIM_PROCESSING_TIME = 7 days;
    uint256 public constant COVERAGE_PERIOD_MIN = 30 days;
    uint256 public constant COVERAGE_PERIOD_MAX = 365 days;

    // Risk assessment parameters
    uint256 public baseRiskScore;
    uint256 public claimHistoryWeight;
    uint256 public protocolSecurityWeight;

    // Sentinel integration
    address public sentinelCore;
    address public sentinelAuditor;

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed policyHolder,
        InsuranceType insuranceType
    );
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        uint256 claimAmount
    );
    event ClaimProcessed(
        uint256 indexed claimId,
        ClaimStatus status,
        uint256 payoutAmount
    );
    event PremiumCollected(uint256 indexed policyId, uint256 amount);
    event CoverageActivated(uint256 indexed policyId);

    constructor(
        address _sentinelCore,
        address _sentinelAuditor,
        address initialOwner
    ) {
        require(initialOwner != address(0), "Invalid owner");
        sentinelCore = _sentinelCore;
        sentinelAuditor = _sentinelAuditor;

        // Initialize base risk parameters
        baseRiskScore = 500; // Medium risk
        claimHistoryWeight = 30; // 30% weight on claim history
        protocolSecurityWeight = 70; // 70% weight on protocol security

        // Initialize insurance pools
        _initializeInsurancePools();
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Purchase insurance policy
     * @param coveredContract Contract to insure
     * @param coverageAmount Amount of coverage desired
     * @param insuranceType Type of insurance
     * @param coveragePeriod Period of coverage in seconds
     */
    function purchaseInsurance(
        address coveredContract,
        uint256 coverageAmount,
        InsuranceType insuranceType,
        uint256 coveragePeriod
    ) external payable nonReentrant returns (uint256) {
        require(
            coverageAmount >= MIN_COVERAGE && coverageAmount <= MAX_COVERAGE,
            "Invalid coverage amount"
        );
        require(
            coveragePeriod >= COVERAGE_PERIOD_MIN &&
                coveragePeriod <= COVERAGE_PERIOD_MAX,
            "Invalid coverage period"
        );
        require(
            insurancePools[uint256(insuranceType)].isActive,
            "Insurance type not available"
        );

        // Calculate premium based on risk assessment
        uint256 premiumAmount = _calculatePremium(
            coveredContract,
            coverageAmount,
            insuranceType,
            coveragePeriod
        );
        require(msg.value >= premiumAmount, "Insufficient premium payment");

        // Refund excess payment
        if (msg.value > premiumAmount) {
            (bool refundOk, ) = payable(msg.sender).call{
                value: msg.value - premiumAmount
            }("");
            require(refundOk, "Refund failed");
        }

        uint256 policyId = policyCount++;

        policies[policyId] = InsurancePolicy({
            policyId: policyId,
            policyHolder: msg.sender,
            coveredContract: coveredContract,
            coverageAmount: coverageAmount,
            premiumAmount: premiumAmount,
            coveragePeriod: coveragePeriod,
            startTime: block.timestamp,
            endTime: block.timestamp + coveragePeriod,
            insuranceType: insuranceType,
            status: PolicyStatus.ACTIVE,
            claimCount: 0,
            totalPaid: 0
        });

        // Update insurance pool
        InsurancePool storage pool = insurancePools[uint256(insuranceType)];
        pool.totalCoverage = pool.totalCoverage.add(coverageAmount);
        pool.totalPremiums = pool.totalPremiums.add(premiumAmount);
        pool.lockedFunds = pool.lockedFunds.add(coverageAmount);
        pool.policies.push(msg.sender);

        totalCoverageProvided = totalCoverageProvided.add(coverageAmount);
        totalPremiumsCollected = totalPremiumsCollected.add(premiumAmount);

        emit PolicyCreated(policyId, msg.sender, insuranceType);
        emit PremiumCollected(policyId, premiumAmount);

        return policyId;
    }

    /**
     * @notice Submit insurance claim
     * @param policyId Policy to claim against
     * @param incidentHash Hash of the security incident
     * @param evidence Supporting evidence
     */
    function submitClaim(
        uint256 policyId,
        bytes32 incidentHash,
        bytes calldata evidence
    ) external returns (uint256) {
        InsurancePolicy storage policy = policies[policyId];
        require(policy.policyHolder == msg.sender, "Not policy holder");
        require(policy.status == PolicyStatus.ACTIVE, "Policy not active");
        require(block.timestamp <= policy.endTime, "Policy expired");
        require(block.timestamp >= policy.startTime, "Policy not yet active");

        // Verify incident through Sentinel
        uint256 incidentSeverity = _verifySecurityIncident(
            incidentHash,
            policy.coveredContract
        );
        require(incidentSeverity > 0, "Incident not verified by Sentinel");

        uint256 claimAmount = _calculateClaimAmount(policy, incidentSeverity);

        uint256 claimId = claimCount++;

        claims[claimId] = InsuranceClaim({
            claimId: claimId,
            policyId: policyId,
            claimant: msg.sender,
            claimAmount: claimAmount,
            incidentTimestamp: block.timestamp,
            incidentHash: incidentHash,
            status: ClaimStatus.SUBMITTED,
            processingTime: 0,
            evidence: evidence
        });

        policy.claimCount++;

        emit ClaimSubmitted(claimId, policyId, claimAmount);
        return claimId;
    }

    /**
     * @notice Process insurance claim (only by authorized processors)
     * @param claimId Claim to process
     * @param approve Whether to approve the claim
     */
    function processClaim(uint256 claimId, bool approve) external onlyOwner {
        InsuranceClaim storage claim = claims[claimId];
        require(
            claim.status == ClaimStatus.SUBMITTED,
            "Claim not in submitted state"
        );

        InsurancePolicy storage policy = policies[claim.policyId];
        InsurancePool storage pool = insurancePools[
            uint256(policy.insuranceType)
        ];

        if (approve) {
            require(
                pool.claimReserve >= claim.claimAmount,
                "Insufficient claim reserve"
            );
            require(
                address(this).balance >= claim.claimAmount,
                "Insufficient contract balance"
            );

            // Pay out claim
            (bool payOk, ) = payable(claim.claimant).call{
                value: claim.claimAmount
            }("");
            require(payOk, "Claim payout failed");

            // Update policy and pool
            policy.totalPaid = policy.totalPaid.add(claim.claimAmount);
            pool.claimReserve = pool.claimReserve.sub(claim.claimAmount);
            pool.lockedFunds = pool.lockedFunds.sub(claim.claimAmount);

            claim.status = ClaimStatus.PAID;
            claim.processingTime = block.timestamp;

            // Check if policy is exhausted
            if (policy.totalPaid >= policy.coverageAmount) {
                policy.status = PolicyStatus.EXPIRED;
            }
        } else {
            claim.status = ClaimStatus.REJECTED;
            claim.processingTime = block.timestamp;
        }

        emit ClaimProcessed(
            claimId,
            claim.status,
            approve ? claim.claimAmount : 0
        );
    }

    /**
     * @notice Get policy information
     * @param policyId Policy to query
     */
    function getPolicyInfo(
        uint256 policyId
    )
        external
        view
        returns (
            address policyHolder,
            uint256 coverageAmount,
            uint256 remainingCoverage,
            InsuranceType insuranceType,
            PolicyStatus status,
            uint256 endTime
        )
    {
        InsurancePolicy memory policy = policies[policyId];
        uint256 remainingCoverage = policy.coverageAmount - policy.totalPaid;

        return (
            policy.policyHolder,
            policy.coverageAmount,
            remainingCoverage,
            policy.insuranceType,
            policy.status,
            policy.endTime
        );
    }

    /**
     * @notice Get insurance pool statistics
     * @param poolType Type of insurance pool
     */
    function getPoolStatistics(
        uint256 poolType
    )
        external
        view
        returns (
            uint256 totalCoverage,
            uint256 totalPremiums,
            uint256 utilizationRate,
            uint256 claimReserve,
            uint256 policyCount
        )
    {
        InsurancePool memory pool = insurancePools[poolType];

        return (
            pool.totalCoverage,
            pool.totalPremiums,
            pool.utilizationRate,
            pool.claimReserve,
            pool.policies.length
        );
    }

    /**
     * @notice Calculate insurance premium
     */
    function calculatePremium(
        address coveredContract,
        uint256 coverageAmount,
        InsuranceType insuranceType,
        uint256 coveragePeriod
    ) external view returns (uint256) {
        return
            _calculatePremium(
                coveredContract,
                coverageAmount,
                insuranceType,
                coveragePeriod
            );
    }

    /**
     * @dev Calculate premium based on risk assessment
     */
    function _calculatePremium(
        address coveredContract,
        uint256 coverageAmount,
        InsuranceType insuranceType,
        uint256 coveragePeriod
    ) internal view returns (uint256) {
        // Base premium calculation
        uint256 basePremium = coverageAmount
            .mul(_getBasePremiumRate(insuranceType))
            .div(10000);

        // Risk adjustment
        uint256 riskMultiplier = _assessContractRisk(
            coveredContract,
            insuranceType
        );
        uint256 riskAdjustedPremium = basePremium.mul(riskMultiplier).div(100);

        // Time adjustment
        uint256 timeMultiplier = coveragePeriod.mul(100).div(365 days);
        uint256 finalPremium = riskAdjustedPremium.mul(timeMultiplier).div(100);

        // Apply bounds
        uint256 minPremium = coverageAmount.mul(MIN_PREMIUM_RATE).div(1 ether);
        uint256 maxPremium = coverageAmount.mul(MAX_PREMIUM_RATE).div(1 ether);

        return Math.max(finalPremium, Math.min(maxPremium, minPremium));
    }

    /**
     * @dev Get base premium rate for insurance type
     */
    function _getBasePremiumRate(
        InsuranceType insuranceType
    ) internal pure returns (uint256) {
        if (insuranceType == InsuranceType.HACK_COVERAGE) return 25; // 0.25%
        if (insuranceType == InsuranceType.ORACLE_FAILURE) return 15; // 0.15%
        if (insuranceType == InsuranceType.GOVERNANCE_ATTACK) return 30; // 0.30%
        if (insuranceType == InsuranceType.BRIDGE_FAILURE) return 20; // 0.20%
        if (insuranceType == InsuranceType.LIQUIDITY_THEFT) return 35; // 0.35%
        if (insuranceType == InsuranceType.WALLET_DRAIN) return 40; // 0.40%
        if (insuranceType == InsuranceType.PHISHING_LOSS) return 50; // 0.50%
        return 25; // Default 0.25%
    }

    /**
     * @dev Assess contract risk for premium calculation
     */
    function _assessContractRisk(
        address contractAddress,
        InsuranceType insuranceType
    ) internal view returns (uint256) {
        // Simplified risk assessment
        // In production, this would query Sentinel security metrics

        uint256 contractRisk = 100; // Base 100%

        // Adjust based on insurance type
        if (insuranceType == InsuranceType.HACK_COVERAGE) {
            contractRisk = contractRisk.add(50); // Higher risk for hack coverage
        }

        return contractRisk;
    }

    /**
     * @dev Verify security incident through Sentinel
     */
    function _verifySecurityIncident(
        bytes32 incidentHash,
        address coveredContract
    ) internal view returns (uint256) {
        // In production, this would query Sentinel security auditor
        // For demo, simulate incident verification

        // Simulate verification based on incident hash
        uint256 severity = (uint256(incidentHash) % 10) + 1; // 1-10 severity

        // Additional validation could check:
        // - Incident timestamp
        // - Contract involvement
        // - Sentinel confirmation
        // - Evidence validation

        return severity;
    }

    /**
     * @dev Calculate claim amount based on policy and incident
     */
    function _calculateClaimAmount(
        InsurancePolicy memory policy,
        uint256 incidentSeverity
    ) internal pure returns (uint256) {
        // Base claim calculation
        uint256 baseClaim = policy.coverageAmount.mul(incidentSeverity).div(10);

        // Apply policy limits
        uint256 maxClaim = policy.coverageAmount.sub(policy.totalPaid);
        uint256 claimAmount = Math.min(baseClaim, maxClaim);

        return claimAmount;
    }

    /**
     * @dev Initialize insurance pools
     */
    function _initializeInsurancePools() internal {
        // Initialize all insurance pools
        for (uint256 i = 0; i <= uint256(InsuranceType.PROTOCOL_EXPLOIT); i++) {
            insurancePools[i] = InsurancePool({
                poolType: InsuranceType(i),
                totalCoverage: 0,
                totalPremiums: 0,
                lockedFunds: 0,
                claimReserve: 0,
                utilizationRate: 0,
                isActive: true,
                policies: new address[](0)
            });
        }
    }
}
