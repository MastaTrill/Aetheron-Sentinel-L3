// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentinelInsuranceMarketplace
 * @notice Decentralized Insurance Marketplace - Buy/sell insurance policies with automated pricing
 */
contract SentinelInsuranceMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken; // AETH
    address public immutable insurancePool;

    // Insurance offering structure
    struct InsuranceOffering {
        uint256 offeringId;
        address provider;
        string coverageType; // "smart-contract", "impermanent-loss", "flash-loan", etc.
        uint256 coverageAmount;
        uint256 premiumAmount;
        uint256 duration;
        uint256 maxCapacity;
        uint256 currentCapacity;
        bool isActive;
        uint256 utilizationRate;
        uint256 rating; // Provider rating out of 100
    }

    // Policy purchase
    struct MarketPolicy {
        uint256 policyId;
        uint256 offeringId;
        address buyer;
        uint256 coverageAmount;
        uint256 premiumPaid;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isClaimed;
    }

    // Liquidity pool for premium backing
    struct LiquidityPool {
        uint256 totalLiquidity;
        uint256 utilizedLiquidity;
        uint256 apy; // Annual percentage yield for liquidity providers
        mapping(address => uint256) providerBalances;
        mapping(address => uint256) providerRewards;
    }

    mapping(uint256 => InsuranceOffering) public offerings;
    mapping(uint256 => MarketPolicy) public policies;
    mapping(string => uint256[]) public offeringsByType;

    LiquidityPool public liquidityPool;

    uint256 public nextOfferingId = 1;
    uint256 public nextPolicyId = 1;
    uint256 public marketplaceFee = 200; // 2% marketplace fee (basis points)
    uint256 public totalPremiums = 0;
    uint256 public totalCoverageProvided = 0;

    event OfferingCreated(uint256 indexed offeringId, address indexed provider, string coverageType);
    event PolicyPurchased(uint256 indexed policyId, uint256 indexed offeringId, address indexed buyer);
    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed provider, uint256 amount);
    event ClaimProcessed(uint256 indexed policyId, uint256 payoutAmount);

    constructor(address _paymentToken, address _insurancePool) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        insurancePool = _insurancePool;
    }

    /**
     * @notice Create insurance offering
     */
    function createOffering(
        string memory coverageType,
        uint256 coverageAmount,
        uint256 premiumAmount,
        uint256 duration,
        uint256 maxCapacity
    ) external returns (uint256) {
        require(coverageAmount > 0, "Invalid coverage amount");
        require(premiumAmount > 0, "Invalid premium amount");
        require(duration > 0, "Invalid duration");
        require(maxCapacity > 0, "Invalid max capacity");

        uint256 offeringId = nextOfferingId++;

        offerings[offeringId] = InsuranceOffering({
            offeringId: offeringId,
            provider: msg.sender,
            coverageType: coverageType,
            coverageAmount: coverageAmount,
            premiumAmount: premiumAmount,
            duration: duration,
            maxCapacity: maxCapacity,
            currentCapacity: 0,
            isActive: true,
            utilizationRate: 0,
            rating: _calculateProviderRating(msg.sender)
        });

        offeringsByType[coverageType].push(offeringId);

        emit OfferingCreated(offeringId, msg.sender, coverageType);

        return offeringId;
    }

    /**
     * @notice Purchase insurance policy
     */
    function purchasePolicy(uint256 offeringId, uint256 coverageAmount) external nonReentrant {
        InsuranceOffering storage offering = offerings[offeringId];
        require(offering.isActive, "Offering not active");
        require(offering.currentCapacity + coverageAmount <= offering.maxCapacity, "Exceeds capacity");

        uint256 premiumAmount = (coverageAmount * offering.premiumAmount) / offering.coverageAmount;
        uint256 marketplaceFeeAmount = (premiumAmount * marketplaceFee) / 10000;
        uint256 providerAmount = premiumAmount - marketplaceFeeAmount;

        // Transfer premium payment
        require(paymentToken.transferFrom(msg.sender, address(this), premiumAmount), "Premium transfer failed");

        uint256 policyId = nextPolicyId++;

        policies[policyId] = MarketPolicy({
            policyId: policyId,
            offeringId: offeringId,
            buyer: msg.sender,
            coverageAmount: coverageAmount,
            premiumPaid: premiumAmount,
            startTime: block.timestamp,
            endTime: block.timestamp + offering.duration,
            isActive: true,
            isClaimed: false
        });

        // Update offering capacity
        offering.currentCapacity += coverageAmount;
        offering.utilizationRate = (offering.currentCapacity * 10000) / offering.maxCapacity;

        // Update global stats
        totalPremiums += premiumAmount;
        totalCoverageProvided += coverageAmount;

        // Distribute payments
        require(paymentToken.transfer(offering.provider, providerAmount), "Provider payment failed");
        require(paymentToken.transfer(owner(), marketplaceFeeAmount), "Marketplace fee transfer failed");

        emit PolicyPurchased(policyId, offeringId, msg.sender);
    }

    /**
     * @notice Add liquidity to backing pool
     */
    function addLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Liquidity transfer failed");

        liquidityPool.totalLiquidity += amount;
        liquidityPool.providerBalances[msg.sender] += amount;

        emit LiquidityAdded(msg.sender, amount);
    }

    /**
     * @notice Remove liquidity from pool
     */
    function removeLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(liquidityPool.providerBalances[msg.sender] >= amount, "Insufficient balance");
        require(
            liquidityPool.totalLiquidity - liquidityPool.utilizedLiquidity >= amount, "Insufficient available liquidity"
        );

        liquidityPool.totalLiquidity -= amount;
        liquidityPool.providerBalances[msg.sender] -= amount;

        // Calculate and distribute rewards
        uint256 rewards = _calculateRewards(msg.sender, amount);
        if (rewards > 0) {
            liquidityPool.providerRewards[msg.sender] += rewards;
        }

        require(paymentToken.transfer(msg.sender, amount + rewards), "Liquidity withdrawal failed");

        emit LiquidityRemoved(msg.sender, amount);
    }

    /**
     * @notice File insurance claim
     */
    function fileClaim(uint256 policyId, string memory evidence) external nonReentrant {
        MarketPolicy storage policy = policies[policyId];
        require(policy.buyer == msg.sender, "Not policy owner");
        require(policy.isActive, "Policy not active");
        require(!policy.isClaimed, "Claim already filed");
        require(policy.endTime > block.timestamp, "Policy expired");

        InsuranceOffering memory offering = offerings[policy.offeringId];

        // Validate claim (simplified)
        require(_validateClaim(offering.coverageType, evidence), "Invalid claim");

        // Process payout
        _processPayout(policyId, policy.coverageAmount);

        policy.isClaimed = true;
        policy.isActive = false;

        emit ClaimProcessed(policyId, policy.coverageAmount);
    }

    /**
     * @notice Get offerings by type
     */
    function getOfferingsByType(string memory coverageType) external view returns (uint256[] memory) {
        return offeringsByType[coverageType];
    }

    /**
     * @notice Get marketplace statistics
     */
    function getMarketStats()
        external
        view
        returns (uint256 totalOfferings, uint256 totalPolicies, uint256 totalLiquidity, uint256 totalCoverage)
    {
        uint256 offeringCount = nextOfferingId - 1;
        uint256 policyCount = nextPolicyId - 1;

        return (offeringCount, policyCount, liquidityPool.totalLiquidity, totalCoverageProvided);
    }

    /**
     * @notice Calculate provider rating
     */
    function _calculateProviderRating(address) internal pure returns (uint256) {
        // Simplified rating calculation
        // In production, this would be based on past performance
        return 85; // Default good rating
    }

    /**
     * @notice Calculate liquidity provider rewards
     */
    function _calculateRewards(address provider, uint256 amount) internal view returns (uint256) {
        uint256 providerShare = (liquidityPool.providerBalances[provider] * 10000) / liquidityPool.totalLiquidity;
        uint256 timeWeightedShare = providerShare * 365 days; // Simplified

        return (amount * liquidityPool.apy * timeWeightedShare) / (10000 * 365 days);
    }

    /**
     * @notice Validate insurance claim
     * @dev Requires non-empty evidence and minimum evidence length to prevent trivial claims
     */
    function _validateClaim(string memory coverageType, string memory evidence) internal pure returns (bool) {
        if (bytes(evidence).length == 0) return false;
        if (bytes(evidence).length < 32) return false;
        // Additional validation: evidence must not be a simple repeated character
        bytes memory evidenceBytes = bytes(evidence);
        bool allSame = true;
        for (uint256 i = 1; i < evidenceBytes.length; i++) {
            if (evidenceBytes[i] != evidenceBytes[0]) {
                allSame = false;
                break;
            }
        }
        if (allSame) return false;
        return true;
    }

    /**
     * @notice Process insurance payout
     */
    function _processPayout(uint256, uint256 payoutAmount) internal {
        // Ensure sufficient liquidity
        require(liquidityPool.totalLiquidity >= payoutAmount, "Insufficient liquidity");

        liquidityPool.utilizedLiquidity += payoutAmount;

        // Transfer payout (simplified - would use actual payout token)
        // require(payoutToken.transfer(policies[policyId].buyer, payoutAmount), "Payout failed");
    }

    /**
     * @notice Set marketplace fee
     */
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        marketplaceFee = newFee;
    }

    /**
     * @notice Update liquidity pool APY
     */
    function updatePoolAPY(uint256 newAPY) external onlyOwner {
        liquidityPool.apy = newAPY;
    }
}
