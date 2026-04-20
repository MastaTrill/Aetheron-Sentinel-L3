// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title SentinelSecurityAuditor
 * @notice Advanced security auditing and monitoring system
 * Provides comprehensive threat detection and automated response
 */
contract SentinelSecurityAuditor is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Audit log structure
    struct AuditLog {
        uint256 id;
        string eventType;
        address actor;
        bytes32 transactionHash;
        uint256 timestamp;
        uint256 severity;
        string details;
        bool resolved;
        uint256 resolutionTime;
    }

    // Threat detection rules
    struct ThreatRule {
        string ruleName;
        uint256 severity;
        uint256 threshold;
        bool active;
        uint256 triggerCount;
        uint256 lastTriggered;
        bytes ruleLogic; // Encoded rule conditions
    }

    // Security incident structure
    struct SecurityIncident {
        uint256 id;
        string incidentType;
        uint256 severity;
        uint256 timestamp;
        address reporter;
        string description;
        bool confirmed;
        bool resolved;
        uint256 resolutionTime;
        bytes evidence;
    }

    // State variables
    mapping(uint256 => AuditLog) public auditLogs;
    mapping(uint256 => ThreatRule) public threatRules;
    mapping(uint256 => SecurityIncident) public securityIncidents;

    uint256 public logCount;
    uint256 public ruleCount;
    uint256 public incidentCount;

    // Security monitoring
    uint256 public threatLevel; // Current threat level (0-100)
    uint256 public securityScore; // Overall security score (0-1000)
    uint256 public lastSecurityUpdate;

    // Automated response system
    mapping(string => address) public responseContracts; // Rule name => response contract
    bool public autoResponseEnabled;
    uint256 public responseCooldown; // Minimum time between responses

    // Alert system
    address[] public alertRecipients;
    mapping(address => bool) public isAlertRecipient;
    uint256 public alertThreshold; // Minimum severity to trigger alerts

    event AuditLogCreated(
        uint256 indexed logId,
        string eventType,
        uint256 severity
    );
    event ThreatDetected(
        uint256 indexed ruleId,
        string ruleName,
        uint256 severity
    );
    event SecurityIncidentReported(
        uint256 indexed incidentId,
        string incidentType,
        uint256 severity
    );
    event AutomatedResponseTriggered(
        uint256 indexed ruleId,
        address responseContract
    );
    event AlertSent(
        address indexed recipient,
        uint256 severity,
        string message
    );
    event SecurityScoreUpdated(uint256 newScore, string reason);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        _initializeSecurityAuditor();
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Create audit log entry
     * @param eventType Type of event being logged
     * @param actor Address that performed the action
     * @param severity Severity level (1-10)
     * @param details Additional details about the event
     */
    function createAuditLog(
        string calldata eventType,
        address actor,
        uint256 severity,
        string calldata details
    ) external returns (uint256) {
        require(severity >= 1 && severity <= 10, "Invalid severity");

        uint256 logId = logCount++;

        auditLogs[logId] = AuditLog({
            id: logId,
            eventType: eventType,
            actor: actor,
            transactionHash: _getCurrentTxHash(),
            timestamp: block.timestamp,
            severity: severity,
            details: details,
            resolved: false,
            resolutionTime: 0
        });

        // Check threat rules
        _evaluateThreatRules(eventType, severity);

        // Update security score
        _updateSecurityScore(severity, true);

        emit AuditLogCreated(logId, eventType, severity);

        // Send alert if severity meets threshold
        if (severity >= alertThreshold) {
            _sendAlerts(
                logId,
                severity,
                string(abi.encodePacked("Audit Log: ", eventType))
            );
        }

        return logId;
    }

    /**
     * @notice Report security incident
     * @param incidentType Type of security incident
     * @param severity Severity level (1-10)
     * @param description Detailed description
     * @param evidence Supporting evidence (IPFS hash, etc.)
     */
    function reportSecurityIncident(
        string calldata incidentType,
        uint256 severity,
        string calldata description,
        bytes calldata evidence
    ) external returns (uint256) {
        require(severity >= 1 && severity <= 10, "Invalid severity");

        uint256 incidentId = incidentCount++;

        securityIncidents[incidentId] = SecurityIncident({
            id: incidentId,
            incidentType: incidentType,
            severity: severity,
            timestamp: block.timestamp,
            reporter: msg.sender,
            description: description,
            confirmed: false,
            resolved: false,
            resolutionTime: 0,
            evidence: evidence
        });

        // Immediate security score impact
        _updateSecurityScore(severity * 10, false); // Higher impact for incidents

        // Trigger alerts for all incidents
        _sendAlerts(
            incidentId,
            severity,
            string(abi.encodePacked("Security Incident: ", incidentType))
        );

        // Check for automated response
        if (autoResponseEnabled && severity >= 7) {
            _triggerAutomatedResponse(incidentType, severity);
        }

        emit SecurityIncidentReported(incidentId, incidentType, severity);

        return incidentId;
    }

    /**
     * @notice Add threat detection rule
     * @param ruleName Name of the threat rule
     * @param severity Severity level if triggered
     * @param threshold Threshold value for triggering
     * @param ruleLogic Encoded rule conditions
     */
    function addThreatRule(
        string calldata ruleName,
        uint256 severity,
        uint256 threshold,
        bytes calldata ruleLogic
    ) external onlyOwner returns (uint256) {
        return _addThreatRule(ruleName, severity, threshold, ruleLogic);
    }

    function _addThreatRule(
        string memory ruleName,
        uint256 severity,
        uint256 threshold,
        bytes memory ruleLogic
    ) internal returns (uint256) {
        uint256 ruleId = ruleCount++;

        threatRules[ruleId] = ThreatRule({
            ruleName: ruleName,
            severity: severity,
            threshold: threshold,
            active: true,
            triggerCount: 0,
            lastTriggered: 0,
            ruleLogic: ruleLogic
        });

        return ruleId;
    }

    /**
     * @notice Set automated response contract for rule
     * @param ruleName Name of the threat rule
     * @param responseContract Address of contract to call for response
     */
    function setAutomatedResponse(
        string calldata ruleName,
        address responseContract
    ) external onlyOwner {
        responseContracts[ruleName] = responseContract;
    }

    /**
     * @notice Add alert recipient
     * @param recipient Address to receive alerts
     */
    function addAlertRecipient(address recipient) external onlyOwner {
        if (!isAlertRecipient[recipient]) {
            alertRecipients.push(recipient);
            isAlertRecipient[recipient] = true;
        }
    }

    /**
     * @notice Set alert threshold
     * @param threshold Minimum severity to trigger alerts
     */
    function setAlertThreshold(uint256 threshold) external onlyOwner {
        alertThreshold = threshold;
    }

    /**
     * @notice Confirm security incident
     * @param incidentId ID of incident to confirm
     */
    function confirmIncident(uint256 incidentId) external onlyOwner {
        require(incidentId < incidentCount, "Invalid incident ID");
        require(!securityIncidents[incidentId].confirmed, "Already confirmed");

        securityIncidents[incidentId].confirmed = true;

        // Additional security score impact for confirmed incidents
        _updateSecurityScore(securityIncidents[incidentId].severity * 5, false);
    }

    /**
     * @notice Resolve security incident
     * @param incidentId ID of incident to resolve
     */
    function resolveIncident(uint256 incidentId) external onlyOwner {
        require(incidentId < incidentCount, "Invalid incident ID");
        require(securityIncidents[incidentId].confirmed, "Not confirmed");
        require(!securityIncidents[incidentId].resolved, "Already resolved");

        securityIncidents[incidentId].resolved = true;
        securityIncidents[incidentId].resolutionTime = block.timestamp;

        // Positive security score impact for resolution
        _updateSecurityScore(securityIncidents[incidentId].severity * 2, true);
    }

    /**
     * @notice Get security dashboard data
     */
    function getSecurityDashboard()
        external
        view
        returns (
            uint256 currentThreatLevel,
            uint256 currentSecurityScore,
            uint256 activeIncidents,
            uint256 unresolvedIncidents,
            uint256 totalAuditLogs
        )
    {
        uint256 activeIncidentsCount = 0;
        uint256 unresolvedCount = 0;

        for (uint256 i = 0; i < incidentCount; i++) {
            if (!securityIncidents[i].resolved) {
                unresolvedCount++;
                if (securityIncidents[i].confirmed) {
                    activeIncidentsCount++;
                }
            }
        }

        return (
            threatLevel,
            securityScore,
            activeIncidentsCount,
            unresolvedCount,
            logCount
        );
    }

    /**
     * @notice Get audit logs with pagination
     * @param offset Starting index
     * @param limit Maximum number of logs to return
     */
    function getAuditLogs(
        uint256 offset,
        uint256 limit
    ) external view returns (AuditLog[] memory) {
        require(offset < logCount, "Invalid offset");

        uint256 actualLimit = limit > logCount - offset
            ? logCount - offset
            : limit;
        AuditLog[] memory logs = new AuditLog[](actualLimit);

        for (uint256 i = 0; i < actualLimit; i++) {
            logs[i] = auditLogs[offset + i];
        }

        return logs;
    }

    /**
     * @notice Evaluate threat rules against audit events
     */
    function _evaluateThreatRules(
        string memory eventType,
        uint256 severity
    ) internal {
        for (uint256 i = 0; i < ruleCount; i++) {
            ThreatRule storage rule = threatRules[i];
            if (!rule.active) continue;

            // Simple rule evaluation (in production, would decode ruleLogic)
            bool triggered = false;

            if (_matchesRule(rule.ruleName, eventType, severity)) {
                rule.triggerCount++;
                rule.lastTriggered = block.timestamp;
                triggered = true;

                // Update threat level
                threatLevel = threatLevel.add(severity * 2);
                if (threatLevel > 100) threatLevel = 100;

                emit ThreatDetected(i, rule.ruleName, rule.severity);

                // Trigger automated response if configured
                if (
                    autoResponseEnabled &&
                    responseContracts[rule.ruleName] != address(0)
                ) {
                    _triggerAutomatedResponseForRule(i);
                }
            }
        }
    }

    /**
     * @notice Check if event matches threat rule
     */
    function _matchesRule(
        string memory ruleName,
        string memory eventType,
        uint256 severity
    ) internal pure returns (bool) {
        // Simplified rule matching (would be more sophisticated in production)
        bytes32 ruleHash = keccak256(abi.encodePacked(ruleName));
        bytes32 eventHash = keccak256(abi.encodePacked(eventType));

        if (
            ruleHash == keccak256(abi.encodePacked("high_frequency_trades")) &&
            eventHash == keccak256(abi.encodePacked("token_transfer"))
        ) {
            return severity >= 5;
        }

        if (
            ruleHash == keccak256(abi.encodePacked("large_value_transfer")) &&
            eventHash == keccak256(abi.encodePacked("bridge_transfer"))
        ) {
            return severity >= 7;
        }

        if (
            ruleHash == keccak256(abi.encodePacked("unauthorized_access")) &&
            eventHash == keccak256(abi.encodePacked("access_attempt"))
        ) {
            return severity >= 8;
        }

        return false;
    }

    /**
     * @notice Update overall security score
     */
    function _updateSecurityScore(uint256 impact, bool positive) internal {
        if (positive) {
            securityScore = securityScore.add(impact);
            if (securityScore > 1000) securityScore = 1000;
        } else {
            securityScore = securityScore > impact
                ? securityScore.sub(impact)
                : 0;
        }

        lastSecurityUpdate = block.timestamp;

        emit SecurityScoreUpdated(
            securityScore,
            positive ? "Positive event" : "Security incident"
        );
    }

    /**
     * @notice Send alerts to all recipients
     */
    function _sendAlerts(
        uint256 eventId,
        uint256 severity,
        string memory message
    ) internal {
        for (uint256 i = 0; i < alertRecipients.length; i++) {
            // In production, this would integrate with notification systems
            emit AlertSent(alertRecipients[i], severity, message);
        }
    }

    /**
     * @notice Trigger automated response for incident
     */
    function _triggerAutomatedResponse(
        string memory incidentType,
        uint256 severity
    ) internal {
        address responseContract = responseContracts[incidentType];
        if (responseContract != address(0)) {
            // Call response contract (simplified)
            // (bool success,) = responseContract.call(abi.encodeWithSignature("emergencyResponse(uint256)", severity));
        }
    }

    /**
     * @notice Trigger automated response for threat rule
     */
    function _triggerAutomatedResponseForRule(uint256 ruleId) internal {
        ThreatRule memory rule = threatRules[ruleId];
        address responseContract = responseContracts[rule.ruleName];

        if (responseContract != address(0)) {
            emit AutomatedResponseTriggered(ruleId, responseContract);
            // Call response contract (simplified)
        }
    }

    /**
     * @notice Get current transaction hash
     */
    function _getCurrentTxHash() internal view returns (bytes32) {
        return blockhash(block.number - 1); // Previous block hash as approximation
    }

    /**
     * @notice Initialize security auditor with default rules
     */
    function _initializeSecurityAuditor() internal {
        threatLevel = 10; // Low starting threat level
        securityScore = 850; // High starting security score
        alertThreshold = 5; // Alert on severity 5+
        autoResponseEnabled = true;
        responseCooldown = 1 hours;

        // Add default threat rules
        _addDefaultThreatRules();
    }

    /**
     * @notice Add default threat detection rules
     */
    function _addDefaultThreatRules() internal {
        _addThreatRule("high_frequency_trades", 6, 100, "");
        _addThreatRule("large_value_transfer", 7, 100000 ether, "");
        _addThreatRule("unauthorized_access", 9, 1, "");
        _addThreatRule("anomaly_spike", 8, 50, "");
    }
}
