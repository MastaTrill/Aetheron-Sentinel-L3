// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @dev Minimal interface for SentinelInterceptor
interface ISentinelInterceptor {
    function getAnomalyStats()
        external
        view
        returns (
            uint256 totalCount,
            uint256 lastBlock,
            uint256 consecutive,
            uint256 currentBlockFrequency
        );
}

/// @dev Minimal interface for AetheronBridge
interface IAetheronBridge {
    function getBridgeStats()
        external
        view
        returns (uint256 tvl, uint256 fee, uint256 supportedTokenCount);

    function totalTransferCount() external view returns (uint256);
}

/// @dev Minimal interface for CircuitBreaker
interface ICircuitBreaker {
    function getCircuitStats(
        uint256 chainId
    )
        external
        view
        returns (
            uint8 state,
            uint256 failures,
            uint256 lastFailure,
            uint256 successCount,
            bool isShutdown
        );
}

/**
 * @title SentinelMonitor
 * @notice Aggregates and analyzes data from all Sentinel components
 */
contract SentinelMonitor is Ownable, ReentrancyGuard {
    struct SystemHealth {
        uint256 sentinelAnomalies;
        uint256 bridgeTVL;
        uint256 activeCircuits;
        uint256 totalTransfers;
        bool overallHealth;
        uint256 lastUpdate;
    }

    struct AlertCondition {
        string description;
        uint256 threshold;
        bool active;
        uint256 severity;
    }

    SystemHealth public systemHealth;
    mapping(string => AlertCondition) public alertConditions;
    mapping(address => bool) public authorizedContracts;

    // Tracked chain IDs for circuit breaker aggregation
    uint256[] public trackedChainIds;

    event HealthUpdated(SystemHealth health);
    event AlertTriggered(string conditionId, uint256 severity, string message);
    event ContractAuthorized(address contractAddress);
    event AlertConditionSet(
        string conditionId,
        uint256 threshold,
        uint256 severity
    );

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        // Set default alert conditions
        _setAlertCondition(
            "high_anomalies",
            10,
            8,
            "High anomaly count detected"
        );
        _setAlertCondition(
            "low_tvl",
            1000 ether,
            7,
            "TVL dropped below threshold"
        );
        _setAlertCondition(
            "circuit_failures",
            3,
            9,
            "Multiple circuits failed"
        );
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Add a chain ID to track in circuit breaker aggregation
     * @param chainId Chain ID to track
     */
    function addTrackedChain(uint256 chainId) external onlyOwner {
        require(chainId > 0, "Invalid chain ID");
        trackedChainIds.push(chainId);
    }

    /**
     * @notice Update system health from multiple sources
     * @param sentinelContract Address of sentinel contract
     * @param bridgeContract Address of bridge contract
     * @param circuitBreakerContract Address of circuit breaker contract
     */
    function updateHealth(
        address sentinelContract,
        address bridgeContract,
        address circuitBreakerContract
    ) external onlyOwner {
        require(
            authorizedContracts[sentinelContract],
            "Sentinel not authorized"
        );
        require(authorizedContracts[bridgeContract], "Bridge not authorized");
        require(
            authorizedContracts[circuitBreakerContract],
            "CircuitBreaker not authorized"
        );

        // Pull live anomaly count from SentinelInterceptor
        (uint256 totalAnomalies, , , ) = ISentinelInterceptor(sentinelContract)
            .getAnomalyStats();
        systemHealth.sentinelAnomalies = totalAnomalies;

        // Pull live TVL and transfer count from AetheronBridge
        (uint256 tvl, , ) = IAetheronBridge(bridgeContract).getBridgeStats();
        systemHealth.bridgeTVL = tvl;
        systemHealth.totalTransfers = IAetheronBridge(bridgeContract)
            .totalTransferCount();

        // Count open circuits across all tracked chains
        uint256 openCircuits = 0;
        for (uint256 i = 0; i < trackedChainIds.length; i++) {
            (uint8 state, , , , ) = ICircuitBreaker(circuitBreakerContract)
                .getCircuitStats(trackedChainIds[i]);
            if (state != 0) {
                // 0 = CLOSED
                openCircuits++;
            }
        }
        systemHealth.activeCircuits = openCircuits;
        systemHealth.lastUpdate = block.timestamp;

        // Calculate overall health
        systemHealth.overallHealth = _calculateOverallHealth();

        emit HealthUpdated(systemHealth);

        // Check alert conditions
        _checkAlerts();
    }

    /**
     * @notice Authorize a contract for health monitoring
     * @param contractAddress Contract to authorize
     */
    function authorizeContract(address contractAddress) external onlyOwner {
        require(contractAddress != address(0), "Invalid contract address");
        authorizedContracts[contractAddress] = true;
        emit ContractAuthorized(contractAddress);
    }

    /**
     * @notice Set alert condition
     * @param conditionId Unique condition identifier
     * @param threshold Alert threshold
     * @param severity Alert severity (1-10)
     * @param description Alert description
     */
    function setAlertCondition(
        string calldata conditionId,
        uint256 threshold,
        uint256 severity,
        string calldata description
    ) external onlyOwner {
        _setAlertCondition(conditionId, threshold, severity, description);
    }

    /**
     * @notice Get current system health
     */
    function getSystemHealth() external view returns (SystemHealth memory) {
        return systemHealth;
    }

    /**
     * @notice Check if system is in critical state
     */
    function isCriticalState() external view returns (bool) {
        return
            !systemHealth.overallHealth ||
            systemHealth.sentinelAnomalies >
            alertConditions["high_anomalies"].threshold ||
            systemHealth.bridgeTVL < alertConditions["low_tvl"].threshold;
    }

    /**
     * @notice Internal function to set alert condition
     */
    function _setAlertCondition(
        string memory conditionId,
        uint256 threshold,
        uint256 severity,
        string memory description
    ) internal {
        alertConditions[conditionId] = AlertCondition({
            description: description,
            threshold: threshold,
            active: true,
            severity: severity
        });
        emit AlertConditionSet(conditionId, threshold, severity);
    }

    /**
     * @notice Calculate overall system health
     */
    function _calculateOverallHealth() internal view returns (bool) {
        return
            systemHealth.sentinelAnomalies < 20 &&
            systemHealth.bridgeTVL > 10000 ether &&
            systemHealth.activeCircuits < 5;
    }

    /**
     * @notice Check all alert conditions and trigger if needed
     */
    function _checkAlerts() internal {
        // Check high anomalies
        if (
            systemHealth.sentinelAnomalies >
            alertConditions["high_anomalies"].threshold
        ) {
            emit AlertTriggered(
                "high_anomalies",
                alertConditions["high_anomalies"].severity,
                alertConditions["high_anomalies"].description
            );
        }

        // Check low TVL
        if (systemHealth.bridgeTVL < alertConditions["low_tvl"].threshold) {
            emit AlertTriggered(
                "low_tvl",
                alertConditions["low_tvl"].severity,
                alertConditions["low_tvl"].description
            );
        }

        // Check circuit failures
        if (
            systemHealth.activeCircuits >
            alertConditions["circuit_failures"].threshold
        ) {
            emit AlertTriggered(
                "circuit_failures",
                alertConditions["circuit_failures"].severity,
                alertConditions["circuit_failures"].description
            );
        }
    }
}
