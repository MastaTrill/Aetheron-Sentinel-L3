// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SentinelInsurancePool
 * @notice DeFi Insurance Products - Covers smart contract exploits, impermanent loss, and security breaches
 */
contract SentinelInsurancePool is Ownable, ReentrancyGuard {
    IERC20 public immutable premiumToken; // AETH token
    IERC20 public immutable payoutToken; // Usually stablecoin like USDC

    // Insurance policy types
    enum PolicyType {
        SMART_CONTRACT_EXPLOIT, // Covers smart contract vulnerabilities
        IMPERMANENT_LOSS, // Covers IL in liquidity provision
        FLASH_LOAN_ATTACK, // Covers flash loan exploits
        GOVERNANCE_ATTACK, // Covers governance manipulation
        BRIDGE_EXPLOIT, // Covers cross-chain bridge issues
        WALLET_COMPROMISE // Covers wallet private key compromise
    }

    struct InsurancePolicy {
        uint256 policyId;
        address policyHolder;
        PolicyType policyType;
        address coveredContract;
        uint256 coverageAmount;
        uint256 premiumPaid;
        uint256 coveragePeriod;
        uint256 expiryDate;
        bool isActive;
        bool isClaimed;
    }

    struct InsurancePool {
        PolicyType policyType;
        uint256 totalCoverage;
        uint256 totalPremiums;
        uint256 claimReserve; // Amount set aside for claims
        uint256 utilizationRate; // Premium utilization
        bool isActive;
    }

    mapping(uint256 => InsurancePolicy) public policies;
    mapping(PolicyType => InsurancePool) public insurancePools;
    mapping(address => uint256[]) public userPolicies;

    uint256 public nextPolicyId = 1;
    uint256 public totalPremiumsCollected;
    uint256 public totalClaimsPaid;

    // Premium rates (basis points)
    uint256 public constant EXPLOIT_PREMIUM_RATE = 500; // 5%
    uint256 public constant IL_PREMIUM_RATE = 200; // 2%
    uint256 public constant FLASH_PREMIUM_RATE = 1000; // 10%
    uint256 public constant GOVERNANCE_PREMIUM_RATE = 800; // 8%
    uint256 public constant BRIDGE_PREMIUM_RATE = 600; // 6%
    uint256 public constant WALLET_PREMIUM_RATE = 300; // 3%

    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed policyHolder,
        PolicyType policyType,
        uint256 coverageAmount,
        uint256 premiumPaid
    );

    event ClaimFiled(uint256 indexed policyId, address indexed claimant, uint256 claimAmount, string evidence);

    event ClaimApproved(uint256 indexed policyId, uint256 payoutAmount);

    event PoolUpdated(PolicyType indexed policyType, uint256 totalCoverage, uint256 utilizationRate);

    constructor(address _premiumToken, address _payoutToken) Ownable(msg.sender) {
        premiumToken = IERC20(_premiumToken);
        payoutToken = IERC20(_payoutToken);

        // Initialize insurance pools
        _initializeInsurancePools();
    }

    /**
     * @notice Purchase insurance policy
     */
    function purchasePolicy(
        PolicyType policyType,
        address coveredContract,
        uint256 coverageAmount,
        uint256 coveragePeriod
    ) external nonReentrant {
        require(coverageAmount > 0, "Invalid coverage amount");
        require(coveragePeriod >= 30 days && coveragePeriod <= 365 days, "Invalid coverage period");
        require(insurancePools[policyType].isActive, "Policy type not available");

        uint256 premiumAmount = _calculatePremium(policyType, coverageAmount, coveragePeriod);

        // Transfer premium payment
        require(premiumToken.transferFrom(msg.sender, address(this), premiumAmount), "Premium transfer failed");

        uint256 policyId = nextPolicyId++;

        policies[policyId] = InsurancePolicy({
            policyId: policyId,
            policyHolder: msg.sender,
            policyType: policyType,
            coveredContract: coveredContract,
            coverageAmount: coverageAmount,
            premiumPaid: premiumAmount,
            coveragePeriod: coveragePeriod,
            expiryDate: block.timestamp + coveragePeriod,
            isActive: true,
            isClaimed: false
        });

        userPolicies[msg.sender].push(policyId);

        // Update pool statistics
        InsurancePool storage pool = insurancePools[policyType];
        pool.totalCoverage += coverageAmount;
        pool.totalPremiums += premiumAmount;
        pool.claimReserve += (premiumAmount * 80) / 100; // 80% goes to claim reserve
        pool.utilizationRate = _calculateUtilizationRate(policyType);

        totalPremiumsCollected += premiumAmount;

        emit PolicyPurchased(policyId, msg.sender, policyType, coverageAmount, premiumAmount);
        emit PoolUpdated(policyType, pool.totalCoverage, pool.utilizationRate);
    }

    /**
     * @notice File insurance claim
     */
    function fileClaim(uint256 policyId, uint256 claimAmount, string memory evidence, bytes memory proof)
        external
        nonReentrant
    {
        InsurancePolicy storage policy = policies[policyId];
        require(policy.policyHolder == msg.sender, "Not policy holder");
        require(policy.isActive, "Policy not active");
        require(!policy.isClaimed, "Claim already filed");
        require(policy.expiryDate > block.timestamp, "Policy expired");
        require(claimAmount <= policy.coverageAmount, "Claim exceeds coverage");

        // Validate claim based on policy type
        require(_validateClaim(policy.policyType, policy.coveredContract, evidence, proof), "Invalid claim");

        // Mark policy as claimed
        policy.isClaimed = true;
        policy.isActive = false;

        // Process payout (would typically require admin approval)
        _processPayout(policyId, claimAmount);

        emit ClaimFiled(policyId, msg.sender, claimAmount, evidence);
    }

    /**
     * @notice Get policy details
     */
    function getPolicy(uint256 policyId) external view returns (InsurancePolicy memory) {
        return policies[policyId];
    }

    /**
     * @notice Get user's policies
     */
    function getUserPolicies(address user) external view returns (uint256[] memory) {
        return userPolicies[user];
    }

    /**
     * @notice Get pool statistics
     */
    function getPoolStats(PolicyType policyType)
        external
        view
        returns (uint256 totalCoverage, uint256 totalPremiums, uint256 utilizationRate, bool isActive)
    {
        InsurancePool memory pool = insurancePools[policyType];
        return (pool.totalCoverage, pool.totalPremiums, pool.utilizationRate, pool.isActive);
    }

    /**
     * @notice Calculate premium amount
     */
    function calculatePremium(PolicyType policyType, uint256 coverageAmount, uint256 coveragePeriod)
        external
        pure
        returns (uint256)
    {
        return _calculatePremium(policyType, coverageAmount, coveragePeriod);
    }

    /**
     * @dev Calculate premium internally
     */
    function _calculatePremium(PolicyType policyType, uint256 coverageAmount, uint256 coveragePeriod)
        internal
        pure
        returns (uint256)
    {
        uint256 baseRate;
        if (policyType == PolicyType.SMART_CONTRACT_EXPLOIT) baseRate = EXPLOIT_PREMIUM_RATE;
        else if (policyType == PolicyType.IMPERMANENT_LOSS) baseRate = IL_PREMIUM_RATE;
        else if (policyType == PolicyType.FLASH_LOAN_ATTACK) baseRate = FLASH_PREMIUM_RATE;
        else if (policyType == PolicyType.GOVERNANCE_ATTACK) baseRate = GOVERNANCE_PREMIUM_RATE;
        else if (policyType == PolicyType.BRIDGE_EXPLOIT) baseRate = BRIDGE_PREMIUM_RATE;
        else if (policyType == PolicyType.WALLET_COMPROMISE) baseRate = WALLET_PREMIUM_RATE;
        else revert("Invalid policy type");

        // Calculate annual premium
        uint256 annualPremium = (coverageAmount * baseRate) / 10000;

        // Adjust for coverage period
        uint256 periodPremium = (annualPremium * coveragePeriod) / 365 days;

        return periodPremium;
    }

    /**
     * @dev Validate insurance claim
     */
    function _validateClaim(PolicyType, address, string memory evidence, bytes memory) internal pure returns (bool) {
        if (bytes(evidence).length == 0) return false;
        if (bytes(evidence).length < 32) return false;
        return true;
    }

    /**
     * @dev Process insurance payout
     */
    function _processPayout(uint256 policyId, uint256 payoutAmount) internal {
        // Transfer payout from reserve
        require(payoutToken.balanceOf(address(this)) >= payoutAmount, "Insufficient payout reserve");

        InsurancePolicy memory policy = policies[policyId];
        require(payoutToken.transfer(policy.policyHolder, payoutAmount), "Payout transfer failed");

        totalClaimsPaid += payoutAmount;

        emit ClaimApproved(policyId, payoutAmount);
    }

    /**
     * @dev Calculate utilization rate
     */
    function _calculateUtilizationRate(PolicyType policyType) internal view returns (uint256) {
        InsurancePool memory pool = insurancePools[policyType];
        if (pool.totalPremiums == 0) return 0;

        // Utilization = claims paid / premiums collected
        return (totalClaimsPaid * 10000) / totalPremiumsCollected;
    }

    /**
     * @dev Initialize insurance pools
     */
    function _initializeInsurancePools() internal {
        insurancePools[PolicyType.SMART_CONTRACT_EXPLOIT] = InsurancePool({
            policyType: PolicyType.SMART_CONTRACT_EXPLOIT,
            totalCoverage: 0,
            totalPremiums: 0,
            claimReserve: 0,
            utilizationRate: 0,
            isActive: true
        });

        insurancePools[PolicyType.IMPERMANENT_LOSS] = InsurancePool({
            policyType: PolicyType.IMPERMANENT_LOSS,
            totalCoverage: 0,
            totalPremiums: 0,
            claimReserve: 0,
            utilizationRate: 0,
            isActive: true
        });

        // Initialize other pools similarly...
    }

    /**
     * @notice Emergency pause pool
     */
    function emergencyPause(PolicyType policyType) external onlyOwner {
        insurancePools[policyType].isActive = false;
    }

    /**
     * @notice Withdraw excess premiums (owner only)
     */
    function withdrawExcessPremiums(uint256 amount) external onlyOwner {
        require(premiumToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        require(premiumToken.transfer(owner(), amount), "Transfer failed");
    }
}
