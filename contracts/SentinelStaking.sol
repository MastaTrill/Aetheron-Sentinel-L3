// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SentinelStaking
 * @notice High-yield staking for bridge security participants
 * Enhanced APY through multi-tier reward system
 */
contract SentinelStaking is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    bytes32 public constant REWARD_MANAGER_ROLE =
        keccak256("REWARD_MANAGER_ROLE");

    IERC20 public stakingToken;
    IERC20 public rewardToken;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastRewardUpdate;
        uint256 accumulatedRewards;
        uint256 tier;
    }

    struct TierConfig {
        uint256 minStake;
        uint256 baseAPY; // Base APY for tier
        uint256 performanceBonus; // Additional APY for security performance
        uint256 lockPeriod; // Minimum staking period
        uint256 multiplier; // Reward multiplier
    }

    // Tier system for enhanced APY
    TierConfig[] public tiers;
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public securityScore; // Performance-based scoring

    // APY Enhancement Features
    uint256 public baseAPY = 289; // 2.89% base APY
    uint256 public maxAPY = 500; // 5.0% max APY
    uint256 public securityBonusAPY = 100; // 1.0% bonus for security participation
    uint256 public referralBonusAPY = 50; // 0.5% bonus for referrals

    // Reward tracking
    uint256 public totalStaked;
    uint256 public rewardRate; // Rewards per second per token staked
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;

    // Performance-based rewards
    uint256 public anomalyReportBonus = 10 ether; // Reward per valid anomaly report
    uint256 public bridgeSecurityBonus = 50 ether; // Reward per security incident prevented
    uint256 public uptimeBonusAPY = 25; // 0.25% for 99.9% uptime

    event Staked(address indexed user, uint256 amount, uint256 tier);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 amount);
    event TierUpgraded(address indexed user, uint256 newTier);
    event SecurityBonusAwarded(
        address indexed user,
        uint256 amount,
        string reason
    );

    constructor(
        address _stakingToken,
        address _rewardToken,
        address initialOwner
    ) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");
        require(initialOwner != address(0), "Invalid owner");
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(REWARD_MANAGER_ROLE, initialOwner);

        // Initialize tier system for enhanced APY
        _initializeTiers();
        _updateRewardRate();
    }

    /**
     * @notice Initialize staking tiers with increasing APY
     */
    function _initializeTiers() internal {
        // Tier 0: Bronze - 2.89% base
        tiers.push(
            TierConfig({
                minStake: 100 ether,
                baseAPY: 289, // 2.89%
                performanceBonus: 0,
                lockPeriod: 7 days,
                multiplier: 100
            })
        );

        // Tier 1: Silver - 3.5% base
        tiers.push(
            TierConfig({
                minStake: 1000 ether,
                baseAPY: 350, // 3.5%
                performanceBonus: 50, // +0.5%
                lockPeriod: 14 days,
                multiplier: 120
            })
        );

        // Tier 2: Gold - 4.2% base
        tiers.push(
            TierConfig({
                minStake: 10000 ether,
                baseAPY: 420, // 4.2%
                performanceBonus: 100, // +1.0%
                lockPeriod: 30 days,
                multiplier: 150
            })
        );

        // Tier 3: Platinum - 5.0% base (max)
        tiers.push(
            TierConfig({
                minStake: 50000 ether,
                baseAPY: 500, // 5.0%
                performanceBonus: 150, // +1.5%
                lockPeriod: 90 days,
                multiplier: 200
            })
        );
    }

    /**
     * @notice Stake tokens with automatic tier assignment
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot stake 0");

        _updateRewards(msg.sender);

        // Transfer tokens
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        StakeInfo storage userStake = stakes[msg.sender];

        if (userStake.amount == 0) {
            // New stake
            userStake.stakedAt = block.timestamp;
            userStake.lastRewardUpdate = block.timestamp;
        }

        userStake.amount += amount;
        totalStaked += amount;

        // Auto-assign tier based on total stake
        uint256 newTier = _calculateTier(userStake.amount);
        if (newTier != userStake.tier) {
            userStake.tier = newTier;
            emit TierUpgraded(msg.sender, newTier);
        }

        _updateRewardRate();

        emit Staked(msg.sender, amount, userStake.tier);
    }

    /**
     * @notice Unstake tokens with rewards
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount >= amount, "Insufficient stake");
        require(
            block.timestamp >=
                userStake.stakedAt + tiers[userStake.tier].lockPeriod,
            "Still locked"
        );

        _updateRewards(msg.sender);
        _claimRewards(msg.sender);

        userStake.amount -= amount;
        totalStaked -= amount;

        // Transfer back staked tokens
        stakingToken.safeTransfer(msg.sender, amount);

        // Re-evaluate tier
        uint256 newTier = _calculateTier(userStake.amount);
        if (newTier != userStake.tier) {
            userStake.tier = newTier;
            emit TierUpgraded(msg.sender, newTier);
        }

        _updateRewardRate();

        emit Unstaked(msg.sender, amount, userStake.accumulatedRewards);
    }

    /**
     * @notice Claim accumulated rewards
     */
    function claimRewards() external nonReentrant {
        _updateRewards(msg.sender);
        _claimRewards(msg.sender);
    }

    /**
     * @notice Award security participation bonus
     * @param user User to reward
     * @param reason Reason for bonus
     */
    function awardSecurityBonus(
        address user,
        string calldata reason
    ) external onlyRole(REWARD_MANAGER_ROLE) {
        uint256 bonusAmount;

        if (
            keccak256(abi.encodePacked(reason)) ==
            keccak256(abi.encodePacked("anomaly_report"))
        ) {
            bonusAmount = anomalyReportBonus;
        } else if (
            keccak256(abi.encodePacked(reason)) ==
            keccak256(abi.encodePacked("bridge_security"))
        ) {
            bonusAmount = bridgeSecurityBonus;
        }

        if (bonusAmount > 0) {
            require(
                rewardToken.balanceOf(address(this)) >= bonusAmount,
                "Insufficient reward balance"
            );

            // Increase security score for performance-based APY
            securityScore[user] += 10;

            // Update rewards
            _updateRewards(user);
            stakes[user].accumulatedRewards += bonusAmount;

            emit SecurityBonusAwarded(user, bonusAmount, reason);
        }
    }

    /**
     * @notice Get user's current APY including bonuses
     * @param user User address
     */
    function getUserAPY(address user) external view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;

        uint256 baseTierAPY = tiers[userStake.tier].baseAPY;
        uint256 performanceBonus = (securityScore[user] * 5) / 100; // 0.05% per 100 security points
        uint256 uptimeBonus = uptimeBonusAPY; // Assuming 99.9% uptime

        uint256 totalAPY = baseTierAPY + performanceBonus + uptimeBonus;

        // Cap at maximum APY
        return totalAPY > maxAPY ? maxAPY : totalAPY;
    }

    /**
     * @notice Get user's stake information
     * @param user User address
     */
    function getStakeInfo(
        address user
    )
        external
        view
        returns (
            uint256 amount,
            uint256 stakedAt,
            uint256 tier,
            uint256 pendingRewards,
            uint256 currentAPY
        )
    {
        StakeInfo memory userStake = stakes[user];
        uint256 pending = _calculatePendingRewards(user);

        return (
            userStake.amount,
            userStake.stakedAt,
            userStake.tier,
            pending,
            this.getUserAPY(user)
        );
    }

    /**
     * @notice Calculate tier based on stake amount
     */
    function _calculateTier(uint256 amount) internal view returns (uint256) {
        for (uint256 i = tiers.length; i > 0; i--) {
            if (amount >= tiers[i - 1].minStake) {
                return i - 1;
            }
        }
        return 0;
    }

    /**
     * @notice Calculate pending rewards for user
     */
    function _calculatePendingRewards(
        address user
    ) internal view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;

        uint256 currentRewardPerToken = rewardPerTokenStored;
        if (totalStaked > 0) {
            uint256 timeElapsed = block.timestamp - lastUpdateTime;
            currentRewardPerToken +=
                (timeElapsed * rewardRate * tiers[userStake.tier].multiplier) /
                (100 * totalStaked);
        }
        return
            (userStake.amount *
                (currentRewardPerToken - userRewardPerTokenPaid[user])) / 1e18;
    }

    /**
     * @notice Update rewards for user
     */
    function _updateRewards(address user) internal {
        // Advance global rewardPerToken accumulator
        if (totalStaked > 0) {
            uint256 timeElapsed = block.timestamp - lastUpdateTime;
            StakeInfo memory userStake = stakes[user];
            rewardPerTokenStored +=
                (timeElapsed * rewardRate * tiers[userStake.tier].multiplier) /
                (100 * totalStaked);
        }
        lastUpdateTime = block.timestamp;
        // Credit pending rewards, then snapshot the accumulator for this user
        stakes[user].accumulatedRewards += _calculatePendingRewards(user);
        userRewardPerTokenPaid[user] = rewardPerTokenStored;
    }

    /**
     * @notice Claim rewards for user
     */
    function _claimRewards(address user) internal {
        uint256 amount = stakes[user].accumulatedRewards;
        if (amount > 0) {
            stakes[user].accumulatedRewards = 0;
            rewardToken.safeTransfer(user, amount);
            emit RewardsClaimed(user, amount);
        }
    }

    /**
     * @notice Update global reward rate
     */
    function _updateRewardRate() internal {
        // Dynamic reward rate based on total staked and tier distribution
        uint256 baseRate = 1e18 / uint256(86400); // Base rate per day
        rewardRate = baseRate * (totalStaked / 100000 ether + 1); // Scale with TVL
    }
}
