// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../SentinelInterceptor.sol";

/**
 * @title AnomalyDetectionOracle
 * @notice On-chain oracle for integrating off-chain anomaly detection service
 * @dev Receives anomaly reports from the anomaly detection service and triggers appropriate actions
 */
contract AnomalyDetectionOracle is AccessControl, ReentrancyGuard {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum AnomalyType {
        TVLSpike,
        LargeWithdrawal,
        RapidDrain,
        UnusualActivity,
        PerformanceAlert,
        VulnerabilityDetected,
        CriticalVulnerability,
        CoordinatedAttack
    }

    struct AnomalyReport {
        uint256 id;
        AnomalyType anomalyType;
        uint256 severity; // 1-100
        uint256 confidence; // 0-100
        bytes data;
        uint256 timestamp;
        address reporter;
        bool processed;
    }

    SentinelInterceptor public immutable sentinel;
    uint256 public reportCounter;
    mapping(uint256 => AnomalyReport) public reports;
    mapping(AnomalyType => uint256) public anomalyThresholds;

    // Events
    event AnomalyReported(uint256 indexed id, AnomalyType anomalyType, uint256 severity, uint256 confidence);
    event AnomalyProcessed(uint256 indexed id, bool actionTaken);
    event ThresholdUpdated(AnomalyType anomalyType, uint256 oldThreshold, uint256 newThreshold);

    constructor(address _sentinelAddress) {
        sentinel = SentinelInterceptor(_sentinelAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // Set default thresholds
        anomalyThresholds[AnomalyType.TVLSpike] = 1520; // 15.2%
        anomalyThresholds[AnomalyType.LargeWithdrawal] = 500; // 5%
        anomalyThresholds[AnomalyType.RapidDrain] = 300; // 3%
        anomalyThresholds[AnomalyType.UnusualActivity] = 200; // 2%
        anomalyThresholds[AnomalyType.PerformanceAlert] = 100; // 1%
        anomalyThresholds[AnomalyType.VulnerabilityDetected] = 800; // 80%
        anomalyThresholds[AnomalyType.CriticalVulnerability] = 950; // 95%
        anomalyThresholds[AnomalyType.CoordinatedAttack] = 900; // 90%
    }

    /**
     * @notice Report an anomaly detected by the off-chain service
     * @param anomalyType Type of anomaly detected
     * @param severity Severity level (1-100)
     * @param confidence Confidence in the detection (0-100)
     * @param data Additional data about the anomaly
     */
    function reportAnomaly(
        AnomalyType anomalyType,
        uint256 severity,
        uint256 confidence,
        bytes calldata data
    ) external onlyRole(REPORTER_ROLE) nonReentrant {
        require(severity > 0 && severity <= 100, "Invalid severity");
        require(confidence <= 100, "Invalid confidence");

        uint256 reportId = ++reportCounter;

        reports[reportId] = AnomalyReport({
            id: reportId,
            anomalyType: anomalyType,
            severity: severity,
            confidence: confidence,
            data: data,
            timestamp: block.timestamp,
            reporter: msg.sender,
            processed: false
        });

        emit AnomalyReported(reportId, anomalyType, severity, confidence);

        // Process the anomaly if it meets threshold
        if (severity >= anomalyThresholds[anomalyType] && confidence >= 70) {
            _processAnomaly(reportId);
        }
    }

    /**
     * @notice Manually process a pending anomaly report
     * @param reportId ID of the report to process
     */
    function processAnomaly(uint256 reportId) external onlyRole(ADMIN_ROLE) {
        require(reports[reportId].id != 0, "Report not found");
        require(!reports[reportId].processed, "Already processed");

        _processAnomaly(reportId);
    }

    /**
     * @notice Update threshold for an anomaly type
     * @param anomalyType Type of anomaly
     * @param newThreshold New threshold value
     */
    function updateThreshold(AnomalyType anomalyType, uint256 newThreshold) external onlyRole(ADMIN_ROLE) {
        require(newThreshold <= 10000, "Threshold too high"); // Max 100%

        uint256 oldThreshold = anomalyThresholds[anomalyType];
        anomalyThresholds[anomalyType] = newThreshold;

        emit ThresholdUpdated(anomalyType, oldThreshold, newThreshold);
    }

    /**
     * @notice Get anomaly report details
     * @param reportId Report ID
     */
    function getReport(uint256 reportId) external view returns (
        AnomalyType anomalyType,
        uint256 severity,
        uint256 confidence,
        bytes memory data,
        uint256 timestamp,
        address reporter,
        bool processed
    ) {
        AnomalyReport storage report = reports[reportId];
        return (
            report.anomalyType,
            report.severity,
            report.confidence,
            report.data,
            report.timestamp,
            report.reporter,
            report.processed
        );
    }

    /**
     * @notice Get current TVL from sentinel
     */
    function getCurrentTVL() external view returns (uint256) {
        return sentinel.totalValueLocked();
    }

    /**
     * @dev Internal function to process anomaly and take action
     */
    function _processAnomaly(uint256 reportId) internal {
        AnomalyReport storage report = reports[reportId];
        bool actionTaken = false;

        if (report.anomalyType == AnomalyType.TVLSpike ||
            report.anomalyType == AnomalyType.RapidDrain ||
            report.anomalyType == AnomalyType.CoordinatedAttack ||
            report.anomalyType == AnomalyType.CriticalVulnerability) {

            // For critical anomalies, trigger pause via sentinel
            // Decode data to get TVL percentage
            if (report.data.length >= 32) {
                uint256 tvlPercentage = abi.decode(report.data, (uint256));
                uint256 currentTVL = sentinel.totalValueLocked();

                // Call sentinel reportAnomaly if we have ORACLE_ROLE
                // Assuming this contract has ORACLE_ROLE on sentinel
                try sentinel.reportAnomaly(tvlPercentage, currentTVL) {
                    actionTaken = true;
                } catch {
                    // If direct call fails, emit event for manual intervention
                }
            }
        }

        report.processed = true;
        emit AnomalyProcessed(reportId, actionTaken);
    }

    /**
     * @notice Grant reporter role to an address
     * @param reporter Address to grant role to
     */
    function addReporter(address reporter) external onlyRole(ADMIN_ROLE) {
        grantRole(REPORTER_ROLE, reporter);
    }

    /**
     * @notice Revoke reporter role from an address
     * @param reporter Address to revoke role from
     */
    function removeReporter(address reporter) external onlyRole(ADMIN_ROLE) {
        revokeRole(REPORTER_ROLE, reporter);
    }
}