// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SentinelInterceptor
 * @notice Autonomous threat detection and response system for quantum-resistant bridges
 */
contract SentinelInterceptor is
    Ownable,
    AccessControl,
    ReentrancyGuard,
    Pausable
{
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

    uint256 public anomalyThreshold;
    uint256 public tvlThreshold;
    uint256 public currentTVL;
    bool public autonomousMode;
    uint256 public anomalyCount;
    uint256 public lastAnomalyBlock;
    uint256 public constant MAX_ANOMALIES_PER_BLOCK = 5;
    uint256 public constant COOLDOWN_PERIOD = 10; // blocks
    uint256 public lastActionBlock;
    uint256 public consecutiveAnomalies;

    mapping(uint256 => uint256) public thresholds; // thresholdType => value
    mapping(address => bool) public authorizedReporters;
    mapping(uint256 => uint256) public anomalyFrequency; // block => count

    event AnomalyDetected(
        uint256 anomalyType,
        uint256 severity,
        uint256 blockNumber
    );
    event AutonomousPauseTriggered(
        address indexed trigger,
        uint256 pauseDuration,
        uint256 blockNumber
    );
    event TVLUpdated(uint256 oldTVL, uint256 newTVL);
    event AutonomousModeToggled(bool enabled);
    event ThresholdUpdated(
        uint256 thresholdType,
        uint256 oldValue,
        uint256 newValue
    );
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

    constructor(
        uint256 _anomalyThreshold,
        uint256 _tvlThreshold,
        bool _autonomousMode,
        address initialOwner
    ) {
        require(initialOwner != address(0), "Invalid owner");
        anomalyThreshold = _anomalyThreshold;
        tvlThreshold = _tvlThreshold;
        autonomousMode = _autonomousMode;

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
        _grantRole(MONITOR_ROLE, initialOwner);
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Detects and handles security anomalies with rate limiting
     * @param anomalyType Type of anomaly detected
     * @param severity Severity level (0-100)
     */
    function detectAnomaly(
        uint256 anomalyType,
        uint256 severity
    ) external whenNotPaused onlyRole(MONITOR_ROLE) {
        require(severity <= 100, "Invalid severity");
        require(anomalyType > 0 && anomalyType <= 10, "Invalid anomaly type");
        require(authorizedReporters[msg.sender], "Unauthorized reporter");

        // Rate limiting: max anomalies per block
        require(
            anomalyFrequency[block.number] < MAX_ANOMALIES_PER_BLOCK,
            "Rate limit exceeded"
        );

        // Cooldown period between actions
        require(
            block.number >= lastActionBlock + COOLDOWN_PERIOD,
            "Cooldown active"
        );

        anomalyCount++;
        lastAnomalyBlock = block.number;
        anomalyFrequency[block.number]++;

        // Track consecutive anomalies
        if (severity >= 50) {
            consecutiveAnomalies++;
        } else {
            consecutiveAnomalies = 0;
        }

        emit AnomalyDetected(anomalyType, severity, block.number);

        // Enhanced autonomous response logic
        if (autonomousMode) {
            bool shouldPause = severity >= anomalyThreshold ||
                (consecutiveAnomalies >= 3) ||
                (currentTVL > tvlThreshold * 2);

            if (shouldPause) {
                lastActionBlock = block.number;
                _pause();
                emit AutonomousPauseTriggered(msg.sender, 3600, block.number);
            }
        }
    }

    /**
     * @notice Updates TVL monitoring
     * @param newTVL New total value locked
     */
    function updateTVL(
        uint256 newTVL
    ) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        uint256 oldTVL = currentTVL;
        currentTVL = newTVL;

        emit TVLUpdated(oldTVL, newTVL);
    }

    /**
     * @notice Toggles autonomous mode
     * @param enabled Whether autonomous mode should be enabled
     */
    function toggleAutonomousMode(
        bool enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        autonomousMode = enabled;
        emit AutonomousModeToggled(enabled);
    }

    /**
     * @notice Updates threshold values
     * @param thresholdType Type of threshold to update
     * @param newValue New threshold value
     */
    function updateThreshold(
        uint256 thresholdType,
        uint256 newValue
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(thresholdType > 0, "Invalid threshold type");
        uint256 oldValue = thresholds[thresholdType];
        thresholds[thresholdType] = newValue;

        emit ThresholdUpdated(thresholdType, oldValue, newValue);
    }

    /**
     * @notice Emergency pause all operations
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Emergency unpause operations
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    /**
     * @notice Add authorized anomaly reporter
     * @param reporter Address to authorize
     */
    function addReporter(
        address reporter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(reporter != address(0), "Invalid reporter");
        authorizedReporters[reporter] = true;
    }

    /**
     * @notice Remove authorized anomaly reporter
     * @param reporter Address to remove
     */
    function removeReporter(
        address reporter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedReporters[reporter] = false;
    }

    /**
     * @notice Check if reporter is authorized
     * @param reporter Address to check
     */
    function isAuthorizedReporter(
        address reporter
    ) external view returns (bool) {
        return authorizedReporters[reporter];
    }

    /**
     * @notice Get anomaly statistics
     */
    function getAnomalyStats()
        external
        view
        returns (
            uint256 totalCount,
            uint256 lastBlock,
            uint256 consecutive,
            uint256 currentBlockFrequency
        )
    {
        return (
            anomalyCount,
            lastAnomalyBlock,
            consecutiveAnomalies,
            anomalyFrequency[block.number]
        );
    }

    /**
     * @notice Transfer ownership and migrate privileged roles to the new owner
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner();
        super.transferOwnership(newOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
        _grantRole(OPERATOR_ROLE, newOwner);
        _grantRole(MONITOR_ROLE, newOwner);
        _revokeRole(MONITOR_ROLE, previousOwner);
        _revokeRole(OPERATOR_ROLE, previousOwner);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
    }
}
