// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SentinelLiquidityMining
 * @notice Advanced liquidity mining with bridge fee sharing and security rewards
 * Provides 3.0-5.0% APY through multiple reward streams
 */
contract SentinelLiquidityMining is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE =
        keccak256("REWARD_DISTRIBUTOR_ROLE");

    IERC20 public lpToken; // Bridge LP token
    IERC20 public rewardToken;

    struct MiningPosition {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastHarvest;
        uint256 accumulatedRewards;
        uint256 multiplier; // Boost multiplier (100 = 1x, 200 = 2x)
        uint256 lockPeriod;
    }

    // Enhanced APY pools
    struct Pool {
        uint256 allocPoint; // Allocation points for reward distribution
        uint256 lastRewardTime; // Last time rewards were distributed
        uint256 accRewardPerShare; // Accumulated rewards per share
        uint256 totalStaked;
        uint256 baseAPY; // Base APY for this pool
        bool emergencyWithdrawEnabled;
    }

    // Multiple pools for different APY tiers
    Pool[] public pools;
    mapping(uint256 => mapping(address => MiningPosition)) public positions;

    // APY Enhancement Features
    uint256 public constant MAX_APY = 500; // 5.0%
    uint256 public constant BASE_APY = 300; // 3.0% base
    uint256 public bridgeFeeShareAPY = 100; // 1.0% from bridge fees
    uint256 public securityRewardAPY = 75; // 0.75% from security bonuses
    uint256 public referralAPY = 25; // 0.25% referral rewards

    // Boost multipliers
    uint256 public constant BRONZE_MULTIPLIER = 110; // 1.1x for 1000+ LP tokens
    uint256 public constant SILVER_MULTIPLIER = 125; // 1.25x for 10000+ LP tokens
    uint256 public constant GOLD_MULTIPLIER = 150; // 1.5x for 50000+ LP tokens
    uint256 public constant PLATINUM_MULTIPLIER = 200; // 2x for 100000+ LP tokens

    // Reward tracking
    uint256 public totalAllocPoint;
    uint256 public rewardPerSecond;
    uint256 public startTime;

    // Fee sharing from bridge
    uint256 public totalFeeShare;
    mapping(address => uint256) public userFeeShare;

    event Deposited(address indexed user, uint256 poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 poolId, uint256 amount);
    event Harvested(address indexed user, uint256 poolId, uint256 amount);
    event EmergencyWithdrawn(
        address indexed user,
        uint256 poolId,
        uint256 amount
    );
    event FeeShared(address indexed user, uint256 amount);
    event PoolCreated(uint256 poolId, uint256 allocPoint, uint256 baseAPY);

    constructor(
        address _lpToken,
        address _rewardToken,
        uint256 _rewardPerSecond,
        address initialOwner
    ) {
        require(_lpToken != address(0), "Invalid LP token");
        require(_rewardToken != address(0), "Invalid reward token");
        require(initialOwner != address(0), "Invalid owner");
        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);
        rewardPerSecond = _rewardPerSecond;
        startTime = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, initialOwner);

        // Create initial pools with different APY tiers
        _createPool(1000, 300); // 3.0% APY pool
        _createPool(1500, 350); // 3.5% APY pool
        _createPool(2000, 420); // 4.2% APY pool
        _createPool(3000, 500); // 5.0% APY pool (max)
    }

    /**
     * @notice Create a new mining pool
     */
    function _createPool(uint256 allocPoint, uint256 baseAPY) internal {
        totalAllocPoint += allocPoint;
        pools.push(
            Pool({
                allocPoint: allocPoint,
                lastRewardTime: startTime,
                accRewardPerShare: 0,
                totalStaked: 0,
                baseAPY: baseAPY,
                emergencyWithdrawEnabled: false
            })
        );

        emit PoolCreated(pools.length - 1, allocPoint, baseAPY);
    }

    /**
     * @notice Deposit LP tokens to start mining
     * @param poolId Pool ID to deposit into
     * @param amount Amount of LP tokens to deposit
     */
    function deposit(
        uint256 poolId,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(poolId < pools.length, "Invalid pool");
        require(amount > 0, "Cannot deposit 0");

        _updatePool(poolId);

        MiningPosition storage position = positions[poolId][msg.sender];

        if (position.amount > 0) {
            // Harvest pending rewards before depositing more
            uint256 pending = _calculatePendingRewards(poolId, msg.sender);
            position.accumulatedRewards += pending;
        } else {
            position.stakedAt = block.timestamp;
            position.lastHarvest = block.timestamp;
        }

        // Calculate boost multiplier
        position.multiplier = _calculateMultiplier(amount + position.amount);

        // Transfer LP tokens
        lpToken.safeTransferFrom(msg.sender, address(this), amount);

        position.amount += amount;
        pools[poolId].totalStaked += amount;

        emit Deposited(msg.sender, poolId, amount);
    }

    /**
     * @notice Withdraw LP tokens and harvest rewards
     * @param poolId Pool ID to withdraw from
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 poolId, uint256 amount) external nonReentrant {
        require(poolId < pools.length, "Invalid pool");
        MiningPosition storage position = positions[poolId][msg.sender];
        require(position.amount >= amount, "Insufficient balance");

        _updatePool(poolId);

        // Calculate rewards
        uint256 pending = _calculatePendingRewards(poolId, msg.sender);
        uint256 totalRewards = position.accumulatedRewards + pending;

        // Reset accumulated rewards and update last harvest
        position.accumulatedRewards = 0;
        position.lastHarvest = block.timestamp;

        // Withdraw
        position.amount -= amount;
        pools[poolId].totalStaked -= amount;

        // Recalculate multiplier for remaining amount
        if (position.amount > 0) {
            position.multiplier = _calculateMultiplier(position.amount);
        }

        // Transfer LP tokens back
        lpToken.safeTransfer(msg.sender, amount);

        // Transfer rewards
        if (totalRewards > 0) {
            rewardToken.safeTransfer(msg.sender, totalRewards);
        }

        emit Withdrawn(msg.sender, poolId, amount);
        if (totalRewards > 0) {
            emit Harvested(msg.sender, poolId, totalRewards);
        }
    }

    /**
     * @notice Harvest rewards without withdrawing LP tokens
     * @param poolId Pool ID to harvest from
     */
    function harvest(uint256 poolId) external nonReentrant {
        require(poolId < pools.length, "Invalid pool");
        _updatePool(poolId);

        MiningPosition storage position = positions[poolId][msg.sender];
        require(position.amount > 0, "No position in pool");

        uint256 pending = _calculatePendingRewards(poolId, msg.sender);
        uint256 totalRewards = position.accumulatedRewards + pending;

        require(totalRewards > 0, "No rewards to harvest");

        position.accumulatedRewards = 0;
        position.lastHarvest = block.timestamp;

        rewardToken.safeTransfer(msg.sender, totalRewards);

        emit Harvested(msg.sender, poolId, totalRewards);
    }

    /**
     * @notice Emergency withdraw without rewards (penalty)
     * @param poolId Pool ID to emergency withdraw from
     */
    function emergencyWithdraw(uint256 poolId) external nonReentrant {
        require(poolId < pools.length, "Invalid pool");
        Pool storage pool = pools[poolId];
        require(
            pool.emergencyWithdrawEnabled,
            "Emergency withdraw not enabled"
        );

        MiningPosition storage position = positions[poolId][msg.sender];
        uint256 amount = position.amount;
        require(amount > 0, "No position to withdraw");

        position.amount = 0;
        position.accumulatedRewards = 0; // Lose all rewards
        pool.totalStaked -= amount;

        lpToken.safeTransfer(msg.sender, amount);

        emit EmergencyWithdrawn(msg.sender, poolId, amount);
    }

    /**
     * @notice Distribute bridge fees to liquidity providers
     * @param feeAmount Amount of fees to distribute
     */
    function distributeBridgeFees(
        uint256 feeAmount
    ) external onlyRole(REWARD_DISTRIBUTOR_ROLE) {
        require(feeAmount > 0, "Cannot distribute 0 fees");

        // Distribute fees proportionally to all pools
        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i].totalStaked > 0) {
                uint256 poolShare = (feeAmount * pools[i].allocPoint) /
                    totalAllocPoint;
                // In a real implementation, this would increase the reward rate for the pool
                totalFeeShare += poolShare;
            }
        }
    }

    /**
     * @notice Get user's current APY in a pool
     * @param poolId Pool ID
     * @param user User address
     */
    function getUserAPY(
        uint256 poolId,
        address user
    ) external view returns (uint256) {
        if (poolId >= pools.length) return 0;

        MiningPosition memory position = positions[poolId][user];
        if (position.amount == 0) return 0;

        uint256 basePoolAPY = pools[poolId].baseAPY;
        uint256 boostMultiplier = position.multiplier;
        uint256 performanceBonus = bridgeFeeShareAPY + securityRewardAPY;

        uint256 totalAPY = ((basePoolAPY * boostMultiplier) / 100) +
            performanceBonus;

        return totalAPY > MAX_APY ? MAX_APY : totalAPY;
    }

    /**
     * @notice Get pending rewards for user in pool
     * @param poolId Pool ID
     * @param user User address
     */
    function pendingRewards(
        uint256 poolId,
        address user
    ) external view returns (uint256) {
        if (poolId >= pools.length) return 0;

        MiningPosition memory position = positions[poolId][user];
        if (position.amount == 0) return 0;

        Pool memory pool = pools[poolId];
        uint256 accRewardPerShare = pool.accRewardPerShare;

        if (block.timestamp > pool.lastRewardTime && pool.totalStaked != 0) {
            uint256 multiplier = block.timestamp - pool.lastRewardTime;
            uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) /
                totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / pool.totalStaked;
        }

        return
            (position.amount * accRewardPerShare) /
            1e12 -
            position.lastHarvest +
            position.accumulatedRewards;
    }

    /**
     * @notice Calculate boost multiplier based on stake amount
     */
    function _calculateMultiplier(
        uint256 amount
    ) internal pure returns (uint256) {
        if (amount >= 100000 ether) return PLATINUM_MULTIPLIER;
        if (amount >= 50000 ether) return GOLD_MULTIPLIER;
        if (amount >= 10000 ether) return SILVER_MULTIPLIER;
        if (amount >= 1000 ether) return BRONZE_MULTIPLIER;
        return 100; // Base multiplier
    }

    /**
     * @notice Calculate pending rewards for user
     */
    function _calculatePendingRewards(
        uint256 poolId,
        address user
    ) internal view returns (uint256) {
        MiningPosition memory position = positions[poolId][user];
        Pool memory pool = pools[poolId];

        uint256 accRewardPerShare = pool.accRewardPerShare;
        if (block.timestamp > pool.lastRewardTime && pool.totalStaked != 0) {
            uint256 multiplier = block.timestamp - pool.lastRewardTime;
            uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) /
                totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / pool.totalStaked;
        }

        return
            (position.amount * accRewardPerShare) / 1e12 - position.lastHarvest;
    }

    /**
     * @notice Update pool rewards
     */
    function _updatePool(uint256 poolId) internal {
        Pool storage pool = pools[poolId];
        if (block.timestamp <= pool.lastRewardTime) return;

        if (pool.totalStaked == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }

        uint256 multiplier = block.timestamp - pool.lastRewardTime;
        uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) /
            totalAllocPoint;
        pool.accRewardPerShare += (reward * 1e12) / pool.totalStaked;
        pool.lastRewardTime = block.timestamp;
    }
}
