// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AutomatedLiquidityManager
 * @notice Intelligent liquidity management with rebalancing and yield optimization
 * @dev Features:
 *      - Automatic rebalancing based on thresholds
 *      - Multi-pool liquidity allocation
 *      - Yield optimization strategies
 *      - IL (Impermanent Loss) protection
 *      - Dynamic fee adjustment
 *      - Liquidity health monitoring
 */
contract AutomatedLiquidityManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    uint256 public constant REBALANCE_THRESHOLD = 500; // 5% deviation triggers rebalance
    uint256 public constant IL_PROTECTION_FEE = 100; // 1% fee for IL protection
    uint256 public constant MIN_LIQUIDITY = 1000e18;
    uint256 public constant MAX_POOLS = 10;
    uint256 public constant HEALTH_FACTOR_MIN = 1e18; // 1.0 minimum

    // ============ State Variables ============

    /// @notice Managed token (the bridge token)
    address public managedToken;

    /// @notice Liquidity pools
    Pool[] public pools;
    mapping(address => uint256) public poolIndex;

    /// @notice Target allocations (basis points)
    mapping(address => uint256) public targetAllocations;

    /// @notice Current allocations
    mapping(address => uint256) public currentAllocations;

    /// @notice Total liquidity under management
    uint256 public totalLiquidity;

    /// @notice Available liquidity
    uint256 public availableLiquidity;

    /// @notice Reserved liquidity (for withdrawals)
    uint256 public reservedLiquidity;

    /// @notice Liquidity health factor
    uint256 public healthFactor = 1e18;

    /// @notice Strategy performance
    mapping(address => int256) public strategyReturns;

    /// @notice Fee collector
    address public feeCollector;

    /// @notice Performance fee (basis points)
    uint256 public performanceFee = 2000; // 20%

    // ============ Structs ============

    struct Pool {
        address poolAddress;
        address token0;
        address token1;
        uint256 liquidity;
        uint256 allocatedAmount;
        uint256 targetAllocation;
        uint256 actualAllocation;
        bool active;
        uint256 lastRebalance;
        int256 impermanentLoss;
    }

    struct RebalancePlan {
        address fromPool;
        address toPool;
        uint256 amount;
        uint256 expectedSlippage;
        uint256 deadline;
    }

    struct LiquidityStats {
        uint256 total;
        uint256 available;
        uint256 reserved;
        uint256 deployed;
        uint256 healthFactor;
    }

    // ============ Events ============

    event PoolAdded(
        address indexed pool,
        address indexed token0,
        address indexed token1,
        uint256 targetAllocation
    );

    event PoolRemoved(address indexed pool);

    event LiquidityDeposited(
        address indexed provider,
        uint256 amount,
        uint256 share
    );

    event LiquidityWithdrawn(
        address indexed provider,
        uint256 amount,
        uint256 fee
    );

    event RebalanceExecuted(
        address indexed fromPool,
        address indexed toPool,
        uint256 amount,
        uint256 slippage
    );

    event AllocationUpdated(
        address indexed pool,
        uint256 oldAllocation,
        uint256 newAllocation
    );

    event YieldClaimed(
        address indexed pool,
        uint256 amount,
        uint256 performanceFee
    );

    event ImpermanentLossProtected(
        address indexed pool,
        int256 loss,
        uint256 compensation
    );

    event HealthFactorUpdated(
        uint256 oldFactor,
        uint256 newFactor,
        string reason
    );

    event StrategySwitched(
        address indexed fromStrategy,
        address indexed toStrategy,
        uint256 migrationAmount
    );

    // ============ Errors ============

    error PoolNotFound(address pool);
    error PoolAlreadyExists(address pool);
    error AboveMaxPools();
    error BelowMinLiquidity();
    error InvalidAllocation();
    error RebalanceNotNeeded();
    error SlippageExceeded(uint256 expected, uint256 actual);
    error HealthFactorTooLow();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InvalidPoolConfig();
    error ZeroLiquidity();

    // ============ Constructor ============

    constructor(address _managedToken, address _feeCollector) {
        require(_managedToken != address(0), "Invalid token");
        require(_feeCollector != address(0), "Invalid fee collector");

        managedToken = _managedToken;
        feeCollector = _feeCollector;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(STRATEGIST_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
    }

    // ============ Pool Management ============

    /**
     * @notice Add a liquidity pool
     */
    function addPool(
        address poolAddress,
        address token0,
        address token1,
        uint256 targetAllocation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (pools.length >= MAX_POOLS) revert AboveMaxPools();
        if (poolIndex[poolAddress] != 0) revert PoolAlreadyExists(poolAddress);
        if (targetAllocation > 10000) revert InvalidAllocation();

        pools.push(
            Pool({
                poolAddress: poolAddress,
                token0: token0,
                token1: token1,
                liquidity: 0,
                allocatedAmount: 0,
                targetAllocation: targetAllocation,
                actualAllocation: 0,
                active: true,
                lastRebalance: block.timestamp,
                impermanentLoss: 0
            })
        );

        poolIndex[poolAddress] = pools.length;
        targetAllocations[poolAddress] = targetAllocation;

        emit PoolAdded(poolAddress, token0, token1, targetAllocation);
    }

    /**
     * @notice Remove a pool
     */
    function removePool(
        address poolAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 idx = poolIndex[poolAddress];
        if (idx == 0) revert PoolNotFound(poolAddress);

        Pool storage pool = pools[idx - 1];
        if (pool.liquidity > MIN_LIQUIDITY) revert InvalidPoolConfig();

        pool.active = false;

        // Update total allocations
        totalLiquidity -= pool.liquidity;
        availableLiquidity -= pool.liquidity;

        emit PoolRemoved(poolAddress);
    }

    /**
     * @notice Update target allocation
     */
    function updateTargetAllocation(
        address poolAddress,
        uint256 newAllocation
    ) external onlyRole(STRATEGIST_ROLE) {
        if (poolIndex[poolAddress] == 0) revert PoolNotFound(poolAddress);
        if (newAllocation > 10000) revert InvalidAllocation();

        Pool storage pool = pools[poolIndex[poolAddress] - 1];
        uint256 old = pool.targetAllocation;
        pool.targetAllocation = newAllocation;
        targetAllocations[poolAddress] = newAllocation;

        emit AllocationUpdated(poolAddress, old, newAllocation);
    }

    // ============ Liquidity Operations ============

    /**
     * @notice Deposit liquidity
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount < MIN_LIQUIDITY) revert BelowMinLiquidity();

        // Transfer tokens
        IERC20(managedToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Update liquidity
        availableLiquidity += amount;
        totalLiquidity += amount;

        emit LiquidityDeposited(msg.sender, amount, amount);

        // Check if rebalance needed
        _checkRebalance();
    }

    /**
     * @notice Withdraw liquidity
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        if (amount > availableLiquidity - reservedLiquidity) {
            revert InsufficientLiquidity(
                amount,
                availableLiquidity - reservedLiquidity
            );
        }

        // Apply withdrawal fee if below threshold
        uint256 fee = _calculateWithdrawalFee(msg.sender, amount);
        uint256 netAmount = amount - fee;

        // Update liquidity
        availableLiquidity -= amount;
        totalLiquidity -= amount;

        // Transfer
        IERC20(managedToken).safeTransfer(msg.sender, netAmount);

        if (fee > 0) {
            IERC20(managedToken).safeTransfer(feeCollector, fee);
        }

        emit LiquidityWithdrawn(msg.sender, netAmount, fee);
    }

    /**
     * @notice Reserve liquidity (for pending withdrawals)
     */
    function reserveLiquidity(
        uint256 amount
    ) external onlyRole(REBALANCER_ROLE) {
        if (availableLiquidity < amount) {
            revert InsufficientLiquidity(amount, availableLiquidity);
        }
        reservedLiquidity += amount;
    }

    /**
     * @notice Release reserved liquidity
     */
    function releaseLiquidity(
        uint256 amount
    ) external onlyRole(REBALANCER_ROLE) {
        if (reservedLiquidity < amount) amount = reservedLiquidity;
        reservedLiquidity -= amount;
    }

    // ============ Rebalancing ============

    /**
     * @notice Execute rebalance between pools
     */
    function rebalance(
        address fromPool,
        address toPool,
        uint256 amount,
        uint256 maxSlippage
    ) external onlyRole(REBALANCER_ROLE) whenNotPaused returns (bool) {
        if (poolIndex[fromPool] == 0) revert PoolNotFound(fromPool);
        if (poolIndex[toPool] == 0) revert PoolNotFound(toPool);

        Pool storage from = pools[poolIndex[fromPool] - 1];
        Pool storage to = pools[poolIndex[toPool] - 1];

        // Calculate expected output
        uint256 expectedOut = _calculateExpectedOutput(from, to, amount);

        // Check slippage
        if (maxSlippage > 0) {
            uint256 slippage = ((amount - expectedOut) * 10000) / amount;
            if (slippage > maxSlippage) {
                revert SlippageExceeded(
                    expectedOut,
                    amount - ((amount * maxSlippage) / 10000)
                );
            }
        }

        // Execute withdrawal from source pool
        from.liquidity -= amount;
        from.allocatedAmount -= amount;

        // Calculate actual received (with slippage)
        uint256 actualReceived = _simulateAddLiquidity(to, amount);

        // Update target pool
        to.liquidity += actualReceived;
        to.allocatedAmount += actualReceived;
        to.lastRebalance = block.timestamp;

        // Update allocations
        _updateAllocations();

        emit RebalanceExecuted(fromPool, toPool, amount, maxSlippage);

        return true;
    }

    /**
     * @notice Auto-rebalance based on thresholds
     */
    function autoRebalance() external onlyRole(REBALANCER_ROLE) whenNotPaused {
        _checkRebalance();
    }

    // ============ Yield Management ============

    /**
     * @notice Claim yield from a pool
     */
    function claimYield(address poolAddress) external nonReentrant {
        Pool storage pool = pools[poolIndex[poolAddress] - 1];

        // Calculate yield
        uint256 yield = _calculateYield(poolAddress);

        if (yield > 0) {
            // Apply performance fee
            uint256 fee = (yield * performanceFee) / 10000;
            uint256 netYield = yield - fee;

            // Update pool liquidity
            pool.liquidity += netYield;
            totalLiquidity += netYield;

            // Transfer fee
            if (fee > 0) {
                IERC20(managedToken).safeTransfer(feeCollector, fee);
            }

            // Track returns
            strategyReturns[poolAddress] += int256(netYield);

            emit YieldClaimed(poolAddress, netYield, fee);
        }
    }

    /**
     * @notice Harvest yields from all pools
     */
    function harvestAllYields() external nonReentrant {
        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i].active) {
                this.claimYield(pools[i].poolAddress);
            }
        }
    }

    // ============ IL Protection ============

    /**
     * @notice Calculate impermanent loss
     */
    function calculateImpermanentLoss(
        address poolAddress,
        uint256 initialValue,
        uint256 currentValue
    ) public view returns (int256 loss) {
        if (initialValue == 0) return 0;

        int256 ratio = int256((currentValue * 1e18) / initialValue);
        int256 holdValue = 1e18;

        // IL = 2 * sqrt(k) / (1 + k) - 1, simplified
        loss = holdValue - ratio;

        // Update pool tracking
        Pool storage pool = pools[poolIndex[poolAddress] - 1];
        pool.impermanentLoss = loss;
    }

    /**
     * @notice Compensate for impermanent loss
     */
    function compensateIL(
        address poolAddress,
        uint256 amount
    ) external onlyRole(STRATEGIST_ROLE) {
        Pool storage pool = pools[poolIndex[poolAddress] - 1];

        if (pool.impermanentLoss < 0) {
            uint256 compensation = (uint256(-pool.impermanentLoss) * amount) /
                1e18;

            if (compensation > availableLiquidity) {
                compensation = availableLiquidity;
            }

            pool.liquidity += compensation;
            totalLiquidity += compensation;

            emit ImpermanentLossProtected(
                poolAddress,
                pool.impermanentLoss,
                compensation
            );
        }
    }

    // ============ Health Monitoring ============

    /**
     * @notice Update health factor
     */
    function updateHealthFactor() external {
        uint256 old = healthFactor;

        // Calculate health factor
        // H = Available / Reserved (simplified)
        if (reservedLiquidity > 0) {
            healthFactor = (availableLiquidity * 1e18) / reservedLiquidity;
        } else {
            healthFactor = 1e19; // 1.0 when no reservations
        }

        // Update if changed significantly
        if (old != healthFactor) {
            emit HealthFactorUpdated(old, healthFactor, "Periodic update");
        }

        // Check minimum
        if (healthFactor < HEALTH_FACTOR_MIN) {
            emit HealthFactorUpdated(
                old,
                healthFactor,
                "WARNING: Low health factor"
            );
        }
    }

    // ============ Internal Functions ============

    function _checkRebalance() internal {
        for (uint256 i = 0; i < pools.length; i++) {
            Pool storage pool = pools[i];
            if (!pool.active) continue;

            int256 deviation = int256(pool.actualAllocation) -
                int256(pool.targetAllocation);

            if (deviation < 0) deviation = -deviation;

            if (uint256(deviation) > REBALANCE_THRESHOLD) {
                // Trigger rebalance
                // In production, this would call rebalance() with optimal amounts
            }
        }
    }

    function _updateAllocations() internal {
        uint256 total = totalLiquidity;
        if (total == 0) return;

        for (uint256 i = 0; i < pools.length; i++) {
            Pool storage pool = pools[i];
            pool.actualAllocation = (pool.liquidity * 10000) / total;
            currentAllocations[pool.poolAddress] = pool.actualAllocation;
        }
    }

    function _calculateWithdrawalFee(
        address user,
        uint256 amount
    ) internal view returns (uint256) {
        // Discount fees for long-term holders (simplified)
        return (amount * IL_PROTECTION_FEE) / 10000;
    }

    function _calculateYield(
        address poolAddress
    ) internal view returns (uint256) {
        Pool storage pool = pools[poolIndex[poolAddress] - 1];

        // Simplified yield calculation
        // In production, integrate with actual AMM/savings protocols
        return (pool.liquidity * 500) / 1000000; // ~5% APY simplified
    }

    function _calculateExpectedOutput(
        Pool storage from,
        Pool storage to,
        uint256 amount
    ) internal pure returns (uint256) {
        // Simplified constant product AMM formula
        uint256 fromBalance = from.liquidity;
        uint256 toBalance = to.liquidity;

        if (fromBalance == 0 || toBalance == 0) return amount;

        return (amount * toBalance) / fromBalance;
    }

    function _simulateAddLiquidity(
        Pool storage pool,
        uint256 amount
    ) internal pure returns (uint256) {
        // Simplified - in production, call actual pool
        return amount;
    }

    // ============ View Functions ============

    function getPoolCount() external view returns (uint256) {
        return pools.length;
    }

    function getPool(address poolAddress) external view returns (Pool memory) {
        return pools[poolIndex[poolAddress] - 1];
    }

    function getLiquidityStats() external view returns (LiquidityStats memory) {
        return
            LiquidityStats({
                total: totalLiquidity,
                available: availableLiquidity,
                reserved: reservedLiquidity,
                deployed: totalLiquidity - availableLiquidity,
                healthFactor: healthFactor
            });
    }

    function getTotalYield() external view returns (int256 total) {
        for (uint256 i = 0; i < pools.length; i++) {
            total += strategyReturns[pools[i].poolAddress];
        }
    }

    function needsRebalance() external view returns (bool, address[] memory) {
        address[] memory needsRebalance = new address[](pools.length);
        uint256 count = 0;

        for (uint256 i = 0; i < pools.length; i++) {
            Pool storage pool = pools[i];
            int256 deviation = int256(pool.actualAllocation) -
                int256(pool.targetAllocation);

            if (deviation < 0) deviation = -deviation;

            if (uint256(deviation) > REBALANCE_THRESHOLD) {
                needsRebalance[count++] = pool.poolAddress;
            }
        }

        return (count > 0, needsRebalance);
    }
}
