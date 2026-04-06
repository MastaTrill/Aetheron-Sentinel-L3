// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LiquidityRebalancer
 * @notice Auto-rebalance liquidity across L2 bridges based on demand
 * @dev Monitors utilization rates, predicts demand, and executes rebalancing
 */
contract LiquidityRebalancer is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint256 public constant DEVIATION_THRESHOLD = 1000; // 10%

    // Structs
    struct BridgePool {
        address bridgeAddress;
        uint256 chainId;
        uint256 liquidity;
        uint256 totalLiquidity;
        uint256 utilizedLiquidity;
        uint256 pendingOutflows;
        uint256 utilizationRate; // bps
        bool isActive;
        bool canReceive;
        uint256 minLiquidity;
        uint256 targetLiquidity;
        uint256 lastRebalance;
    }

    struct RebalancePlan {
        uint256 planId;
        address sourceBridge;
        address destBridge;
        uint256 amount;
        uint256 expectedReturn;
        uint256 deadline;
        bool executed;
        bool cancelled;
        uint256 createdAt;
    }

    struct DemandForecast {
        uint256 predictedInflow;
        uint256 predictedOutflow;
        uint256 confidence;
        uint256 forecastTime;
        uint256 window;
    }

    struct RebalanceConfig {
        uint256 minUtilization;
        uint256 maxUtilization;
        uint256 rebalanceThreshold;
        uint256 cooldownPeriod;
        uint256 maxRebalanceAmount;
        uint256 slippageTolerance;
    }

    // State
    mapping(address => BridgePool) public pools;
    address[] public registeredPools;
    uint256 public planCount;
    mapping(uint256 => RebalancePlan) public rebalancePlans;
    mapping(uint256 => DemandForecast) public demandForecasts;

    // Configuration
    RebalanceConfig public config =
        RebalanceConfig({
            minUtilization: 2000, // 20%
            maxUtilization: 8000, // 80%
            rebalanceThreshold: 1000, // 10% deviation triggers rebalance
            cooldownPeriod: 1 hours,
            maxRebalanceAmount: 1000000e18,
            slippageTolerance: 50 // 0.5%
        });

    // Token
    IERC20 public immutable REBALANCE_TOKEN;

    // Fees
    uint256 public rebalanceFee = 0; // bps
    uint256 public collectedFees;
    address public feeRecipient;

    // Events
    event PoolRegistered(
        address indexed bridge,
        uint256 chainId,
        uint256 initialLiquidity
    );
    event LiquidityDeposited(
        address indexed bridge,
        uint256 amount,
        uint256 newTotal
    );
    event LiquidityWithdrawn(
        address indexed bridge,
        uint256 amount,
        uint256 newTotal
    );
    event RebalancePlanCreated(
        uint256 indexed planId,
        address indexed sourceBridge,
        address indexed destBridge,
        uint256 amount
    );
    event RebalanceExecuted(
        uint256 indexed planId,
        uint256 amount,
        uint256 duration
    );
    event RebalanceCancelled(uint256 indexed planId);
    event UtilizationAlert(
        address indexed bridge,
        uint256 utilization,
        uint256 threshold
    );
    event DemandForecastUpdated(
        address indexed bridge,
        uint256 predictedInflow,
        uint256 predictedOutflow
    );
    event ConfigUpdated(
        uint256 minUtilization,
        uint256 maxUtilization,
        uint256 rebalanceThreshold
    );
    event FeeUpdated(uint256 newFee);

    constructor(address _token, address _feeRecipient) {
        require(_token != address(0), "Invalid token");
        REBALANCE_TOKEN = IERC20(_token);
        feeRecipient = _feeRecipient;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    // ============ Pool Management ============

    function registerPool(
        address _bridge,
        uint256 _chainId,
        uint256 _initialLiquidity,
        uint256 _minLiquidity,
        uint256 _targetLiquidity
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bridge != address(0), "Invalid bridge");
        require(!pools[_bridge].isActive, "Already registered");

        pools[_bridge] = BridgePool({
            bridgeAddress: _bridge,
            chainId: _chainId,
            liquidity: _initialLiquidity,
            totalLiquidity: _initialLiquidity,
            utilizedLiquidity: 0,
            pendingOutflows: 0,
            utilizationRate: 0,
            isActive: true,
            canReceive: true,
            minLiquidity: _minLiquidity,
            targetLiquidity: _targetLiquidity,
            lastRebalance: 0
        });

        registeredPools.push(_bridge);

        if (_initialLiquidity > 0) {
            REBALANCE_TOKEN.safeTransferFrom(
                msg.sender,
                address(this),
                _initialLiquidity
            );
        }

        emit PoolRegistered(_bridge, _chainId, _initialLiquidity);
    }

    function updatePoolLiquidity(
        address _bridge,
        uint256 _liquidity,
        uint256 _utilized
    ) external onlyRole(ORACLE_ROLE) {
        require(pools[_bridge].isActive, "Pool not registered");

        BridgePool storage pool = pools[_bridge];
        pool.liquidity = _liquidity;
        pool.utilizedLiquidity = _utilized;
        pool.utilizationRate = _liquidity > 0
            ? (_utilized * 10000) / _liquidity
            : 0;

        // Check utilization thresholds
        if (pool.utilizationRate > config.maxUtilization) {
            emit UtilizationAlert(
                _bridge,
                pool.utilizationRate,
                config.maxUtilization
            );
        }
    }

    function depositLiquidity(
        address _bridge,
        uint256 _amount
    ) external nonReentrant {
        require(pools[_bridge].isActive, "Pool not registered");

        BridgePool storage pool = pools[_bridge];
        require(pool.canReceive, "Pool cannot receive");

        REBALANCE_TOKEN.safeTransferFrom(msg.sender, address(this), _amount);
        pool.liquidity += _amount;

        _updateUtilization(_bridge);

        emit LiquidityDeposited(_bridge, _amount, pool.liquidity);
    }

    function withdrawLiquidity(
        address _bridge,
        uint256 _amount
    ) external nonReentrant {
        require(pools[_bridge].isActive, "Pool not registered");

        BridgePool storage pool = pools[_bridge];
        require(
            pool.liquidity - pool.pendingOutflows >= _amount,
            "Insufficient liquidity"
        );

        pool.liquidity -= _amount;
        REBALANCE_TOKEN.safeTransfer(msg.sender, _amount);

        _updateUtilization(_bridge);

        emit LiquidityWithdrawn(_bridge, _amount, pool.liquidity);
    }

    function _updateUtilization(address _bridge) internal {
        BridgePool storage pool = pools[_bridge];
        pool.utilizationRate = pool.liquidity > 0
            ? (pool.utilizedLiquidity * 10000) / pool.liquidity
            : 0;
    }

    // ============ Demand Forecasting ============

    function updateDemandForecast(
        address _bridge,
        uint256 _predictedInflow,
        uint256 _predictedOutflow,
        uint256 _confidence
    ) external onlyRole(ORACLE_ROLE) {
        require(pools[_bridge].isActive, "Pool not registered");

        uint256 forecastId = uint256(
            keccak256(abi.encode(_bridge, block.timestamp))
        );

        demandForecasts[forecastId] = DemandForecast({
            predictedInflow: _predictedInflow,
            predictedOutflow: _predictedOutflow,
            confidence: _confidence,
            forecastTime: block.timestamp,
            window: 1 hours
        });

        emit DemandForecastUpdated(
            _bridge,
            _predictedInflow,
            _predictedOutflow
        );
    }

    // ============ Rebalancing Logic ============

    function createRebalancePlan(
        address _sourceBridge,
        address _destBridge,
        uint256 _amount,
        uint256 _deadline
    ) external onlyRole(REBALANCER_ROLE) returns (uint256 planId) {
        require(_sourceBridge != _destBridge, "Same bridge");
        require(pools[_sourceBridge].isActive, "Source not registered");
        require(pools[_destBridge].isActive, "Dest not registered");
        require(_amount > 0, "Invalid amount");
        require(_amount <= config.maxRebalanceAmount, "Amount too large");
        require(_deadline > block.timestamp, "Invalid deadline");

        BridgePool storage source = pools[_sourceBridge];
        BridgePool storage dest = pools[_destBridge];

        // Check source has enough liquidity
        uint256 available = source.liquidity - source.pendingOutflows;
        require(available >= _amount, "Insufficient source liquidity");

        // Check cooldown
        require(
            block.timestamp - source.lastRebalance >= config.cooldownPeriod,
            "Cooldown active"
        );

        planId = planCount++;

        rebalancePlans[planId] = RebalancePlan({
            planId: planId,
            sourceBridge: _sourceBridge,
            destBridge: _destBridge,
            amount: _amount,
            expectedReturn: _amount,
            deadline: _deadline,
            executed: false,
            cancelled: false,
            createdAt: block.timestamp
        });

        // Reserve liquidity from source
        source.pendingOutflows += _amount;

        emit RebalancePlanCreated(planId, _sourceBridge, _destBridge, _amount);
        return planId;
    }

    function executeRebalancePlan(
        uint256 _planId
    ) external nonReentrant onlyRole(REBALANCER_ROLE) returns (bool success) {
        RebalancePlan storage plan = rebalancePlans[_planId];
        require(!plan.executed, "Already executed");
        require(!plan.cancelled, "Cancelled");
        require(block.timestamp <= plan.deadline, "Deadline passed");

        BridgePool storage source = pools[plan.sourceBridge];
        BridgePool storage dest = pools[plan.destBridge];

        require(dest.canReceive, "Destination cannot receive");

        // Execute transfer
        uint256 amountToSend = plan.amount;

        // Apply rebalance fee
        if (rebalanceFee > 0) {
            uint256 fee = (amountToSend * rebalanceFee) / 10000;
            amountToSend -= fee;
            collectedFees += fee;
        }

        // Update source
        source.pendingOutflows -= plan.amount;
        source.liquidity -= plan.amount;
        source.lastRebalance = block.timestamp;

        // Update destination
        dest.liquidity += amountToSend;

        plan.executed = true;

        _updateUtilization(plan.sourceBridge);
        _updateUtilization(plan.destBridge);

        emit RebalanceExecuted(
            _planId,
            amountToSend,
            block.timestamp - plan.createdAt
        );
        return true;
    }

    function cancelRebalancePlan(
        uint256 _planId
    ) external onlyRole(REBALANCER_ROLE) {
        RebalancePlan storage plan = rebalancePlans[_planId];
        require(!plan.executed, "Already executed");
        require(!plan.cancelled, "Already cancelled");

        // Release reserved liquidity
        BridgePool storage source = pools[plan.sourceBridge];
        source.pendingOutflows -= plan.amount;

        plan.cancelled = true;

        emit RebalanceCancelled(_planId);
    }

    // ============ Automatic Rebalancing ============

    function _checkAndRebalanceInternal(
        address _bridge
    ) internal view returns (bool needsRebalance, uint256 suggestedAmount) {
        require(pools[_bridge].isActive, "Pool not registered");

        BridgePool storage pool = pools[_bridge];

        uint256 currentUtilization = pool.utilizationRate;
        uint256 targetUtilization = pool.targetLiquidity;

        if (currentUtilization > targetUtilization + DEVIATION_THRESHOLD) {
            needsRebalance = true;
            suggestedAmount = (pool.totalLiquidity * (currentUtilization - targetUtilization)) / 1e18;
        } else if (currentUtilization < targetUtilization - DEVIATION_THRESHOLD) {
            needsRebalance = true;
            suggestedAmount = 0;
        }
    }

    function checkAndRebalance(
        address _bridge
    )
        external
        view
        onlyRole(REBALANCER_ROLE)
        returns (bool needsRebalance, uint256 suggestedAmount)
    {
        return _checkAndRebalanceInternal(_bridge);
    }

    function _findPoolWithExcess()
        internal
        view
        returns (address pool, uint256 amount)
    {
        for (uint256 i = 0; i < registeredPools.length; i++) {
            BridgePool storage pool = pools[registeredPools[i]];

            if (!pool.isActive || !pool.canReceive) continue;
            if (pool.utilizationRate > config.maxUtilization) continue;

            uint256 available = pool.liquidity - pool.pendingOutflows;
            uint256 targetExcess = pool.liquidity > pool.targetLiquidity
                ? pool.liquidity - pool.targetLiquidity
                : 0;

            if (available > pool.minLiquidity + targetExcess) {
                return (registeredPools[i], available - pool.minLiquidity);
            }
        }

        return (address(0), 0);
    }

    function executeAutoRebalance()
        external
        onlyRole(REBALANCER_ROLE)
        nonReentrant
        returns (uint256 plansExecuted)
    {
        uint256 maxPlansPerCall = 5;
        plansExecuted = 0;

        for (
            uint256 i = 0;
            i < registeredPools.length && plansExecuted < maxPlansPerCall;
            i++
        ) {
            address bridge = registeredPools[i];

            (bool needsRebalance, uint256 suggestedAmount) = this.checkAndRebalance(
                bridge
            );

            if (needsRebalance && suggestedAmount > 0) {
                (address excessPool, ) = _findPoolWithExcess();

                if (excessPool != address(0)) {
                    uint256 planId = this.createRebalancePlan(
                        excessPool,
                        bridge,
                        suggestedAmount,
                        block.timestamp + 1 hours
                    );

                    if (this.executeRebalancePlan(planId)) {
                        plansExecuted++;
                    }
                }
            }
        }
    }

    // ============ Admin Functions ============

    function updateConfig(
        uint256 _minUtilization,
        uint256 _maxUtilization,
        uint256 _rebalanceThreshold,
        uint256 _cooldownPeriod,
        uint256 _maxRebalanceAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minUtilization < _maxUtilization, "Invalid utilization range");
        require(_rebalanceThreshold <= 5000, "Threshold too high"); // max 50%

        config.minUtilization = _minUtilization;
        config.maxUtilization = _maxUtilization;
        config.rebalanceThreshold = _rebalanceThreshold;
        config.cooldownPeriod = _cooldownPeriod;
        config.maxRebalanceAmount = _maxRebalanceAmount;

        emit ConfigUpdated(
            _minUtilization,
            _maxUtilization,
            _rebalanceThreshold
        );
    }

    function updateRebalanceFee(
        uint256 _fee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_fee <= 1000, "Fee too high"); // max 10%
        rebalanceFee = _fee;
        emit FeeUpdated(_fee);
    }

    function updateFeeRecipient(
        address _recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_recipient != address(0), "Invalid recipient");
        feeRecipient = _recipient;
    }

    function togglePoolReceiving(
        address _bridge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_bridge].isActive, "Pool not registered");
        pools[_bridge].canReceive = !pools[_bridge].canReceive;
    }

    function withdrawCollectedFees() external nonReentrant {
        require(collectedFees > 0, "No fees");
        uint256 amount = collectedFees;
        collectedFees = 0;
        REBALANCE_TOKEN.safeTransfer(feeRecipient, amount);
    }

    // ============ View Functions ============

    function getPoolInfo(
        address _bridge
    )
        external
        view
        returns (
            uint256 liquidity,
            uint256 utilizedLiquidity,
            uint256 utilizationRate,
            uint256 pendingOutflows,
            bool isActive,
            bool canReceive,
            uint256 lastRebalance
        )
    {
        BridgePool storage pool = pools[_bridge];
        return (
            pool.liquidity,
            pool.utilizedLiquidity,
            pool.utilizationRate,
            pool.pendingOutflows,
            pool.isActive,
            pool.canReceive,
            pool.lastRebalance
        );
    }

    function getAllPools() external view returns (address[] memory) {
        return registeredPools;
    }

    function getRebalancePlan(
        uint256 _planId
    )
        external
        view
        returns (
            address sourceBridge,
            address destBridge,
            uint256 amount,
            bool executed,
            bool cancelled,
            uint256 createdAt,
            uint256 deadline
        )
    {
        RebalancePlan storage plan = rebalancePlans[_planId];
        return (
            plan.sourceBridge,
            plan.destBridge,
            plan.amount,
            plan.executed,
            plan.cancelled,
            plan.createdAt,
            plan.deadline
        );
    }

    function getRebalanceRecommendations()
        external
        view
        returns (
            address[] memory sources,
            address[] memory dests,
            uint256[] memory amounts
        )
    {
        uint256 count;
        for (uint256 i = 0; i < registeredPools.length; i++) {
            (bool needs, ) = _checkAndRebalanceInternal(registeredPools[i]);
            if (needs) count++;
        }

        sources = new address[](count);
        dests = new address[](count);
        amounts = new uint256[](count);

        uint256 idx;
        for (uint256 i = 0; i < registeredPools.length; i++) {
            (bool needsRebalance, uint256 amount) = _checkAndRebalanceInternal(
                registeredPools[i]
            );
            if (needsRebalance) {
                (address excessPool, ) = _findPoolWithExcess();
                sources[idx] = excessPool;
                dests[idx] = registeredPools[i];
                amounts[idx] = amount;
                idx++;
            }
        }
    }
}
