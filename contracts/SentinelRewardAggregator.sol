// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SentinelRewardAggregator
 * @notice Unified reward system aggregating all APY sources for 3.0-5.0% returns
 * Combines staking, liquidity mining, governance, referrals, and security rewards
 */
contract SentinelRewardAggregator is Ownable, ReentrancyGuard {
    // System contracts
    address public stakingContract;
    address public liquidityMiningContract;
    address public governanceTokenContract;
    address public referralSystemContract;

    struct UserRewards {
        uint256 stakingRewards;
        uint256 liquidityRewards;
        uint256 governanceRewards;
        uint256 referralRewards;
        uint256 securityRewards;
        uint256 totalAPY;
        uint256 lastUpdate;
    }

    struct SystemAPY {
        uint256 stakingAPY;
        uint256 liquidityAPY;
        uint256 governanceAPY;
        uint256 referralAPY;
        uint256 securityAPY;
        uint256 totalAPY;
        uint256 timestamp;
    }

    // Reward tracking
    mapping(address => UserRewards) public userRewards;
    SystemAPY public currentSystemAPY;

    // APY Enhancement Features
    uint256 public constant BASE_APY = 300; // 3.0% base
    uint256 public constant MAX_APY = 500;  // 5.0% maximum
    uint256 public constant STAKING_WEIGHT = 40; // 40% weight
    uint256 public constant LIQUIDITY_WEIGHT = 30; // 30% weight
    uint256 public constant GOVERNANCE_WEIGHT = 15; // 15% weight
    uint256 public constant REFERRAL_WEIGHT = 10; // 10% weight
    uint256 public constant SECURITY_WEIGHT = 5;  // 5% weight

    // Performance multipliers
    uint256 public performanceMultiplier = 100; // 1x base
    uint256 public constant MAX_MULTIPLIER = 150; // 1.5x max

    event RewardsUpdated(address indexed user, UserRewards rewards);
    event SystemAPYUpdated(SystemAPY newAPY);
    event RewardClaimed(address indexed user, uint256 amount, string rewardType);

    constructor(
        address _stakingContract,
        address _liquidityMiningContract,
        address _governanceTokenContract,
        address _referralSystemContract
    ) {
        stakingContract = _stakingContract;
        liquidityMiningContract = _liquidityMiningContract;
        governanceTokenContract = _governanceTokenContract;
        referralSystemContract = _referralSystemContract;

        _updateSystemAPY();
    }

    /**
     * @notice Update user's reward information from all sources
     * @param user User address to update
     */
    function updateUserRewards(address user) external nonReentrant {
        // In a real implementation, these would be contract calls
        // For demo purposes, we'll simulate reward aggregation

        UserRewards storage rewards = userRewards[user];

        // Simulate getting rewards from different contracts
        rewards.stakingRewards = _getStakingRewards(user);
        rewards.liquidityRewards = _getLiquidityRewards(user);
        rewards.governanceRewards = _getGovernanceRewards(user);
        rewards.referralRewards = _getReferralRewards(user);
        rewards.securityRewards = _getSecurityRewards(user);

        // Calculate total APY
        rewards.totalAPY = _calculateUserAPY(user);
        rewards.lastUpdate = block.timestamp;

        emit RewardsUpdated(user, rewards);
    }

    /**
     * @notice Get user's total APY across all systems
     * @param user User address
     */
    function getUserTotalAPY(address user) external view returns (uint256) {
        return _calculateUserAPY(user);
    }

    /**
     * @notice Get user's reward breakdown
     * @param user User address
     */
    function getUserRewardBreakdown(address user) external view returns (
        uint256 stakingAPY,
        uint256 liquidityAPY,
        uint256 governanceAPY,
        uint256 referralAPY,
        uint256 securityAPY,
        uint256 totalAPY
    ) {
        // In real implementation, call individual contracts
        uint256 staking = _simulateStakingAPY(user);
        uint256 liquidity = _simulateLiquidityAPY(user);
        uint256 governance = _simulateGovernanceAPY(user);
        uint256 referral = _simulateReferralAPY(user);
        uint256 security = _simulateSecurityAPY(user);

        uint256 total = _calculateWeightedAPY(staking, liquidity, governance, referral, security);

        return (staking, liquidity, governance, referral, security, total);
    }

    /**
     * @notice Claim all available rewards
     * @param user User address
     */
    function claimAllRewards(address user) external nonReentrant {
        require(msg.sender == user || msg.sender == owner(), "Unauthorized");

        UserRewards storage rewards = userRewards[user];

        // Claim from individual systems (simulated)
        uint256 totalClaimed = rewards.stakingRewards + rewards.liquidityRewards +
                              rewards.governanceRewards + rewards.referralRewards +
                              rewards.securityRewards;

        if (totalClaimed > 0) {
            // Reset rewards
            rewards.stakingRewards = 0;
            rewards.liquidityRewards = 0;
            rewards.governanceRewards = 0;
            rewards.referralRewards = 0;
            rewards.securityRewards = 0;

            emit RewardClaimed(user, totalClaimed, "all");
        }
    }

    /**
     * @notice Update system-wide APY metrics
     */
    function updateSystemAPY() external onlyOwner {
        _updateSystemAPY();
    }

    /**
     * @notice Get current system APY
     */
    function getSystemAPY() external view returns (SystemAPY memory) {
        return currentSystemAPY;
    }

    /**
     * @notice Calculate performance multiplier based on system health
     */
    function updatePerformanceMultiplier(uint256 systemHealthScore) external onlyOwner {
        // System health score from 0-100
        if (systemHealthScore >= 95) {
            performanceMultiplier = MAX_MULTIPLIER; // 1.5x
        } else if (systemHealthScore >= 90) {
            performanceMultiplier = 125; // 1.25x
        } else if (systemHealthScore >= 80) {
            performanceMultiplier = 110; // 1.1x
        } else {
            performanceMultiplier = 100; // 1x
        }
    }

    /**
     * @notice Simulate staking APY (would call actual contract)
     */
    function _simulateStakingAPY(address user) internal pure returns (uint256) {
        // Simulate tier-based APY: 2.89% to 5.0%
        return 350; // 3.5% average
    }

    /**
     * @notice Simulate liquidity mining APY
     */
    function _simulateLiquidityAPY(address user) internal pure returns (uint256) {
        // 3.0% to 5.0% based on pool and boost
        return 400; // 4.0% average
    }

    /**
     * @notice Simulate governance APY
     */
    function _simulateGovernanceAPY(address user) internal pure returns (uint256) {
        // 3.0% base + participation bonuses
        return 325; // 3.25% with participation
    }

    /**
     * @notice Simulate referral APY
     */
    function _simulateReferralAPY(address user) internal pure returns (uint256) {
        // 0.5% to 2.0% based on network size
        return 100; // 1.0% average
    }

    /**
     * @notice Simulate security APY
     */
    function _simulateSecurityAPY(address user) internal pure returns (uint256) {
        // Bonuses for security participation
        return 75; // 0.75% average
    }

    /**
     * @notice Calculate weighted APY from all sources
     */
    function _calculateWeightedAPY(
        uint256 staking,
        uint256 liquidity,
        uint256 governance,
        uint256 referral,
        uint256 security
    ) internal pure returns (uint256) {
        uint256 weightedAPY = (
            staking * STAKING_WEIGHT +
            liquidity * LIQUIDITY_WEIGHT +
            governance * GOVERNANCE_WEIGHT +
            referral * REFERRAL_WEIGHT +
            security * SECURITY_WEIGHT
        ) / 100;

        // Apply performance multiplier
        weightedAPY = (weightedAPY * 100) / 100; // Simplified

        return weightedAPY > MAX_APY ? MAX_APY : weightedAPY;
    }

    /**
     * @notice Calculate user's total APY
     */
    function _calculateUserAPY(address user) internal view returns (uint256) {
        uint256 staking = _simulateStakingAPY(user);
        uint256 liquidity = _simulateLiquidityAPY(user);
        uint256 governance = _simulateGovernanceAPY(user);
        uint256 referral = _simulateReferralAPY(user);
        uint256 security = _simulateSecurityAPY(user);

        uint256 totalAPY = _calculateWeightedAPY(staking, liquidity, governance, referral, security);

        // Apply performance multiplier
        totalAPY = (totalAPY * performanceMultiplier) / 100;

        return totalAPY > MAX_APY ? MAX_APY : totalAPY;
    }

    /**
     * @notice Update system-wide APY metrics
     */
    function _updateSystemAPY() internal {
        // Aggregate APY from all systems
        currentSystemAPY.stakingAPY = 350; // 3.5%
        currentSystemAPY.liquidityAPY = 400; // 4.0%
        currentSystemAPY.governanceAPY = 325; // 3.25%
        currentSystemAPY.referralAPY = 100; // 1.0%
        currentSystemAPY.securityAPY = 75;  // 0.75%

        currentSystemAPY.totalAPY = _calculateWeightedAPY(
            currentSystemAPY.stakingAPY,
            currentSystemAPY.liquidityAPY,
            currentSystemAPY.governanceAPY,
            currentSystemAPY.referralAPY,
            currentSystemAPY.securityAPY
        );

        currentSystemAPY.timestamp = block.timestamp;

        emit SystemAPYUpdated(currentSystemAPY);
    }

    // Mock functions for reward calculation (would be real contract calls)
    function _getStakingRewards(address user) internal pure returns (uint256) { return 100 ether; }
    function _getLiquidityRewards(address user) internal pure returns (uint256) { return 150 ether; }
    function _getGovernanceRewards(address user) internal pure returns (uint256) { return 50 ether; }
    function _getReferralRewards(address user) internal pure returns (uint256) { return 25 ether; }
    function _getSecurityRewards(address user) internal pure returns (uint256) { return 10 ether; }
}