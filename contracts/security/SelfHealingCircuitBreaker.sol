// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SelfHealingCircuitBreaker
 * @notice Gradient response system for protocol health
 * @dev Implements intelligent circuit breaking with automatic recovery
 * 
 * Features:
 * - Threat level based graduated response (not just pause/unpause)
 * - Partial component pausing
 * - Automatic recovery with cooldown periods
 * - Multi-sig emergency escalation paths
 */
contract SelfHealingCircuitBreaker is AccessControl, ReentrancyGuard {
    bytes32 public constant CIRCUIT_ADMIN = keccak256("CIRCUIT_ADMIN");
    bytes32 public constant THREAT_MONITOR = keccak256("THREAT_MONITOR");

    enum ThreatLevel {
        Normal,       // No issues - full operation
        Advisory,     // Log only
        Warning,      // Rate limiting
        Critical,     // Restricted operation
        Emergency     // Full pause
    }

    enum ComponentStatus {
        Operational,
        RateLimited,
        Restricted,
        Paused
    }

    struct Component {
        bytes32 id;
        string name;
        ComponentStatus status;
        ThreatLevel currentThreat;
        uint256 lastTriggered;
        uint256 cooldownPeriod;
        uint256 recoveryThreshold;
        uint256 incidentCount;
        address handler;
    }

    struct Incident {
        bytes32 componentId;
        ThreatLevel level;
        uint256 timestamp;
        string reason;
        bytes32 evidenceHash;
    }

    bytes32[] public componentIds;
    mapping(bytes32 => Component) public components;
    mapping(bytes32 => Incident[]) public componentIncidents;
    
    ThreatLevel public globalThreatLevel;
    uint256 public globalLastTriggered;
    uint256 public globalCooldown = 1 hours;

    event ComponentStatusChanged(
        bytes32 indexed componentId,
        ComponentStatus oldStatus,
        ComponentStatus newStatus,
        ThreatLevel threatLevel
    );

    event ThreatDetected(
        ThreatLevel indexed level,
        bytes32 indexed componentId,
        string reason,
        uint256 timestamp
    );

    event AutomaticRecovery(
        bytes32 indexed componentId,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CIRCUIT_ADMIN, msg.sender);
    }

    /**
     * @notice Register a protected component
     */
    function registerComponent(
        bytes32 id,
        string calldata name,
        uint256 cooldownPeriod,
        uint256 recoveryThreshold,
        address handler
    ) external onlyRole(CIRCUIT_ADMIN) {
        require(components[id].id == bytes32(0), "Component already registered");
        
        components[id] = Component({
            id: id,
            name: name,
            status: ComponentStatus.Operational,
            currentThreat: ThreatLevel.Normal,
            lastTriggered: 0,
            cooldownPeriod: cooldownPeriod,
            recoveryThreshold: recoveryThreshold,
            incidentCount: 0,
            handler: handler
        });

        componentIds.push(id);
    }

    /**
     * @notice Trigger threat response based on detected threat level
     */
    function triggerThreatResponse(
        bytes32 componentId,
        ThreatLevel level,
        string calldata reason,
        bytes32 evidenceHash
    ) external onlyRole(THREAT_MONITOR) nonReentrant {
        Component storage component = components[componentId];
        require(component.id != bytes32(0), "Component not found");

        component.currentThreat = level;
        component.lastTriggered = block.timestamp;
        component.incidentCount++;

        componentIncidents[componentId].push(Incident({
            componentId: componentId,
            level: level,
            timestamp: block.timestamp,
            reason: reason,
            evidenceHash: evidenceHash
        }));

        emit ThreatDetected(level, componentId, reason, block.timestamp);

        _applyThreatResponse(component, level);
    }

    /**
     * @notice Check and attempt automatic recovery
     */
    function attemptRecovery(bytes32 componentId) external nonReentrant {
        Component storage component = components[componentId];
        require(component.id != bytes32(0), "Component not found");
        require(
            block.timestamp > component.lastTriggered + component.cooldownPeriod,
            "Cooldown not expired"
        );

        if (component.incidentCount <= component.recoveryThreshold) {
            component.status = ComponentStatus.Operational;
            component.currentThreat = ThreatLevel.Normal;
            
            emit AutomaticRecovery(componentId, block.timestamp);
            emit ComponentStatusChanged(
                componentId,
                component.status,
                ComponentStatus.Operational,
                ThreatLevel.Normal
            );
        }
    }

    /**
     * @notice Manual override for component status
     */
    function setComponentStatus(
        bytes32 componentId,
        ComponentStatus newStatus
    ) external onlyRole(CIRCUIT_ADMIN) {
        Component storage component = components[componentId];
        require(component.id != bytes32(0), "Component not found");

        ComponentStatus oldStatus = component.status;
        component.status = newStatus;

        emit ComponentStatusChanged(
            componentId,
            oldStatus,
            newStatus,
            component.currentThreat
        );
    }

    /**
     * @dev Apply gradient response based on threat level
     */
    function _applyThreatResponse(Component storage component, ThreatLevel level) internal {
        ComponentStatus oldStatus = component.status;
        ComponentStatus newStatus = oldStatus;

        if (level == ThreatLevel.Normal) {
            newStatus = ComponentStatus.Operational;
        } else if (level == ThreatLevel.Advisory) {
            newStatus = ComponentStatus.Operational; // Log only
        } else if (level == ThreatLevel.Warning) {
            newStatus = ComponentStatus.RateLimited;
        } else if (level == ThreatLevel.Critical) {
            newStatus = ComponentStatus.Restricted;
        } else if (level == ThreatLevel.Emergency) {
            newStatus = ComponentStatus.Paused;
            globalThreatLevel = ThreatLevel.Emergency;
            globalLastTriggered = block.timestamp;
        }

        if (newStatus != oldStatus) {
            component.status = newStatus;
            emit ComponentStatusChanged(component.id, oldStatus, newStatus, level);
        }
    }

    /**
     * @notice Check if component is allowed to perform operation
     */
    function isOperational(bytes32 componentId) external view returns (bool) {
        return components[componentId].status == ComponentStatus.Operational;
    }

    /**
     * @notice Get component status with metadata
     */
    function getComponentStatus(bytes32 componentId) external view returns (
        ComponentStatus status,
        ThreatLevel threatLevel,
        uint256 lastTriggered,
        uint256 incidentCount
    ) {
        Component storage component = components[componentId];
        return (
            component.status,
            component.currentThreat,
            component.lastTriggered,
            component.incidentCount
        );
    }
}
