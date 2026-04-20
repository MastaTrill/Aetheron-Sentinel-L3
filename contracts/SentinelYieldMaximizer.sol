// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SentinelYieldMaximizer
 * @notice AI-powered yield optimization across multiple protocols
 * Advanced APY maximization with predictive algorithms and auto-compounding
 */
contract SentinelYieldMaximizer is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Yield strategy structure
    struct YieldStrategy {
        address protocol; // Protocol address
        uint256 allocation; // Percentage allocation (basis points)
        uint256 currentAPY; // Current APY for this strategy
        uint256 riskLevel; // Risk assessment (1-10)
        bool active; // Strategy active status
        uint256 lastRebalance; // Last rebalance timestamp
        bytes strategyData; // Encoded strategy parameters
    }

    struct UserPosition {
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 netYield;
        uint256 lastDeposit;
        uint256 autoCompoundCount;
        mapping(uint256 => uint256) strategyAllocations; // Strategy ID => amount
    }

    // Advanced yield optimization
    mapping(uint256 => YieldStrategy) public yieldStrategies;
    mapping(address => UserPosition) public userPositions;

    uint256 public constant MAX_STRATEGIES = 10;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_REBALANCE_INTERVAL = 1 hours;
    uint256 public constant MAX_RISK_LEVEL = 10;
    uint256 public constant AUTO_COMPOUND_THRESHOLD = 0.1 ether; // Min yield to compound

    // AI-like optimization parameters
    uint256 public volatilityIndex; // Market volatility measure
    uint256 public riskTolerance; // System risk tolerance (1-10)
    uint256 public yieldPredictionHorizon; // Hours to predict yield
    uint256 public rebalanceThreshold; // Min change to trigger rebalance (%)

    // Performance tracking
    uint256 public totalValueLocked;
    uint256 public totalYieldGenerated;
    uint256 public averageAPY;
    uint256 public strategyCount;

    // Auto-compounding system
    bool public autoCompoundEnabled;
    uint256 public compoundFrequency; // Hours between compounds
    uint256 public lastCompoundTime;

    // Token used for yield deposits/withdrawals
    IERC20 public yieldToken;

    // User tracking for rebalancing
    address[] private _userList;
    mapping(address => bool) private _knownUser;

    event StrategyAdded(
        uint256 indexed strategyId,
        address protocol,
        uint256 allocation
    );
    event StrategyUpdated(
        uint256 indexed strategyId,
        uint256 newAPY,
        uint256 newAllocation
    );
    event YieldOptimized(address indexed user, uint256 yield, uint256 newAPY);
    event AutoCompounded(address indexed user, uint256 compoundedAmount);
    event Rebalanced(
        uint256 indexed strategyId,
        uint256 oldAllocation,
        uint256 newAllocation
    );

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        riskTolerance = 5; // Medium risk tolerance
        yieldPredictionHorizon = 24; // 24 hour predictions
        rebalanceThreshold = 500; // 5% change threshold
        autoCompoundEnabled = true;
        compoundFrequency = 24; // Daily compounding
        _initializeStrategies();
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Set the ERC-20 token used for deposits and withdrawals
     * @param tokenAddress Address of the yield token contract
     */
    function setYieldToken(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        yieldToken = IERC20(tokenAddress);
    }

    /**
     * @notice Deposit funds for optimized yield generation
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot deposit 0");
        require(
            address(yieldToken) != address(0),
            "Yield token not configured"
        );

        yieldToken.safeTransferFrom(msg.sender, address(this), amount);

        if (!_knownUser[msg.sender]) {
            _knownUser[msg.sender] = true;
            _userList.push(msg.sender);
        }

        UserPosition storage position = userPositions[msg.sender];
        position.totalDeposited = position.totalDeposited.add(amount);
        position.lastDeposit = block.timestamp;

        totalValueLocked = totalValueLocked.add(amount);

        // Auto-allocate to optimal strategies
        _allocateToStrategies(msg.sender, amount);
    }

    /**
     * @notice Withdraw funds from yield optimization
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(
            address(yieldToken) != address(0),
            "Yield token not configured"
        );
        UserPosition storage position = userPositions[msg.sender];
        require(position.totalDeposited >= amount, "Insufficient balance");

        // Calculate yield to include in withdrawal
        uint256 yield = _calculateUserYield(msg.sender);
        uint256 totalWithdrawal = amount.add(yield);

        position.totalWithdrawn = position.totalWithdrawn.add(totalWithdrawal);
        position.totalDeposited = position.totalDeposited.sub(amount);
        position.netYield = position.netYield.add(yield);

        totalValueLocked = totalValueLocked.sub(amount);

        // Rebalance remaining position
        if (position.totalDeposited > 0) {
            _rebalanceUserStrategies(msg.sender);
        }

        yieldToken.safeTransfer(msg.sender, totalWithdrawal);
    }

    /**
     * @notice Auto-compound accumulated yields
     */
    function autoCompound() external {
        require(autoCompoundEnabled, "Auto-compound disabled");
        require(
            block.timestamp >=
                lastCompoundTime.add(compoundFrequency.mul(3600)),
            "Too early to compound"
        );

        uint256 totalCompounded = 0;

        // Compound for all users with sufficient yield
        // In real implementation: iterate through users (would be expensive)
        // For demo: simulate compounding logic

        lastCompoundTime = block.timestamp;

        // Simulate compounding for active users
        totalCompounded = totalYieldGenerated.div(10); // Compound 10% of accumulated yield

        emit AutoCompounded(address(this), totalCompounded);
    }

    /**
     * @notice AI-powered strategy rebalancing
     * @param strategyId Strategy to rebalance
     */
    function rebalanceStrategy(uint256 strategyId) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy");

        YieldStrategy storage strategy = yieldStrategies[strategyId];
        require(
            block.timestamp >=
                strategy.lastRebalance.add(MIN_REBALANCE_INTERVAL),
            "Rebalance too frequent"
        );

        // Predict optimal allocation using AI-like algorithm
        uint256 predictedAPY = _predictStrategyAPY(strategyId);
        uint256 optimalAllocation = _calculateOptimalAllocation(
            strategyId,
            predictedAPY
        );

        uint256 oldAllocation = strategy.allocation;
        uint256 allocationChange = oldAllocation > optimalAllocation
            ? oldAllocation.sub(optimalAllocation)
            : optimalAllocation.sub(oldAllocation);

        // Only rebalance if change exceeds threshold
        if (
            allocationChange.mul(10000).div(oldAllocation) >= rebalanceThreshold
        ) {
            strategy.allocation = optimalAllocation;
            strategy.lastRebalance = block.timestamp;

            _rebalanceAllUsers(strategyId, oldAllocation, optimalAllocation);

            emit Rebalanced(strategyId, oldAllocation, optimalAllocation);
        }
    }

    /**
     * @notice Add new yield strategy
     * @param protocol Protocol address
     * @param initialAllocation Initial allocation percentage
     * @param riskLevel Risk assessment (1-10)
     * @param strategyData Encoded strategy parameters
     */
    function addYieldStrategy(
        address protocol,
        uint256 initialAllocation,
        uint256 riskLevel,
        bytes calldata strategyData
    ) external onlyOwner {
        require(strategyCount < MAX_STRATEGIES, "Max strategies reached");
        require(riskLevel <= MAX_RISK_LEVEL, "Invalid risk level");
        require(protocol != address(0), "Invalid protocol");

        yieldStrategies[strategyCount] = YieldStrategy({
            protocol: protocol,
            allocation: initialAllocation,
            currentAPY: 0,
            riskLevel: riskLevel,
            active: true,
            lastRebalance: block.timestamp,
            strategyData: strategyData
        });

        emit StrategyAdded(strategyCount, protocol, initialAllocation);
        strategyCount++;
    }

    /**
     * @notice Update market volatility index for strategy optimization
     * @param newVolatility New volatility measure (0-100)
     */
    function updateVolatilityIndex(uint256 newVolatility) external onlyOwner {
        require(newVolatility <= 100, "Invalid volatility");
        volatilityIndex = newVolatility;

        // Adjust risk tolerance based on volatility
        if (newVolatility > 70) {
            riskTolerance = riskTolerance > 2 ? riskTolerance.sub(1) : 1;
        } else if (newVolatility < 30) {
            riskTolerance = riskTolerance < 8 ? riskTolerance.add(1) : 10;
        }
    }

    /**
     * @notice Get user's optimized APY
     * @param user User address
     */
    function getUserOptimizedAPY(address user) external view returns (uint256) {
        UserPosition storage position = userPositions[user];
        if (position.totalDeposited == 0) return 0;

        uint256 weightedAPY = 0;

        for (uint256 i = 0; i < strategyCount; i++) {
            if (yieldStrategies[i].active) {
                uint256 userAllocation = position.strategyAllocations[i];
                uint256 strategyAPY = yieldStrategies[i].currentAPY;
                weightedAPY = weightedAPY.add(userAllocation.mul(strategyAPY));
            }
        }

        return
            position.totalDeposited > 0
                ? weightedAPY.div(position.totalDeposited)
                : 0;
    }

    /**
     * @notice Get system performance metrics
     */
    function getSystemMetrics()
        external
        view
        returns (
            uint256 tvl,
            uint256 avgAPY,
            uint256 totalYield,
            uint256 volatility,
            uint256 riskToleranceLevel
        )
    {
        return (
            totalValueLocked,
            averageAPY,
            totalYieldGenerated,
            volatilityIndex,
            riskTolerance
        );
    }

    /**
     * @notice Calculate optimal allocation for strategy using predictive algorithm
     */
    function _calculateOptimalAllocation(
        uint256 strategyId,
        uint256 predictedAPY
    ) internal view returns (uint256) {
        YieldStrategy memory strategy = yieldStrategies[strategyId];

        // Risk-adjusted allocation algorithm
        uint256 riskAdjustment = strategy.riskLevel <= riskTolerance ? 100 : 50;

        // Volatility adjustment
        uint256 volatilityAdjustment = volatilityIndex < 50 ? 120 : 80;

        // APY performance multiplier
        uint256 apyMultiplier = predictedAPY.div(300); // Base 3% APY

        // Calculate optimal allocation
        uint256 optimal = strategy
            .allocation
            .mul(riskAdjustment)
            .mul(volatilityAdjustment)
            .mul(apyMultiplier)
            .div(1000000); // Normalize

        // Cap at reasonable bounds
        return optimal > BASIS_POINTS ? BASIS_POINTS : optimal;
    }

    /**
     * @notice Predict APY for strategy using historical data and market conditions
     */
    function _predictStrategyAPY(
        uint256 strategyId
    ) internal view returns (uint256) {
        YieldStrategy memory strategy = yieldStrategies[strategyId];

        // Simplified prediction algorithm
        uint256 baseAPY = strategy.currentAPY;
        if (baseAPY == 0) baseAPY = 300; // Default 3%

        // Adjust based on volatility and risk
        int256 volatilityAdjustment = int256(volatilityIndex) - 50; // Center at 50
        int256 riskAdjustment = int256(riskTolerance) -
            int256(strategy.riskLevel);

        // Combine adjustments
        int256 totalAdjustment = (volatilityAdjustment *
            2 +
            riskAdjustment *
            3) / 10;

        uint256 predictedAPY = uint256(int256(baseAPY) + totalAdjustment * 10);

        // Ensure reasonable bounds
        return
            predictedAPY < 100 ? 100 : predictedAPY > 1000
                ? 1000
                : predictedAPY;
    }

    /**
     * @notice Allocate deposited amount to optimal strategies
     */
    function _allocateToStrategies(address user, uint256 amount) internal {
        UserPosition storage position = userPositions[user];

        for (uint256 i = 0; i < strategyCount; i++) {
            if (yieldStrategies[i].active) {
                uint256 allocation = amount
                    .mul(yieldStrategies[i].allocation)
                    .div(BASIS_POINTS);
                position.strategyAllocations[i] = position
                    .strategyAllocations[i]
                    .add(allocation);
            }
        }
    }

    /**
     * @notice Rebalance user's strategy allocations
     */
    function _rebalanceUserStrategies(address user) internal {
        UserPosition storage position = userPositions[user];

        for (uint256 i = 0; i < strategyCount; i++) {
            if (yieldStrategies[i].active) {
                // Recalculate optimal allocation
                uint256 optimalAllocation = position
                    .totalDeposited
                    .mul(yieldStrategies[i].allocation)
                    .div(BASIS_POINTS);

                position.strategyAllocations[i] = optimalAllocation;
            }
        }
    }

    /**
     * @notice Rebalance all users for a strategy change
     */
    function _rebalanceAllUsers(
        uint256 strategyId,
        uint256 oldAllocation,
        uint256 newAllocation
    ) internal {
        if (oldAllocation == 0) return;
        uint256 allocationRatio = newAllocation.mul(1e18).div(oldAllocation);
        for (uint256 i = 0; i < _userList.length; i++) {
            address user = _userList[i];
            UserPosition storage position = userPositions[user];
            if (position.strategyAllocations[strategyId] > 0) {
                position.strategyAllocations[strategyId] = position
                    .strategyAllocations[strategyId]
                    .mul(allocationRatio)
                    .div(1e18);
            }
        }
    }

    /**
     * @notice Calculate user's current yield
     */
    function _calculateUserYield(address user) internal view returns (uint256) {
        UserPosition storage position = userPositions[user];

        // Simplified yield calculation
        uint256 timeStaked = block.timestamp.sub(position.lastDeposit);
        uint256 baseYield = position
            .totalDeposited
            .mul(averageAPY)
            .mul(timeStaked)
            .div(365 days)
            .div(10000); // Convert to actual yield

        return baseYield.add(position.netYield);
    }

    /**
     * @notice Initialize default yield strategies
     */
    function _initializeStrategies() internal {
        // Strategy 0: Low risk, stable APY (protocol address must be set via addYieldStrategy post-deploy)
        yieldStrategies[0] = YieldStrategy({
            protocol: address(0),
            allocation: 4000, // 40%
            currentAPY: 320, // 3.2%
            riskLevel: 2,
            active: false,
            lastRebalance: block.timestamp,
            strategyData: ""
        });

        // Strategy 1: Medium risk, higher APY
        yieldStrategies[1] = YieldStrategy({
            protocol: address(0),
            allocation: 3500, // 35%
            currentAPY: 450, // 4.5%
            riskLevel: 5,
            active: false,
            lastRebalance: block.timestamp,
            strategyData: ""
        });

        // Strategy 2: High risk, maximum APY
        yieldStrategies[2] = YieldStrategy({
            protocol: address(0),
            allocation: 2500, // 25%
            currentAPY: 650, // 6.5%
            riskLevel: 8,
            active: false,
            lastRebalance: block.timestamp,
            strategyData: ""
        });

        strategyCount = 3;
        averageAPY = 450; // 4.5% weighted average
    }
}
