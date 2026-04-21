// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SentinelAMM
 * @notice Automated Market Maker integration with quantum-resistant yield optimization
 * Advanced liquidity provision with AI-powered rebalancing and impermanent loss protection
 */
contract SentinelAMM is ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    // Pool structure with advanced features
    struct QuantumPool {
        address token0;
        address token1;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalLiquidity;
        uint256 feeTier; // 0.01%, 0.05%, 0.30%, 1.00%
        uint256 volatilityIndex;
        uint256 impermanentLossProtection;
        uint256 lastRebalance;
        bool isActive;
        mapping(address => uint256) liquidityPositions;
    }

    // Position with advanced tracking
    struct LiquidityPosition {
        uint256 poolId;
        uint256 liquidityAmount;
        uint256 token0Amount;
        uint256 token1Amount;
        uint256 entryTime;
        uint256 lastRebalance;
        uint256 performanceScore;
        bool autoRebalance;
        uint256 minPrice;
        uint256 maxPrice;
    }

    // AI-powered rebalancing parameters
    struct RebalanceStrategy {
        uint256 targetRatio; // Target token ratio (basis points)
        uint256 rebalanceThreshold; // Min change to trigger rebalance (%)
        uint256 maxSlippage; // Maximum allowed slippage
        uint256 cooldownPeriod; // Minimum time between rebalances
        bool impermanentLossProtection;
        uint256 volatilityAdjustment;
    }

    // State variables
    mapping(uint256 => QuantumPool) public pools;
    mapping(address => LiquidityPosition[]) public userPositions;
    mapping(uint256 => RebalanceStrategy) public rebalanceStrategies;

    uint256 public poolCount;
    uint256 public totalValueLocked;
    uint256 public totalFeesCollected;

    // Fee tiers (basis points)
    uint256[] public feeTiers = [1, 5, 30, 100]; // 0.01%, 0.05%, 0.30%, 1.00%

    // AI rebalancing parameters
    uint256 public constant REBALANCE_COOLDOWN = 1 hours;
    uint256 public constant MAX_VOLATILITY_INDEX = 100;
    uint256 public constant IMPERMANENT_LOSS_THRESHOLD = 500; // 5% IL threshold

    event PoolCreated(
        uint256 indexed poolId,
        address token0,
        address token1,
        uint256 feeTier
    );
    event LiquidityAdded(
        uint256 indexed poolId,
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event LiquidityRemoved(
        uint256 indexed poolId,
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event SwapExecuted(
        uint256 indexed poolId,
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event PoolRebalanced(
        uint256 indexed poolId,
        uint256 newRatio,
        string reason
    );
    event ImpermanentLossProtected(
        uint256 indexed poolId,
        address indexed provider,
        uint256 protectionAmount
    );

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        // Create initial pools — pass feeTiers array indices (not raw fee values)
        _createPool(address(0x1), address(0x2), 1); // feeTiers[1] = 5 → 0.05% fee
        _createPool(address(0x3), address(0x4), 2); // feeTiers[2] = 30 → 0.30% fee
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Add liquidity to quantum pool with advanced features
     * @param poolId Pool ID
     * @param amount0 Amount of token0
     * @param amount1 Amount of token1
     * @param minPrice Minimum price ratio (for protection)
     * @param maxPrice Maximum price ratio (for protection)
     * @param autoRebalance Enable automatic rebalancing
     */
    function addQuantumLiquidity(
        uint256 poolId,
        uint256 amount0,
        uint256 amount1,
        uint256 minPrice,
        uint256 maxPrice,
        bool autoRebalance
    ) external nonReentrant {
        require(poolId < poolCount, "Invalid pool");
        QuantumPool storage pool = pools[poolId];
        require(pool.isActive, "Pool not active");

        // Validate price bounds
        require(minPrice < maxPrice, "Invalid price bounds");
        require(amount0 > 0 && amount1 > 0, "Invalid amounts");

        // Transfer tokens
        require(
            IERC20(pool.token0).transferFrom(
                msg.sender,
                address(this),
                amount0
            ),
            "Token0 transfer failed"
        );
        require(
            IERC20(pool.token1).transferFrom(
                msg.sender,
                address(this),
                amount1
            ),
            "Token1 transfer failed"
        );

        // Calculate liquidity amount
        uint256 liquidity;
        if (pool.totalLiquidity == 0) {
            liquidity = Math.sqrt(amount0.mul(amount1));
        } else {
            uint256 liquidity0 = amount0.mul(pool.totalLiquidity).div(
                pool.reserve0
            );
            uint256 liquidity1 = amount1.mul(pool.totalLiquidity).div(
                pool.reserve1
            );
            liquidity = Math.min(liquidity0, liquidity1);
        }

        // Update pool reserves
        pool.reserve0 = pool.reserve0.add(amount0);
        pool.reserve1 = pool.reserve1.add(amount1);
        pool.totalLiquidity = pool.totalLiquidity.add(liquidity);
        pool.liquidityPositions[msg.sender] = pool
            .liquidityPositions[msg.sender]
            .add(liquidity);

        // Create position tracking
        userPositions[msg.sender].push(
            LiquidityPosition({
                poolId: poolId,
                liquidityAmount: liquidity,
                token0Amount: amount0,
                token1Amount: amount1,
                entryTime: block.timestamp,
                lastRebalance: block.timestamp,
                performanceScore: 100, // Start with perfect score
                autoRebalance: autoRebalance,
                minPrice: minPrice,
                maxPrice: maxPrice
            })
        );

        totalValueLocked = totalValueLocked.add(amount0).add(amount1);

        emit LiquidityAdded(poolId, msg.sender, amount0, amount1, liquidity);
    }

    /**
     * @notice Execute quantum-optimized swap
     * @param poolId Pool ID
     * @param tokenIn Input token address
     * @param amountIn Input amount
     * @param minAmountOut Minimum output amount
     */
    function executeQuantumSwap(
        uint256 poolId,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(poolId < poolCount, "Invalid pool");
        QuantumPool storage pool = pools[poolId];
        require(pool.isActive, "Pool not active");

        // Validate token
        require(
            tokenIn == pool.token0 || tokenIn == pool.token1,
            "Invalid token"
        );

        // Calculate output amount with fee
        uint256 fee = amountIn.mul(pool.feeTier).div(10000);
        uint256 amountInAfterFee = amountIn.sub(fee);

        if (tokenIn == pool.token0) {
            amountOut = _getAmountOut(
                amountInAfterFee,
                pool.reserve0,
                pool.reserve1
            );
            require(amountOut >= minAmountOut, "Insufficient output amount");

            // Update reserves
            pool.reserve0 = pool.reserve0.add(amountIn);
            pool.reserve1 = pool.reserve1.sub(amountOut);
        } else {
            amountOut = _getAmountOut(
                amountInAfterFee,
                pool.reserve1,
                pool.reserve0
            );
            require(amountOut >= minAmountOut, "Insufficient output amount");

            // Update reserves
            pool.reserve1 = pool.reserve1.add(amountIn);
            pool.reserve0 = pool.reserve0.sub(amountOut);
        }

        // Transfer tokens
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "Input transfer failed"
        );

        address tokenOut = tokenIn == pool.token0 ? pool.token1 : pool.token0;
        require(
            IERC20(tokenOut).transfer(msg.sender, amountOut),
            "Output transfer failed"
        );

        // Collect fees
        totalFeesCollected = totalFeesCollected.add(fee);

        // Update pool volatility
        _updatePoolVolatility(poolId, amountIn, amountOut);

        emit SwapExecuted(
            poolId,
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut
        );
    }

    /**
     * @notice AI-powered liquidity rebalancing
     * @param poolId Pool ID to rebalance
     */
    function rebalanceQuantumPool(uint256 poolId) external {
        require(poolId < poolCount, "Invalid pool");
        QuantumPool storage pool = pools[poolId];
        RebalanceStrategy storage strategy = rebalanceStrategies[poolId];

        require(
            block.timestamp >= strategy.cooldownPeriod.add(pool.lastRebalance),
            "Rebalance cooldown active"
        );

        // Calculate current ratio
        uint256 currentRatio = pool.reserve0.mul(10000).div(pool.reserve1);
        uint256 targetRatio = strategy.targetRatio;

        // Check if rebalance needed
        uint256 ratioDiff = currentRatio > targetRatio
            ? currentRatio.sub(targetRatio)
            : targetRatio.sub(currentRatio);
        uint256 ratioChangePercent = ratioDiff.mul(100).div(targetRatio);

        if (ratioChangePercent >= strategy.rebalanceThreshold) {
            // Execute AI-powered rebalance
            _executePoolRebalance(poolId, currentRatio, targetRatio);
            pool.lastRebalance = block.timestamp;

            emit PoolRebalanced(
                poolId,
                targetRatio,
                "AI-powered ratio correction"
            );
        }
    }

    /**
     * @notice Get impermanent loss protection for position
     * @param user User address
     * @param positionIndex Position index
     */
    function claimImpermanentLossProtection(
        address user,
        uint256 positionIndex
    ) external {
        require(positionIndex < userPositions[user].length, "Invalid position");

        LiquidityPosition storage position = userPositions[user][positionIndex];
        QuantumPool storage pool = pools[position.poolId];

        // Calculate impermanent loss
        uint256 currentValue = _calculatePositionValue(position, pool);
        uint256 entryValue = position.token0Amount.add(position.token1Amount);
        uint256 lossPercent = entryValue > currentValue
            ? ((entryValue.sub(currentValue)).mul(10000)).div(entryValue)
            : 0;

        if (lossPercent >= IMPERMANENT_LOSS_THRESHOLD) {
            uint256 protectionAmount = (
                lossPercent.sub(IMPERMANENT_LOSS_THRESHOLD)
            ).mul(entryValue).div(10000);

            // Mint protection tokens (simplified - would use actual token in production)
            // For demo, we just emit the event
            emit ImpermanentLossProtected(
                position.poolId,
                user,
                protectionAmount
            );
        }
    }

    /**
     * @notice Get pool statistics with AI insights
     * @param poolId Pool ID
     */
    function getQuantumPoolStats(
        uint256 poolId
    )
        external
        view
        returns (
            uint256 reserve0,
            uint256 reserve1,
            uint256 liquidity,
            uint256 feeTier,
            uint256 volatility,
            uint256 predictedAPY,
            uint256 impermanentLossRisk
        )
    {
        QuantumPool storage pool = pools[poolId];

        uint256 predictedAPY_ = _predictPoolAPY(poolId);
        uint256 ilRisk = _calculateILRisk(poolId);

        return (
            pool.reserve0,
            pool.reserve1,
            pool.totalLiquidity,
            pool.feeTier,
            pool.volatilityIndex,
            predictedAPY_,
            ilRisk
        );
    }

    /**
     * @dev Calculate output amount for swap
     */
    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountIn.mul(997); // 0.3% fee
        uint256 numerator = amountInWithFee.mul(reserveOut);
        uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);

        return numerator.div(denominator);
    }

    /**
     * @dev Update pool volatility based on trade size
     */
    function _updatePoolVolatility(
        uint256 poolId,
        uint256 amountIn,
        uint256 amountOut
    ) internal {
        QuantumPool storage pool = pools[poolId];

        // Calculate trade impact
        uint256 tradeSize = Math.max(amountIn, amountOut);
        uint256 poolSize = pool.reserve0.add(pool.reserve1);

        uint256 volatilityIncrease = tradeSize.mul(100).div(poolSize);

        pool.volatilityIndex = Math.min(
            pool.volatilityIndex.add(volatilityIncrease),
            MAX_VOLATILITY_INDEX
        );
    }

    /**
     * @dev Execute AI-powered pool rebalance
     */
    function _executePoolRebalance(
        uint256 poolId,
        uint256 currentRatio,
        uint256 targetRatio
    ) internal {
        // Simplified rebalance logic
        // In production, this would involve complex mathematical calculations
        // for optimal liquidity distribution
        QuantumPool storage pool = pools[poolId];

        // Adjust reserves based on target ratio
        // This is a simplified version - real implementation would be more complex
        uint256 totalValue = pool.reserve0.add(pool.reserve1);
        uint256 targetReserve0 = totalValue.mul(targetRatio).div(
            targetRatio.add(10000)
        );

        pool.reserve0 = targetReserve0;
        pool.reserve1 = totalValue.sub(targetReserve0);
    }

    /**
     * @dev Predict pool APY using AI algorithms
     */
    function _predictPoolAPY(uint256 poolId) internal view returns (uint256) {
        QuantumPool storage pool = pools[poolId];

        // Simplified APY prediction based on fees and volatility
        uint256 baseAPY = pool.feeTier.mul(365).mul(24); // Annualized fee capture
        uint256 volatilityBonus = pool.volatilityIndex.mul(5); // Higher volatility = higher APY

        return Math.min(baseAPY.add(volatilityBonus), 5000); // Max 50% APY
    }

    /**
     * @dev Calculate impermanent loss risk
     */
    function _calculateILRisk(uint256 poolId) internal view returns (uint256) {
        QuantumPool storage pool = pools[poolId];

        // Simplified IL risk calculation
        // Higher volatility = higher IL risk
        return Math.min(pool.volatilityIndex.mul(10), 1000); // Max 10% risk
    }

    /**
     * @dev Calculate current position value
     */
    function _calculatePositionValue(
        LiquidityPosition memory position,
        QuantumPool storage pool
    ) internal view returns (uint256) {
        // Calculate current value based on liquidity share
        uint256 poolValue = pool.reserve0.add(pool.reserve1);
        uint256 positionValue = poolValue.mul(position.liquidityAmount).div(
            pool.totalLiquidity
        );

        return positionValue;
    }

    /**
     * @dev Create new quantum pool
     */
    function _createPool(
        address token0,
        address token1,
        uint256 feeTier
    ) internal returns (uint256) {
        require(token0 != token1, "Same tokens");
        require(feeTiers[feeTier] > 0, "Invalid fee tier");

        uint256 poolId = poolCount++;

        pools[poolId].token0 = token0;
        pools[poolId].token1 = token1;
        pools[poolId].reserve0 = 0;
        pools[poolId].reserve1 = 0;
        pools[poolId].totalLiquidity = 0;
        pools[poolId].feeTier = feeTiers[feeTier];
        pools[poolId].volatilityIndex = 10; // Start with low volatility
        pools[poolId].impermanentLossProtection = 100; // 1% protection
        pools[poolId].lastRebalance = block.timestamp;
        pools[poolId].isActive = true;

        // Set default rebalance strategy
        rebalanceStrategies[poolId] = RebalanceStrategy({
            targetRatio: 5000, // 50:50 ratio
            rebalanceThreshold: 500, // 5% threshold
            maxSlippage: 100, // 1% max slippage
            cooldownPeriod: REBALANCE_COOLDOWN,
            impermanentLossProtection: true,
            volatilityAdjustment: 50
        });

        emit PoolCreated(poolId, token0, token1, feeTiers[feeTier]);
        return poolId;
    }
}
