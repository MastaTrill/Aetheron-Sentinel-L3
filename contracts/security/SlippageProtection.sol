// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SlippageProtection
 * @notice Dynamic slippage buffers based on liquidity & volatility
 * @dev Uses historical data to dynamically adjust slippage tolerance per trade
 */
contract SlippageProtection is AccessControl, ReentrancyGuard {
    bytes32 public constant PRICE_ORACLE_ROLE = keccak256("PRICE_ORACLE_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // Structs
    struct PoolData {
        address pool;
        uint256 liquidity;
        uint256 lastUpdate;
        uint256 volatilityScore;
        uint256 avgSlippage;
        bool isWhitelisted;
    }

    struct TradeParams {
        uint256 amountIn;
        uint256 expectedMinOut;
        uint256 maxSlippageBps;
        uint256 deadline;
        address recipient;
    }

    struct SlippageCalculation {
        uint256 baseSlippage;
        uint256 liquidityAdjustment;
        uint256 volatilityAdjustment;
        uint256 urgencyAdjustment;
        uint256 finalSlippage;
        uint256 minAmountOut;
    }

    struct VolatilityData {
        uint256[] recentPrices;
        uint256 priceUpdateTime;
        uint256 volatilityWindow; // seconds
        uint256 currentVolatility; // expressed as bps
    }

    // State
    mapping(address => PoolData) public pools;
    mapping(address => VolatilityData) public volatilityData;
    address[] public whitelistedPools;

    // Slippage parameters
    uint256 public baseSlippageBps = 50; // 0.5% base
    uint256 public maxSlippageBps = 500; // 5% max
    uint256 public minSlippageBps = 5; // 0.05% min
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Volatility parameters
    uint256 public volatilityWindow = 1 hours;
    uint256 public highVolatilityThreshold = 200; // 2% hourly
    uint256 public volatilityMultiplier = 200; // 2x when volatile

    // Liquidity parameters
    uint256 public lowLiquidityThreshold = 10000e18; // $10k
    uint256 public liquidityMultiplierLow = 300; // 3x for low liquidity
    uint256 public liquidityMultiplierHigh = 50; // 0.5x for high liquidity

    // Urgency fees
    uint256 public urgencyWindow = 5 minutes;
    uint256 public urgencyFeeMax = 100; // 1% max urgency fee

    // Price impact tracking
    mapping(address => uint256) public priceImpactAccumulator;
    uint256 public priceImpactWindow = 24 hours;

    // Events
    event SlippageCalculated(
        address indexed pool,
        uint256 baseSlippage,
        uint256 finalSlippage,
        uint256 minAmountOut
    );
    event PoolWhitelisted(address indexed pool, uint256 initialLiquidity);
    event PoolBlacklisted(address indexed pool);
    event VolatilityAlert(address indexed pool, uint256 volatility);
    event SlippageLimitUpdated(uint256 min, uint256 max, uint256 base);
    event TradeExecuted(
        address indexed user,
        address indexed pool,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippage
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    // ============ Pool Management ============

    function addPool(
        address _pool,
        uint256 _initialLiquidity
    ) external onlyRole(MANAGER_ROLE) {
        require(_pool != address(0), "Invalid pool");
        require(!pools[_pool].isWhitelisted, "Already whitelisted");

        pools[_pool] = PoolData({
            pool: _pool,
            liquidity: _initialLiquidity,
            lastUpdate: block.timestamp,
            volatilityScore: 100, // 1x baseline
            avgSlippage: baseSlippageBps,
            isWhitelisted: true
        });

        whitelistedPools.push(_pool);

        emit PoolWhitelisted(_pool, _initialLiquidity);
    }

    function removePool(address _pool) external onlyRole(MANAGER_ROLE) {
        require(pools[_pool].isWhitelisted, "Not whitelisted");
        pools[_pool].isWhitelisted = false;

        emit PoolBlacklisted(_pool);
    }

    function updatePoolLiquidity(
        address _pool,
        uint256 _newLiquidity
    ) external onlyRole(PRICE_ORACLE_ROLE) {
        require(pools[_pool].isWhitelisted, "Pool not whitelisted");
        pools[_pool].liquidity = _newLiquidity;
        pools[_pool].lastUpdate = block.timestamp;
    }

    // ============ Volatility Tracking ============

    function updatePrice(
        address _pool,
        uint256 _price
    ) external onlyRole(PRICE_ORACLE_ROLE) {
        VolatilityData storage vol = volatilityData[_pool];

        vol.recentPrices.push(_price);
        vol.priceUpdateTime = block.timestamp;

        // Keep only recent prices within window
        uint256 cutoff = block.timestamp - volatilityWindow;
        while (vol.recentPrices.length > 100) {
            // Remove oldest if array too large
            delete vol.recentPrices[0];
        }

        // Calculate volatility
        vol.currentVolatility = _calculateVolatility(_pool);
        vol.volatilityWindow = volatilityWindow;

        // Update pool volatility score
        if (pools[_pool].isWhitelisted) {
            pools[_pool].volatilityScore = vol.currentVolatility;

            if (vol.currentVolatility > highVolatilityThreshold) {
                emit VolatilityAlert(_pool, vol.currentVolatility);
            }
        }
    }

    function _calculateVolatility(
        address _pool
    ) internal view returns (uint256) {
        VolatilityData storage vol = volatilityData[_pool];
        if (vol.recentPrices.length < 2) return 100; // Default 1x

        uint256[] memory prices = vol.recentPrices;
        uint256 priceCount = prices.length;

        // Calculate standard deviation of price changes
        uint256 sum;
        uint256 sumSquared;

        for (uint256 i = 1; i < priceCount; i++) {
            uint256 change = prices[i] > prices[i - 1]
                ? prices[i] - prices[i - 1]
                : prices[i - 1] - prices[i];

            uint256 changePercent = (change * BPS_DENOMINATOR) / prices[i - 1];
            sum += changePercent;
            sumSquared += changePercent * changePercent;
        }

        uint256 avg = sum / (priceCount - 1);
        uint256 variance = sumSquared / (priceCount - 1) - avg * avg;

        // Volatility in bps
        uint256 volatility = _sqrt(variance);

        // Scale: baseline 100 = 1x multiplier
        return (volatility * 100) / BPS_DENOMINATOR + 100;
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // ============ Slippage Calculation ============

    function calculateDynamicSlippage(
        address _pool,
        uint256 _amountIn,
        bool _isUrgent
    ) public view returns (SlippageCalculation memory) {
        PoolData storage pool = pools[_pool];
        require(pool.isWhitelisted, "Pool not whitelisted");

        SlippageCalculation memory calc;

        // 1. Base slippage
        calc.baseSlippage = baseSlippageBps;

        // 2. Liquidity adjustment
        uint256 liqAdjustment = _calculateLiquidityAdjustment(pool.liquidity);
        calc.liquidityAdjustment = liqAdjustment;

        // 3. Volatility adjustment
        uint256 volAdjustment = _calculateVolatilityAdjustment(
            pool.volatilityScore
        );
        calc.volatilityAdjustment = volAdjustment;

        // 4. Urgency adjustment
        uint256 urgAdjustment = _isUrgent ? _calculateUrgencyAdjustment() : 0;
        calc.urgencyAdjustment = urgAdjustment;

        // 5. Combine all factors
        calc.finalSlippage =
            calc.baseSlippage +
            calc.liquidityAdjustment +
            calc.volatilityAdjustment +
            calc.urgencyAdjustment;

        // Apply bounds
        if (calc.finalSlippage < minSlippageBps) {
            calc.finalSlippage = minSlippageBps;
        }
        if (calc.finalSlippage > maxSlippageBps) {
            calc.finalSlippage = maxSlippageBps;
        }

        // Calculate minimum output
        calc.minAmountOut =
            (_amountIn * (BPS_DENOMINATOR - calc.finalSlippage)) /
            BPS_DENOMINATOR;

        return calc;
    }

    function _calculateLiquidityAdjustment(
        uint256 _liquidity
    ) internal view returns (uint256) {
        if (_liquidity < lowLiquidityThreshold) {
            // Low liquidity = higher slippage
            uint256 deficit = lowLiquidityThreshold - _liquidity;
            uint256 multiplier = (deficit * BPS_DENOMINATOR) /
                lowLiquidityThreshold;
            return (liquidityMultiplierLow * multiplier) / BPS_DENOMINATOR;
        } else {
            // High liquidity = lower slippage
            return liquidityMultiplierHigh;
        }
    }

    function _calculateVolatilityAdjustment(
        uint256 _volatilityScore
    ) internal view returns (uint256) {
        if (_volatilityScore > 100) {
            // More volatile = higher slippage
            uint256 excess = _volatilityScore - 100;
            return (excess * volatilityMultiplier) / 100;
        }
        return 0;
    }

    function _calculateUrgencyAdjustment() internal view returns (uint256) {
        return urgencyFeeMax;
    }

    // ============ Trade Protection ============

    function validateTrade(
        address _pool,
        TradeParams calldata _params,
        uint256 _actualAmountOut
    ) external nonReentrant returns (bool success, uint256 refundAmount) {
        require(pools[_pool].isWhitelisted, "Pool not whitelisted");
        require(block.timestamp <= _params.deadline, "Trade expired");

        // Calculate required slippage
        SlippageCalculation memory calc = calculateDynamicSlippage(
            _pool,
            _params.amountIn,
            _params.deadline < block.timestamp + urgencyWindow
        );

        // Check against user's max slippage
        require(
            calc.finalSlippage <= _params.maxSlippageBps,
            "Slippage exceeds tolerance"
        );

        // Check minimum amount out
        if (_actualAmountOut < _params.expectedMinOut) {
            uint256 shortfall = _params.expectedMinOut - _actualAmountOut;
            // Partial success - return excess
            return (true, (_params.amountIn * shortfall) / _params.amountIn);
        }

        // Track price impact
        _updatePriceImpact(_pool, _actualAmountOut, _params.amountIn);

        emit TradeExecuted(
            _params.recipient,
            _pool,
            _params.amountIn,
            _actualAmountOut,
            calc.finalSlippage
        );

        return (true, 0);
    }

    function _updatePriceImpact(
        address _pool,
        uint256 _amountOut,
        uint256 _amountIn
    ) internal {
        if (_amountIn == 0) return;

        uint256 priceImpact = _amountIn > _amountOut
            ? ((_amountIn - _amountOut) * BPS_DENOMINATOR) / _amountIn
            : 0;

        uint256 currentAccumulator = priceImpactAccumulator[_pool];
        uint256 windowStart = block.timestamp - priceImpactWindow;

        // Simple accumulator with time-based decay
        priceImpactAccumulator[_pool] =
            ((currentAccumulator * 9) / 10) +
            priceImpact;
    }

    // ============ MEV Protection ============

    function checkMEVRisk(
        address _pool,
        uint256 _amountIn
    ) external view returns (uint256 riskScore, bool shouldBlock) {
        PoolData storage pool = pools[_pool];
        uint256 accumulatedImpact = priceImpactAccumulator[_pool];

        // High recent price impact = potential MEV
        if (accumulatedImpact > 500) {
            // > 5% accumulated
            riskScore = 80;
            shouldBlock = true;
        } else if (accumulatedImpact > 200) {
            // > 2% accumulated
            riskScore = 50;
            shouldBlock = false;
        } else {
            riskScore = 10;
            shouldBlock = false;
        }

        // Adjust for volatility
        if (pool.volatilityScore > 200) {
            riskScore += 20;
            if (riskScore >= 80) shouldBlock = true;
        }

        return (riskScore, shouldBlock);
    }

    // ============ Admin Functions ============

    function updateSlippageLimits(
        uint256 _min,
        uint256 _max,
        uint256 _base
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_min <= _base && _base <= _max, "Invalid limits");
        require(_max <= 1000, "Max too high"); // 10%

        minSlippageBps = _min;
        maxSlippageBps = _max;
        baseSlippageBps = _base;

        emit SlippageLimitUpdated(_min, _max, _base);
    }

    function updateVolatilityParameters(
        uint256 _window,
        uint256 _threshold,
        uint256 _multiplier
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_window >= 1 minutes && _window <= 24 hours, "Invalid window");

        volatilityWindow = _window;
        highVolatilityThreshold = _threshold;
        volatilityMultiplier = _multiplier;
    }

    function updateLiquidityParameters(
        uint256 _threshold,
        uint256 _lowMultiplier,
        uint256 _highMultiplier
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_threshold > 0, "Invalid threshold");

        lowLiquidityThreshold = _threshold;
        liquidityMultiplierLow = _lowMultiplier;
        liquidityMultiplierHigh = _highMultiplier;
    }

    // ============ View Functions ============

    function getPoolInfo(
        address _pool
    )
        external
        view
        returns (
            uint256 liquidity,
            uint256 volatilityScore,
            uint256 avgSlippage,
            uint256 recentPriceImpact,
            bool isWhitelisted
        )
    {
        PoolData storage pool = pools[_pool];
        return (
            pool.liquidity,
            pool.volatilityScore,
            pool.avgSlippage,
            priceImpactAccumulator[_pool],
            pool.isWhitelisted
        );
    }

    function getVolatility(address _pool) external view returns (uint256) {
        return volatilityData[_pool].currentVolatility;
    }

    function getRecommendedSlippage(
        address _pool,
        uint256 _amountIn
    ) external view returns (uint256 recommended, uint256 minRequired) {
        SlippageCalculation memory calc = calculateDynamicSlippage(
            _pool,
            _amountIn,
            false
        );

        // Add 10% buffer for safety
        recommended = (calc.finalSlippage * 11) / 10;
        if (recommended > maxSlippageBps) recommended = maxSlippageBps;

        minRequired = calc.finalSlippage;

        return (recommended, minRequired);
    }
}
