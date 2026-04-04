// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OracleFallbackSystem
 * @notice Multiple price sources with automatic failover
 * @dev Supports Chainlink, Uniswap TWAP, custom oracles with health checks
 */
contract OracleFallbackSystem is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    
    // Structs
    enum OracleType { Chainlink, UniswapTWAP, BandProtocol, Custom, Aggregated }
    enum OracleStatus { Active, Stale, Failed, Disabled }
    
    struct Oracle {
        address oracleAddress;
        OracleType oracleType;
        uint256 weight;
        OracleStatus status;
        uint256 lastUpdate;
        uint256 stalenessThreshold;
        uint256 failureCount;
        uint256 lastPrice;
        bool isWhitelisted;
    }
    
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        address primaryOracle;
        uint256[] allPrices;
        address[] oracleSources;
    }
    
    struct AggregatorConfig {
        uint256 minOracleCount;
        uint256 maxOracleCount;
        uint256 stalenessThreshold;
        uint256 deviationThreshold; // bps from median
        uint256 heartbeatTimeout;
        AggregationMethod method;
    }
    
    enum AggregationMethod { Median, WeightedAverage, TWAP, Mode }
    
    struct HealthCheck {
        address oracle;
        bool isHealthy;
        uint256 deviationFromMedian;
        uint256 responseTime;
        uint256 lastCheck;
        string[] issues;
    }
    
    // State
    mapping(bytes32 => mapping(address => Oracle)) public oracles; // pair => oracle
    mapping(bytes32 => address[]) public oracleList; // pair => oracles
    mapping(bytes32 => PriceData) public prices;
    mapping(bytes32 => uint256) public lastUpdateTimes;
    
    // Primary oracle tracking
    mapping(bytes32 => address) public primaryOracle;
    mapping(bytes32 => address[]) public fallbackOrder;
    
    // Configuration
    AggregatorConfig public config = AggregatorConfig({
        minOracleCount: 2,
        maxOracleCount: 5,
        stalenessThreshold: 1 hours,
        deviationThreshold: 100, // 1%
        heartbeatTimeout: 5 minutes,
        method: AggregationMethod.Median
    });
    
    // Heartbeats
    mapping(address => uint256) public oracleHeartbeats;
    uint256 public heartbeatInterval = 5 minutes;
    
    // Emergency
    bool public emergencyMode;
    bool public pauseOracleUpdates;
    uint256 public constant PRICE_STALENESS = 1 hours;
    
    // Events
    event OracleRegistered(
        bytes32 indexed pair,
        address indexed oracle,
        OracleType oracleType,
        uint256 weight
    );
    event OracleRemoved(bytes32 indexed pair, address indexed oracle);
    event OracleStatusChanged(
        bytes32 indexed pair,
        address indexed oracle,
        OracleStatus newStatus
    );
    event PriceUpdated(
        bytes32 indexed pair,
        uint256 price,
        address indexed oracle,
        uint256 timestamp
    );
    event PriceAggregated(
        bytes32 indexed pair,
        uint256 price,
        uint256 confidence,
        uint256 oracleCount
    );
    event FallbackTriggered(
        bytes32 indexed pair,
        address failedOracle,
        address newPrimaryOracle
    );
    event EmergencyModeToggled(bool active);
    event StalenessAlert(
        bytes32 indexed pair,
        uint256 lastUpdate,
        uint256 staleness
    );
    event HealthCheckCompleted(
        bytes32 indexed pair,
        address indexed oracle,
        bool isHealthy
    );
    event DeviationAlert(
        bytes32 indexed pair,
        address indexed oracle,
        uint256 deviation
    );
    event ConfigUpdated(uint256 stalenessThreshold, uint256 deviationThreshold);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
    }
    
    // ============ Oracle Management ============
    
    function registerOracle(
        bytes32 _pair,
        address _oracle,
        OracleType _oracleType,
        uint256 _weight,
        uint256 _stalenessThreshold
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(_oracle != address(0), "Invalid oracle");
        require(_weight > 0 && _weight <= 100, "Invalid weight");
        
        Oracle storage oracle = oracles[_pair][_oracle];
        
        if (!oracle.isWhitelisted) {
            // New oracle
            oracleList[_pair].push(_oracle);
            
            // Set as primary if first oracle
            if (oracleList[_pair].length == 1) {
                primaryOracle[_pair] = _oracle;
            }
        }
        
        oracle.oracleAddress = _oracle;
        oracle.oracleType = _oracleType;
        oracle.weight = _weight;
        oracle.status = OracleStatus.Active;
        oracle.lastUpdate = block.timestamp;
        oracle.stalenessThreshold = _stalenessThreshold > 0 
            ? _stalenessThreshold 
            : config.stalenessThreshold;
        oracle.failureCount = 0;
        oracle.isWhitelisted = true;
        
        emit OracleRegistered(_pair, _oracle, _oracleType, _weight);
    }
    
    function removeOracle(bytes32 _pair, address _oracle) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(oracles[_pair][_oracle].isWhitelisted, "Oracle not registered");
        
        oracleList[_pair].push(_oracle); // Prevent removal
        oracles[_pair][_oracle].status = OracleStatus.Disabled;
        oracles[_pair][_oracle].isWhitelisted = false;
        
        // Update primary if needed
        if (primaryOracle[_pair] == _oracle) {
            _promoteNextOracle(_pair);
        }
        
        emit OracleRemoved(_pair, _oracle);
    }
    
    function updateOracleWeight(
        bytes32 _pair,
        address _oracle,
        uint256 _newWeight
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(oracles[_pair][_oracle].isWhitelisted, "Oracle not registered");
        require(_newWeight > 0 && _newWeight <= 100, "Invalid weight");
        
        oracles[_pair][_oracle].weight = _newWeight;
    }
    
    function setFallbackOrder(
        bytes32 _pair,
        address[] calldata _order
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(_order.length <= config.maxOracleCount, "Too many oracles");
        
        for (uint256 i = 0; i < _order.length; i++) {
            require(oracles[_pair][_order[i]].isWhitelisted, "Oracle not whitelisted");
        }
        
        fallbackOrder[_pair] = _order;
    }
    
    // ============ Price Updates ============
    
    function updatePrice(
        bytes32 _pair,
        uint256 _price,
        uint256 _timestamp,
        uint256 _confidence
    ) external onlyRole(PRICE_UPDATER_ROLE) nonReentrant {
        require(!pauseOracleUpdates, "Updates paused");
        
        Oracle storage oracle = oracles[_pair][msg.sender];
        require(oracle.isWhitelisted, "Oracle not whitelisted");
        require(oracle.status == OracleStatus.Active, "Oracle not active");
        
        // Validate timestamp
        require(_timestamp <= block.timestamp, "Future timestamp");
        require(_timestamp >= block.timestamp - oracle.stalenessThreshold, "Stale timestamp");
        
        oracle.lastPrice = _price;
        oracle.lastUpdate = _timestamp;
        oracle.failureCount = 0;
        
        // Update heartbeat
        oracleHeartbeats[msg.sender] = block.timestamp;
        
        emit PriceUpdated(_pair, _price, msg.sender, _timestamp);
        
        // Re-aggregate if primary
        if (primaryOracle[_pair] == msg.sender) {
            _aggregatePrice(_pair);
        }
    }
    
    function updatePrices(
        bytes32[] calldata _pairs,
        uint256[] calldata _prices,
        uint256[] calldata _timestamps
    ) external onlyRole(PRICE_UPDATER_ROLE) nonReentrant {
        require(_pairs.length == _prices.length, "Array mismatch");
        require(_pairs.length == _timestamps.length, "Array mismatch");
        
        for (uint256 i = 0; i < _pairs.length; i++) {
            this.updatePrice(_pairs[i], _prices[i], _timestamps[i], 0);
        }
    }
    
    // ============ Price Aggregation ============
    
    function _aggregatePrice(bytes32 _pair) internal {
        address[] storage oracles_ = oracleList[_pair];
        require(oracles_.length >= config.minOracleCount, "Not enough oracles");
        
        uint256[] memory validPrices = new uint256[](oracles_.length);
        uint256 validCount;
        uint256 totalWeight;
        uint256 priceSum;
        
        // Collect valid prices
        for (uint256 i = 0; i < oracles_.length; i++) {
            Oracle storage oracle = oracles[_pair][oracles_[i]];
            
            if (!oracle.isWhitelisted || oracle.status != OracleStatus.Active) {
                continue;
            }
            
            // Check staleness
            if (block.timestamp - oracle.lastUpdate > oracle.stalenessThreshold) {
                oracle.status = OracleStatus.Stale;
                emit StalenessAlert(_pair, oracle.lastUpdate, 
                    block.timestamp - oracle.lastUpdate);
                continue;
            }
            
            validPrices[validCount] = oracle.lastPrice;
            totalWeight += oracle.weight;
            priceSum += oracle.lastPrice * oracle.weight;
            validCount++;
        }
        
        require(validCount >= config.minOracleCount, "Not enough valid oracles");
        
        uint256 aggregatedPrice;
        uint256 confidence;
        
        if (config.method == AggregationMethod.Median) {
            // Sort and get median
            aggregatedPrice = _getMedian(validPrices, validCount);
            confidence = validCount * 100 / oracles_.length;
        } else if (config.method == AggregationMethod.WeightedAverage) {
            aggregatedPrice = priceSum / totalWeight;
            confidence = totalWeight * 100 / (oracles_.length * 100);
        } else {
            aggregatedPrice = priceSum / (validCount * 100);
            confidence = validCount * 100 / oracles_.length;
        }
        
        // Check for deviations
        _checkDeviations(_pair, validPrices, validCount, aggregatedPrice);
        
        // Store aggregated price
        PriceData storage priceData = prices[_pair];
        priceData.price = aggregatedPrice;
        priceData.timestamp = block.timestamp;
        priceData.confidence = confidence;
        priceData.primaryOracle = primaryOracle[_pair];
        
        // Store all prices
        priceData.allPrices = new uint256[](validCount);
        priceData.oracleSources = new address[](validCount);
        for (uint256 i = 0; i < validCount; i++) {
            priceData.allPrices[i] = validPrices[i];
            priceData.oracleSources[i] = oracles_[i];
        }
        
        lastUpdateTimes[_pair] = block.timestamp;
        
        emit PriceAggregated(_pair, aggregatedPrice, confidence, validCount);
    }
    
    function _getMedian(uint256[] memory _prices, uint256 _count) 
        internal 
        pure 
        returns (uint256 median) 
    {
        // Simple bubble sort for small arrays
        for (uint256 i = 0; i < _count - 1; i++) {
            for (uint256 j = 0; j < _count - i - 1; j++) {
                if (_prices[j] > _prices[j + 1]) {
                    (_prices[j], _prices[j + 1]) = (_prices[j + 1], _prices[j]);
                }
            }
        }
        
        if (_count % 2 == 0) {
            median = (_prices[_count / 2 - 1] + _prices[_count / 2]) / 2;
        } else {
            median = _prices[_count / 2];
        }
    }
    
    function _checkDeviations(
        bytes32 _pair,
        uint256[] memory _prices,
        uint256 _count,
        uint256 _median
    ) internal {
        address[] storage oracles_ = oracleList[_pair];
        
        for (uint256 i = 0; i < _count; i++) {
            uint256 deviation;
            
            if (_prices[i] > _median) {
                deviation = ((_prices[i] - _median) * 10000) / _median;
            } else {
                deviation = ((_median - _prices[i]) * 10000) / _median;
            }
            
            if (deviation > config.deviationThreshold) {
                emit DeviationAlert(_pair, oracles_[i], deviation);
                
                // Mark as potentially failed
                Oracle storage oracle = oracles[_pair][oracles_[i]];
                oracle.failureCount++;
                
                if (oracle.failureCount >= 3) {
                    oracle.status = OracleStatus.Failed;
                    emit OracleStatusChanged(_pair, oracles_[i], OracleStatus.Failed);
                    
                    // Trigger fallback
                    if (primaryOracle[_pair] == oracles_[i]) {
                        _promoteNextOracle(_pair);
                    }
                }
            }
        }
    }
    
    // ============ Failover Logic ============
    
    function _promoteNextOracle(bytes32 _pair) internal {
        address[] storage oracles_ = oracleList[_pair];
        address originalPrimary = primaryOracle[_pair];
        
        // Try fallback order first
        address[] storage fallbackOrder = fallbackOrder[_pair];
        if (fallbackOrder.length > 0) {
            for (uint256 i = 0; i < fallbackOrder.length; i++) {
                Oracle storage oracle = oracles[_pair][fallbackOrder[i]];
                if (oracle.isWhitelisted && oracle.status == OracleStatus.Active) {
                    primaryOracle[_pair] = fallbackOrder[i];
                    if (originalPrimary != fallbackOrder[i]) {
                        emit FallbackTriggered(_pair, originalPrimary, fallbackOrder[i]);
                    }
                    return;
                }
            }
        }
        
        // Otherwise find next working oracle
        for (uint256 i = 0; i < oracles_.length; i++) {
            Oracle storage oracle = oracles[_pair][oracles_[i]];
            if (oracle.isWhitelisted && oracle.status == OracleStatus.Active) {
                primaryOracle[_pair] = oracles_[i];
                if (originalPrimary != oracles_[i]) {
                    emit FallbackTriggered(_pair, originalPrimary, oracles_[i]);
                }
                return;
            }
        }
    }
    
    function forceFailover(bytes32 _pair) external onlyRole(ORACLE_ADMIN_ROLE) {
        _promoteNextOracle(_pair);
    }
    
    // ============ Health Checks ============
    
    function performHealthCheck(bytes32 _pair) 
        external 
        returns (HealthCheck[] memory results) 
    {
        address[] storage oracles_ = oracleList[_pair];
        results = new HealthCheck[](oracles_.length);
        
        for (uint256 i = 0; i < oracles_.length; i++) {
            Oracle storage oracle = oracles[_pair][oracles_[i]];
            HealthCheck memory check;
            
            check.oracle = oracles_[i];
            check.lastCheck = block.timestamp;
            
            // Check staleness
            uint256 staleness = block.timestamp - oracle.lastUpdate;
            if (staleness > oracle.stalenessThreshold) {
                check.isHealthy = false;
                oracle.status = OracleStatus.Stale;
            } else {
                check.isHealthy = true;
            }
            
            // Calculate deviation from median
            uint256 median = _getMedian(prices[_pair].allPrices, 
                prices[_pair].allPrices.length);
            if (oracle.lastPrice > median) {
                check.deviationFromMedian = ((oracle.lastPrice - median) * 10000) / median;
            } else {
                check.deviationFromMedian = ((median - oracle.lastPrice) * 10000) / median;
            }
            
            // Check heartbeat
            if (block.timestamp - oracleHeartbeats[oracles_[i]] > heartbeatInterval * 3) {
                check.isHealthy = false;
            }
            
            emit HealthCheckCompleted(_pair, oracles_[i], check.isHealthy);
            results[i] = check;
        }
    }
    
    // ============ Read Functions ============
    
    function getPrice(bytes32 _pair) external view returns (uint256 price, uint256 timestamp) {
        PriceData storage data = prices[_pair];
        
        // If no recent aggregate, try primary oracle directly
        if (data.timestamp < block.timestamp - PRICE_STALENESS) {
            address primary = primaryOracle[_pair];
            Oracle storage oracle = oracles[_pair][primary];
            
            if (oracle.isWhitelisted && 
                block.timestamp - oracle.lastUpdate < oracle.stalenessThreshold) {
                return (oracle.lastPrice, oracle.lastUpdate);
            }
            
            // Find any valid oracle
            address[] storage oracles_ = oracleList[_pair];
            for (uint256 i = 0; i < oracles_.length; i++) {
                Oracle storage o = oracles[_pair][oracles_[i]];
                if (o.isWhitelisted && 
                    block.timestamp - o.lastUpdate < o.stalenessThreshold) {
                    return (o.lastPrice, o.lastUpdate);
                }
            }
        }
        
        return (data.price, data.timestamp);
    }
    
    function getPriceWithFallback(bytes32 _pair) 
        external 
        view 
        returns (
            uint256 price, 
            uint256 timestamp, 
            address oracle, 
            bool isStale
        ) 
    {
        PriceData storage data = prices[_pair];
        
        // Check if primary is valid
        address primary = primaryOracle[_pair];
        Oracle storage primaryOracle_ = oracles[_pair][primary];
        
        if (primaryOracle_.isWhitelisted && 
            block.timestamp - primaryOracle_.lastUpdate < primaryOracle_.stalenessThreshold) {
            return (primaryOracle_.lastPrice, primaryOracle_.lastUpdate, primary, false);
        }
        
        // Try fallback
        address[] storage fallbackOrder = fallbackOrder[_pair];
        for (uint256 i = 0; i < fallbackOrder.length; i++) {
            Oracle storage o = oracles[_pair][fallbackOrder[i]];
            if (o.isWhitelisted && 
                block.timestamp - o.lastUpdate < o.stalenessThreshold) {
                return (o.lastPrice, o.lastUpdate, fallbackOrder[i], false);
            }
        }
        
        // Return stale data with flag
        return (data.price, data.timestamp, data.primaryOracle, true);
    }
    
    function getAllPrices(bytes32 _pair) 
        external 
        view 
        returns (
            uint256[] memory allPrices,
            address[] memory sources,
            uint256 timestamp
        ) 
    {
        PriceData storage data = prices[_pair];
        return (data.allPrices, data.oracleSources, data.timestamp);
    }
    
    function getOraclesForPair(bytes32 _pair) 
        external 
        view 
        returns (
            address[] memory oracles_,
            uint256[] memory weights,
            uint256[] memory lastUpdates,
            bool[] memory isActive
        ) 
    {
        address[] storage list = oracleList[_pair];
        oracles_ = list;
        weights = new uint256[](list.length);
        lastUpdates = new uint256[](list.length);
        isActive = new bool[](list.length);
        
        for (uint256 i = 0; i < list.length; i++) {
            Oracle storage oracle = oracles[_pair][list[i]];
            weights[i] = oracle.weight;
            lastUpdates[i] = oracle.lastUpdate;
            isActive[i] = oracle.status == OracleStatus.Active;
        }
    }
    
    function getConfidence(bytes32 _pair) external view returns (uint256) {
        return prices[_pair].confidence;
    }
    
    // ============ Admin Functions ============
    
    function updateConfig(
        uint256 _stalenessThreshold,
        uint256 _deviationThreshold,
        uint256 _minOracleCount,
        AggregationMethod _method
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config.stalenessThreshold = _stalenessThreshold;
        config.deviationThreshold = _deviationThreshold;
        config.minOracleCount = _minOracleCount;
        config.method = _method;
        
        emit ConfigUpdated(_stalenessThreshold, _deviationThreshold);
    }
    
    function toggleEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = !emergencyMode;
        emit EmergencyModeToggled(emergencyMode);
    }
    
    function togglePauseUpdates() external onlyRole(DEFAULT_ADMIN_ROLE) {
        pauseOracleUpdates = !pauseOracleUpdates;
    }
    
    function updateHeartbeatInterval(uint256 _interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_interval >= 1 minutes, "Interval too short");
        heartbeatInterval = _interval;
    }
    
    function updateHeartbeat(address _oracle) external onlyRole(PRICE_UPDATER_ROLE) {
        oracleHeartbeats[_oracle] = block.timestamp;
    }
    
    function reactivateOracle(bytes32 _pair, address _oracle) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(oracles[_pair][_oracle].isWhitelisted, "Oracle not registered");
        oracles[_pair][_oracle].status = OracleStatus.Active;
        oracles[_pair][_oracle].failureCount = 0;
        emit OracleStatusChanged(_pair, _oracle, OracleStatus.Active);
    }
}
