// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BridgeHealthMonitor
 * @notice Real-time dashboard tracking bridge utilization, latency, and anomalies
 * @dev Monitors multiple L2 bridges, tracks metrics, and triggers alerts
 */
contract BridgeHealthMonitor is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant ALERT_MANAGER_ROLE =
        keccak256("ALERT_MANAGER_ROLE");

    // Structs
    struct Bridge {
        address bridgeAddress;
        string name;
        uint256 chainId;
        bool isActive;
        bool isWhitelisted;
        uint256 totalVolume;
        uint256 totalTransactions;
        uint256 lastActivity;
        HealthScore healthScore;
    }

    struct HealthScore {
        uint256 overall; // 0-100
        uint256 latencyScore;
        uint256 liquidityScore;
        uint256 reliabilityScore;
        uint256 securityScore;
        uint256 lastUpdated;
    }

    struct TransactionMetrics {
        bytes32 txHash;
        address user;
        uint256 amount;
        uint256 timestamp;
        uint256 sourceChain;
        uint256 destChain;
        uint256 latency;
        bool completed;
        uint256 gasUsed;
        uint256 gasPrice;
    }

    struct Anomaly {
        uint256 id;
        address bridge;
        AnomalyType anomalyType;
        uint256 severity; // 1-5, 5 being most severe
        string description;
        uint256 timestamp;
        bool resolved;
        uint256 resolvedAt;
    }

    struct LatencyRecord {
        uint256 avgLatency;
        uint256 minLatency;
        uint256 maxLatency;
        uint256 p95Latency;
        uint256 samples;
    }

    enum AnomalyType {
        HighLatency,
        LowLiquidity,
        UnusualVolume,
        FailedTransactions,
        PriceDeviation,
        SuspiciousActivity,
        BridgeOffline,
        SecurityBreach
    }

    // State
    mapping(address => Bridge) public bridges;
    mapping(address => TransactionMetrics[]) public bridgeTransactions;
    mapping(address => LatencyRecord) public latencyRecords;
    mapping(address => Anomaly[]) public bridgeAnomalies;
    mapping(uint256 => address[]) public chainBridges;

    // Global metrics
    uint256 public totalVolumeAcrossAllBridges;
    uint256 public totalTransactionsAllBridges;
    uint256 public averageLatencyGlobal;
    uint256 public lastGlobalUpdate;

    // Thresholds
    uint256 public latencyThreshold = 30 minutes;
    uint256 public volumeSpikeMultiplier = 5; // 5x normal volume = spike
    uint256 public failureRateThreshold = 500; // 5% failure rate
    uint256 public minLiquidityThreshold = 10000e18;

    // Health monitoring intervals
    uint256 public healthCheckInterval = 15 minutes;
    mapping(address => uint256) public lastHealthCheck;

    // Alerts
    mapping(address => bool) public bridgeAlertsEnabled;
    uint256 public anomalyCount;
    uint256 public unresolvedAnomalyCount;

    // Events
    event BridgeRegistered(
        address indexed bridge,
        string name,
        uint256 chainId
    );
    event BridgeHealthUpdated(
        address indexed bridge,
        uint256 overallScore,
        uint256 latencyScore,
        uint256 liquidityScore
    );
    event AnomalyDetected(
        uint256 indexed anomalyId,
        address indexed bridge,
        AnomalyType anomalyType,
        uint256 severity
    );
    event AnomalyResolved(uint256 indexed anomalyId, uint256 resolutionTime);
    event TransactionRecorded(
        bytes32 indexed txHash,
        address indexed bridge,
        address indexed user,
        uint256 amount,
        uint256 latency
    );
    event AlertTriggered(
        address indexed bridge,
        string alertType,
        uint256 value,
        uint256 threshold
    );
    event LatencyUpdated(
        address indexed bridge,
        uint256 avgLatency,
        uint256 p95Latency
    );
    event VolumeSpikeDetected(
        address indexed bridge,
        uint256 currentVolume,
        uint256 avgVolume
    );
    event HealthCheckCompleted(address indexed bridge, uint256 score);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(ALERT_MANAGER_ROLE, msg.sender);
    }

    // ============ Bridge Registration ============

    function registerBridge(
        address _bridgeAddress,
        string calldata _name,
        uint256 _chainId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bridgeAddress != address(0), "Invalid address");
        require(!bridges[_bridgeAddress].isWhitelisted, "Already registered");

        bridges[_bridgeAddress] = Bridge({
            bridgeAddress: _bridgeAddress,
            name: _name,
            chainId: _chainId,
            isActive: true,
            isWhitelisted: true,
            totalVolume: 0,
            totalTransactions: 0,
            lastActivity: block.timestamp,
            healthScore: HealthScore({
                overall: 100,
                latencyScore: 100,
                liquidityScore: 100,
                reliabilityScore: 100,
                securityScore: 100,
                lastUpdated: block.timestamp
            })
        });

        chainBridges[_chainId].push(_bridgeAddress);

        emit BridgeRegistered(_bridgeAddress, _name, _chainId);
    }

    function deactivateBridge(
        address _bridge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bridges[_bridge].isWhitelisted, "Not registered");
        bridges[_bridge].isActive = false;
    }

    function reactivateBridge(
        address _bridge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bridges[_bridge].isWhitelisted, "Not registered");
        bridges[_bridge].isActive = true;
    }

    // ============ Metrics Updates ============

    function updateBridgeMetrics(
        address _bridge,
        uint256 _volume,
        uint256 _txCount,
        bool _success
    ) external onlyRole(ORACLE_ROLE) {
        require(bridges[_bridge].isWhitelisted, "Bridge not registered");

        Bridge storage bridge = bridges[_bridge];

        bridge.totalVolume += _volume;
        bridge.totalTransactions += _txCount;
        bridge.lastActivity = block.timestamp;

        totalVolumeAcrossAllBridges += _volume;
        totalTransactionsAllBridges += _txCount;

        // Check for volume spike
        uint256 avgVolume = bridge.totalVolume /
            (bridge.totalTransactions > 0 ? bridge.totalTransactions : 1);

        if (_volume > avgVolume * volumeSpikeMultiplier) {
            emit VolumeSpikeDetected(_bridge, _volume, avgVolume);
            _createAnomaly(
                _bridge,
                AnomalyType.UnusualVolume,
                3,
                "Unusual volume spike detected"
            );
        }
    }

    function recordTransaction(
        bytes32 _txHash,
        address _bridge,
        address _user,
        uint256 _amount,
        uint256 _latency,
        uint256 _gasUsed,
        uint256 _gasPrice
    ) external onlyRole(ORACLE_ROLE) {
        require(bridges[_bridge].isWhitelisted, "Bridge not registered");

        Bridge storage bridge = bridges[_bridge];
        bridge.totalVolume += _amount;
        bridge.totalTransactions++;
        bridge.lastActivity = block.timestamp;

        totalVolumeAcrossAllBridges += _amount;
        totalTransactionsAllBridges++;

        // Store transaction
        bridgeTransactions[_bridge].push(
            TransactionMetrics({
                txHash: _txHash,
                user: _user,
                amount: _amount,
                timestamp: block.timestamp,
                sourceChain: bridge.chainId,
                destChain: 0, // Set by oracle
                latency: _latency,
                completed: true,
                gasUsed: _gasUsed,
                gasPrice: _gasPrice
            })
        );

        // Update latency records
        _updateLatency(_bridge, _latency);

        // Check latency
        LatencyRecord storage latency = latencyRecords[_bridge];
        if (_latency > latencyThreshold) {
            _createAnomaly(
                _bridge,
                AnomalyType.HighLatency,
                2,
                "Transaction latency above threshold"
            );
        }

        emit TransactionRecorded(_txHash, _bridge, _user, _amount, _latency);
    }

    function _updateLatency(address _bridge, uint256 _latency) internal {
        LatencyRecord storage record = latencyRecords[_bridge];

        record.avgLatency =
            (record.avgLatency * record.samples + _latency) /
            (record.samples + 1);

        if (_latency < record.minLatency || record.minLatency == 0) {
            record.minLatency = _latency;
        }

        if (_latency > record.maxLatency) {
            record.maxLatency = _latency;
        }

        record.samples++;

        // Calculate P95 (simplified - use sorted array for accurate P95)
        if (record.samples >= 20) {
            record.p95Latency = record.avgLatency * 2; // Approximate
        }

        emit LatencyUpdated(_bridge, record.avgLatency, record.p95Latency);
    }

    // ============ Health Scoring ============

    function updateHealthScore(address _bridge) external {
        require(bridges[_bridge].isWhitelisted, "Bridge not registered");

        Bridge storage bridge = bridges[_bridge];
        HealthScore storage health = bridge.healthScore;

        // Calculate individual scores
        _updateLatencyScore(_bridge);
        _updateLiquidityScore(_bridge);
        _updateReliabilityScore(_bridge);
        _updateSecurityScore(_bridge);

        // Calculate overall score (weighted average)
        health.overall =
            (health.latencyScore *
                25 +
                health.liquidityScore *
                25 +
                health.reliabilityScore *
                30 +
                health.securityScore *
                20) /
            100;

        health.lastUpdated = block.timestamp;
        lastHealthCheck[_bridge] = block.timestamp;

        // Check for anomalies
        if (health.overall < 50) {
            _createAnomaly(
                _bridge,
                AnomalyType.BridgeOffline,
                4,
                "Health score critically low"
            );
        }

        emit BridgeHealthUpdated(
            _bridge,
            health.overall,
            health.latencyScore,
            health.liquidityScore
        );
    }

    function _updateLatencyScore(address _bridge) internal {
        LatencyRecord storage latency = latencyRecords[_bridge];
        HealthScore storage health = bridges[_bridge].healthScore;

        if (latency.avgLatency < latencyThreshold / 2) {
            health.latencyScore = 100;
        } else if (latency.avgLatency < latencyThreshold) {
            health.latencyScore = 75;
        } else if (latency.avgLatency < latencyThreshold * 2) {
            health.latencyScore = 50;
        } else {
            health.latencyScore = 25;
        }

        if (latency.p95Latency > latencyThreshold * 3) {
            health.latencyScore = health.latencyScore / 2;
        }
    }

    function _updateLiquidityScore(address _bridge) internal {
        HealthScore storage health = bridges[_bridge].healthScore;
        uint256 liquidity = _getBridgeLiquidity(_bridge);

        if (liquidity >= minLiquidityThreshold * 10) {
            health.liquidityScore = 100;
        } else if (liquidity >= minLiquidityThreshold) {
            health.liquidityScore = 75;
        } else if (liquidity >= minLiquidityThreshold / 2) {
            health.liquidityScore = 50;
        } else {
            health.liquidityScore = 25;
            _createAnomaly(
                _bridge,
                AnomalyType.LowLiquidity,
                3,
                "Bridge liquidity below minimum threshold"
            );
        }
    }

    function _updateReliabilityScore(address _bridge) internal {
        HealthScore storage health = bridges[_bridge].healthScore;
        TransactionMetrics[] storage txs = bridgeTransactions[_bridge];

        if (txs.length == 0) {
            health.reliabilityScore = 100;
            return;
        }

        uint256 failures;
        for (uint256 i = 0; i < txs.length && i < 100; i++) {
            if (!txs[txs.length - 1 - i].completed) {
                failures++;
            }
        }

        uint256 failureRate = (failures * 10000) /
            (txs.length > 100 ? 100 : txs.length);

        if (failureRate < 100) {
            // < 1%
            health.reliabilityScore = 100;
        } else if (failureRate < failureRateThreshold) {
            health.reliabilityScore = 75;
        } else if (failureRate < failureRateThreshold * 2) {
            health.reliabilityScore = 50;
        } else {
            health.reliabilityScore = 25;
            _createAnomaly(
                _bridge,
                AnomalyType.FailedTransactions,
                4,
                "High transaction failure rate"
            );
        }
    }

    function _updateSecurityScore(address _bridge) internal {
        HealthScore storage health = bridges[_bridge].healthScore;
        Anomaly[] storage anomalies = bridgeAnomalies[_bridge];

        uint256 unresolvedSecurityIssues;
        for (uint256 i = 0; i < anomalies.length; i++) {
            if (
                !anomalies[i].resolved &&
                (anomalies[i].anomalyType == AnomalyType.SecurityBreach ||
                    anomalies[i].anomalyType == AnomalyType.SuspiciousActivity)
            ) {
                unresolvedSecurityIssues++;
            }
        }

        if (unresolvedSecurityIssues == 0) {
            health.securityScore = 100;
        } else if (unresolvedSecurityIssues == 1) {
            health.securityScore = 75;
        } else if (unresolvedSecurityIssues == 2) {
            health.securityScore = 50;
        } else {
            health.securityScore = 25;
        }
    }

    function _getBridgeLiquidity(
        address _bridge
    ) internal view returns (uint256) {
        // This would integrate with the actual bridge contract
        // Simplified for now
        return 0;
    }

    // ============ Anomaly Detection ============

    function _createAnomaly(
        address _bridge,
        AnomalyType _type,
        uint256 _severity,
        string memory _description
    ) internal {
        require(bridges[_bridge].isWhitelisted, "Bridge not registered");

        uint256 anomalyId = anomalyCount++;
        unresolvedAnomalyCount++;

        bridgeAnomalies[_bridge].push(
            Anomaly({
                id: anomalyId,
                bridge: _bridge,
                anomalyType: _type,
                severity: _severity,
                description: _description,
                timestamp: block.timestamp,
                resolved: false,
                resolvedAt: 0
            })
        );

        if (bridgeAlertsEnabled[_bridge]) {
            emit AlertTriggered(
                _bridge,
                _getAnomalyTypeName(_type),
                _severity,
                _severity
            );
        }

        emit AnomalyDetected(anomalyId, _bridge, _type, _severity);
    }

    function _getAnomalyTypeName(
        AnomalyType _type
    ) internal pure returns (string memory) {
        if (_type == AnomalyType.HighLatency) return "HIGH_LATENCY";
        if (_type == AnomalyType.LowLiquidity) return "LOW_LIQUIDITY";
        if (_type == AnomalyType.UnusualVolume) return "UNUSUAL_VOLUME";
        if (_type == AnomalyType.FailedTransactions)
            return "FAILED_TRANSACTIONS";
        if (_type == AnomalyType.PriceDeviation) return "PRICE_DEVIATION";
        if (_type == AnomalyType.SuspiciousActivity)
            return "SUSPICIOUS_ACTIVITY";
        if (_type == AnomalyType.BridgeOffline) return "BRIDGE_OFFLINE";
        if (_type == AnomalyType.SecurityBreach) return "SECURITY_BREACH";
        return "UNKNOWN";
    }

    function resolveAnomaly(
        uint256 _anomalyId
    ) external onlyRole(ALERT_MANAGER_ROLE) {
        // Search all bridges for this anomaly
        for (uint256 i = 0; i < chainBridges[1].length; i++) {
            address bridge = chainBridges[1][i];
            Anomaly[] storage anomalies = bridgeAnomalies[bridge];

            for (uint256 j = 0; j < anomalies.length; j++) {
                if (anomalies[j].id == _anomalyId && !anomalies[j].resolved) {
                    anomalies[j].resolved = true;
                    anomalies[j].resolvedAt = block.timestamp;
                    unresolvedAnomalyCount--;

                    emit AnomalyResolved(
                        _anomalyId,
                        block.timestamp - anomalies[j].timestamp
                    );
                    return;
                }
            }
        }
    }

    // ============ Dashboard Data ============

    function getDashboardData(
        address _bridge
    )
        external
        view
        returns (
            string memory name,
            uint256 chainId,
            bool isActive,
            uint256 healthScore,
            uint256 totalVolume,
            uint256 totalTransactions,
            uint256 avgLatency,
            uint256 unresolvedAnomalies
        )
    {
        Bridge storage bridge = bridges[_bridge];
        HealthScore storage health = bridge.healthScore;
        LatencyRecord storage latency = latencyRecords[_bridge];

        return (
            bridge.name,
            bridge.chainId,
            bridge.isActive,
            health.overall,
            bridge.totalVolume,
            bridge.totalTransactions,
            latency.avgLatency,
            bridgeAnomalies[_bridge].length
        );
    }

    function getAllBridgeStats()
        external
        view
        returns (
            uint256 totalVol,
            uint256 totalTxs,
            uint256 avgLatency,
            uint256 totalBridges,
            uint256 healthyBridges,
            uint256 unresolvedAnomaliesTotal
        )
    {
        uint256 healthy;
        for (uint256 i = 1; i <= 10; i++) {
            address[] memory chain = chainBridges[i];
            for (uint256 j = 0; j < chain.length; j++) {
                if (bridges[chain[j]].healthScore.overall >= 70) {
                    healthy++;
                }
            }
        }

        return (
            totalVolumeAcrossAllBridges,
            totalTransactionsAllBridges,
            averageLatencyGlobal,
            totalBridges,
            healthy,
            unresolvedAnomalyCount
        );
    }

    function getRecentTransactions(
        address _bridge,
        uint256 _count
    ) external view returns (TransactionMetrics[] memory) {
        TransactionMetrics[] storage allTxs = bridgeTransactions[_bridge];
        uint256 start = allTxs.length > _count ? allTxs.length - _count : 0;
        uint256 length = allTxs.length > _count ? _count : allTxs.length;

        TransactionMetrics[] memory result = new TransactionMetrics[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = allTxs[start + i];
        }

        return result;
    }

    // ============ Admin Functions ============

    function updateThresholds(
        uint256 _latency,
        uint256 _volumeSpike,
        uint256 _failureRate,
        uint256 _minLiquidity
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        latencyThreshold = _latency;
        volumeSpikeMultiplier = _volumeSpike;
        failureRateThreshold = _failureRate;
        minLiquidityThreshold = _minLiquidity;
    }

    function toggleBridgeAlerts(
        address _bridge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bridges[_bridge].isWhitelisted, "Bridge not registered");
        bridgeAlertsEnabled[_bridge] = !bridgeAlertsEnabled[_bridge];
    }
}
