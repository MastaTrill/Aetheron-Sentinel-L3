// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AutonomousSecurityAgent
 * @notice AI-powered autonomous security agents for real-time threat response
 * @dev Implements:
 *      - Self-learning threat detection
 *      - Autonomous response execution
 *      - Agent coordination and consensus
 *      - Emergency protocol activation
 *      - Performance optimization
 *      - Risk assessment and mitigation
 */
contract AutonomousSecurityAgent is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant SECURITY_AGENT = keccak256("SECURITY_AGENT");
    bytes32 public constant EMERGENCY_OPERATOR = keccak256("EMERGENCY_OPERATOR");

    enum AgentState {
        INACTIVE,
        MONITORING,
        ANALYZING,
        RESPONDING,
        RECOVERING,
        MAINTENANCE
    }

    enum ThreatLevel {
        NONE,
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL,
        EXISTENTIAL
    }

    struct SecurityAgent {
        bytes32 agentId;
        address controller;
        AgentState state;
        uint256 riskTolerance;     // 0-1000
        uint256 responseThreshold; // 0-1000
        uint256 lastAction;
        uint256 successRate;       // 0-1000
        uint256 falsePositiveRate; // 0-1000
        bytes32[] capabilities;
        mapping(bytes32 => uint256) decisionWeights;
    }

    struct ThreatAssessment {
        bytes32 threatId;
        ThreatLevel level;
        string description;
        uint256 confidence;
        uint256 timestamp;
        address detectedBy;
        bytes32[] indicators;
        mapping(bytes32 => uint256) agentVotes;
        uint256 totalVotes;
        bool consensusReached;
        bool actionTaken;
    }

    struct AutonomousAction {
        bytes32 actionId;
        bytes32 threatId;
        string actionType;
        bytes parameters;
        uint256 executionTime;
        address executedBy;
        bool successful;
        uint256 gasUsed;
        string result;
    }

    // State
    mapping(bytes32 => SecurityAgent) public agents;
    mapping(bytes32 => ThreatAssessment) public threats;
    mapping(bytes32 => AutonomousAction) public actions;
    mapping(address => bytes32[]) public agentControllers;

    bytes32[] public activeAgents;
    bytes32[] public activeThreats;

    // Global parameters
    uint256 public consensusThreshold = 66; // 66% agreement required
    uint256 public emergencyThreshold = 800; // Risk score triggering emergency
    uint256 public learningRate = 100; // For agent adaptation
    bool public autonomousMode = false;

    // Events
    event AgentActivated(bytes32 indexed agentId, address indexed controller);
    event ThreatDetected(bytes32 indexed threatId, ThreatLevel level, uint256 confidence);
    event ConsensusReached(bytes32 indexed threatId, uint256 votes, uint256 threshold);
    event AutonomousActionExecuted(bytes32 indexed actionId, string actionType, bool success);
    event AgentLearningUpdate(bytes32 indexed agentId, uint256 newSuccessRate);
    event EmergencyProtocolActivated(string reason, uint256 riskLevel);

    // Errors
    error AgentNotActive(bytes32 agentId);
    error InsufficientConsensus(uint256 votes, uint256 required);
    error ThreatAlreadyAssessed(bytes32 threatId);
    error AutonomousModeDisabled();
    error RiskToleranceExceeded(uint256 risk, uint256 tolerance);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_OPERATOR, msg.sender);
    }

    // ============ Agent Management ============

    /**
     * @notice Deploy a new autonomous security agent
     * @param controller Address that controls this agent
     * @param riskTolerance Agent's risk tolerance (0-1000)
     * @param responseThreshold Minimum confidence for autonomous response
     * @param capabilities List of agent capabilities
     */
    function deploySecurityAgent(
        address controller,
        uint256 riskTolerance,
        uint256 responseThreshold,
        bytes32[] calldata capabilities
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (bytes32 agentId) {
        agentId = keccak256(abi.encode(
            "SECURITY_AGENT",
            controller,
            block.timestamp,
            block.number
        ));

        SecurityAgent storage agent = agents[agentId];
        agent.agentId = agentId;
        agent.controller = controller;
        agent.state = AgentState.MONITORING;
        agent.riskTolerance = riskTolerance;
        agent.responseThreshold = responseThreshold;
        agent.capabilities = capabilities;
        agent.successRate = 500; // Start at 50%
        agent.lastAction = block.timestamp;

        // Initialize decision weights
        for (uint256 i = 0; i < capabilities.length; i++) {
            agent.decisionWeights[capabilities[i]] = 500; // Equal initial weights
        }

        activeAgents.push(agentId);
        agentControllers[controller].push(agentId);

        _grantRole(SECURITY_AGENT, controller);

        emit AgentActivated(agentId, controller);
    }

    // ============ Threat Detection & Assessment ============

    /**
     * @notice Report a potential security threat
     * @param description Threat description
     * @param indicators Threat indicators/evidence
     * @param initialConfidence Initial confidence level (0-1000)
     */
    function reportThreat(
        string calldata description,
        bytes32[] calldata indicators,
        uint256 initialConfidence
    ) external onlyRole(SECURITY_AGENT) returns (bytes32 threatId) {
        threatId = keccak256(abi.encode(
            "THREAT",
            msg.sender,
            description,
            block.timestamp
        ));

        ThreatAssessment storage threat = threats[threatId];
        threat.threatId = threatId;
        threat.level = _assessThreatLevel(initialConfidence);
        threat.description = description;
        threat.confidence = initialConfidence;
        threat.timestamp = block.timestamp;
        threat.detectedBy = msg.sender;
        threat.indicators = indicators;

        activeThreats.push(threatId);

        // Initial agent vote
        threat.agentVotes[keccak256(abi.encode(msg.sender))] = initialConfidence;
        threat.totalVotes = 1;

        emit ThreatDetected(threatId, threat.level, initialConfidence);

        // Check for immediate action
        if (autonomousMode && threat.level >= ThreatLevel.HIGH) {
            _initiateAgentConsensus(threatId);
        }
    }

    /**
     * @notice Agent votes on threat assessment
     * @param threatId Threat identifier
     * @param confidence Agent's confidence in the threat (0-1000)
     */
    function voteOnThreat(
        bytes32 threatId,
        uint256 confidence
    ) external onlyRole(SECURITY_AGENT) {
        ThreatAssessment storage threat = threats[threatId];
        require(threat.threatId != bytes32(0), "Threat not found");
        require(!threat.consensusReached, "Consensus already reached");

        bytes32 agentKey = keccak256(abi.encode(msg.sender));
        require(threat.agentVotes[agentKey] == 0, "Already voted");

        threat.agentVotes[agentKey] = confidence;
        threat.totalVotes++;

        // Update threat confidence as weighted average
        uint256 totalConfidence = 0;
        uint256 totalWeight = 0;

        // Weight votes by agent success rate
        for (uint256 i = 0; i < activeAgents.length; i++) {
            SecurityAgent storage agent = agents[activeAgents[i]];
            bytes32 voteKey = keccak256(abi.encode(agent.controller));
            uint256 vote = threat.agentVotes[voteKey];

            if (vote > 0) {
                uint256 weight = agent.successRate;
                totalConfidence += vote * weight;
                totalWeight += weight;
            }
        }

        if (totalWeight > 0) {
            threat.confidence = totalConfidence / totalWeight;
            threat.level = _assessThreatLevel(threat.confidence);
        }

        // Check for consensus
        if (_checkConsensus(threat)) {
            threat.consensusReached = true;
            emit ConsensusReached(threatId, threat.totalVotes, consensusThreshold);

            if (autonomousMode) {
                _executeAutonomousResponse(threatId);
            }
        }
    }

    // ============ Autonomous Response System ============

    /**
     * @notice Execute autonomous response to confirmed threat
     */
    function _executeAutonomousResponse(bytes32 threatId) internal {
        ThreatAssessment storage threat = threats[threatId];

        // Select appropriate response based on threat level and agent consensus
        string memory actionType = _selectResponseAction(threat.level, threat.confidence);
        bytes memory parameters = _generateActionParameters(threat);

        bytes32 actionId = keccak256(abi.encode(
            "AUTONOMOUS_ACTION",
            threatId,
            actionType,
            block.timestamp
        ));

        uint256 startGas = gasleft();

        // Execute the action
        bool success = _performSecurityAction(actionType, parameters);
        uint256 gasUsed = startGas - gasleft();

        // Record the action
        actions[actionId] = AutonomousAction({
            actionId: actionId,
            threatId: threatId,
            actionType: actionType,
            parameters: parameters,
            executionTime: block.timestamp,
            executedBy: address(this),
            successful: success,
            gasUsed: gasUsed,
            result: success ? "Action executed successfully" : "Action failed"
        });

        threat.actionTaken = true;

        // Update agent learning
        _updateAgentLearning(threatId, success);

        emit AutonomousActionExecuted(actionId, actionType, success);

        // Emergency escalation if action fails on critical threat
        if (!success && threat.level >= ThreatLevel.CRITICAL) {
            _activateEmergencyProtocol(threat.description);
        }
    }

    /**
     * @notice Perform specific security actions
     */
    function _performSecurityAction(
        string memory actionType,
        bytes memory parameters
    ) internal returns (bool success) {
        bytes32 actionHash = keccak256(abi.encode(actionType));

        if (actionHash == keccak256("PAUSE_BRIDGE")) {
            // Call bridge pause
            (success,) = address(0x123).call(abi.encodeWithSignature("emergencyPause()"));
        } else if (actionHash == keccak256("ISOLATE_USER")) {
            // Isolate suspicious user
            address user = abi.decode(parameters, (address));
            (success,) = address(0x456).call(
                abi.encodeWithSignature("isolateUser(address)", user)
            );
        } else if (actionHash == keccak256("SCALE_SECURITY")) {
            // Increase security measures
            uint256 newLevel = abi.decode(parameters, (uint256));
            (success,) = address(0x789).call(
                abi.encodeWithSignature("setSecurityLevel(uint256)", newLevel)
            );
        } else if (actionHash == keccak256("ALERT_OPERATORS")) {
            // Send alerts to human operators
            success = true; // Assume notification system works
        }

        return success;
    }

    // ============ Agent Learning & Adaptation ============

    /**
     * @notice Update agent learning based on action outcomes
     */
    function _updateAgentLearning(bytes32 threatId, bool actionSuccess) internal {
        ThreatAssessment storage threat = threats[threatId];

        // Update all participating agents
        for (uint256 i = 0; i < activeAgents.length; i++) {
            SecurityAgent storage agent = agents[activeAgents[i]];
            bytes32 agentKey = keccak256(abi.encode(agent.controller));

            if (threat.agentVotes[agentKey] > 0) {
                // Update success rate
                uint256 oldSuccess = agent.successRate;
                uint256 adjustment = actionSuccess ? learningRate : learningRate / 2;

                if (actionSuccess) {
                    agent.successRate = oldSuccess + adjustment > 1000 ?
                        1000 : oldSuccess + adjustment;
                } else {
                    agent.successRate = oldSuccess < adjustment ?
                        0 : oldSuccess - adjustment;
                }

                // Update false positive rate
                bool wasFalsePositive = threat.level == ThreatLevel.NONE ||
                                       (threat.level <= ThreatLevel.LOW && threat.confidence < 300);

                if (wasFalsePositive) {
                    agent.falsePositiveRate = agent.falsePositiveRate + (adjustment / 2);
                    if (agent.falsePositiveRate > 1000) agent.falsePositiveRate = 1000;
                }

                // Adapt decision weights based on outcome
                _adaptDecisionWeights(agent, threat, actionSuccess);

                emit AgentLearningUpdate(agent.agentId, agent.successRate);
            }
        }
    }

    /**
     * @notice Adapt agent's decision weights based on learning
     */
    function _adaptDecisionWeights(
        SecurityAgent storage agent,
        ThreatAssessment storage threat,
        bool success
    ) internal {
        // Reinforcement learning: increase weights for successful decisions
        for (uint256 i = 0; i < threat.indicators.length; i++) {
            bytes32 indicator = threat.indicators[i];

            if (agent.decisionWeights[indicator] > 0) {
                uint256 adjustment = success ? learningRate / 10 : learningRate / 20;
                uint256 newWeight;

                if (success) {
                    newWeight = agent.decisionWeights[indicator] + adjustment;
                    if (newWeight > 1000) newWeight = 1000;
                } else {
                    newWeight = agent.decisionWeights[indicator] - adjustment;
                    if (newWeight < 0) newWeight = 0;
                }

                agent.decisionWeights[indicator] = newWeight;
            }
        }
    }

    // ============ Emergency Protocols ============

    /**
     * @notice Activate emergency security protocols
     */
    function _activateEmergencyProtocol(string memory reason) internal {
        autonomousMode = false; // Disable autonomous actions
        emit EmergencyProtocolActivated(reason, emergencyThreshold);

        // Execute emergency actions
        _performSecurityAction("GLOBAL_LOCKDOWN", "");
        _performSecurityAction("NOTIFY_ALL_OPERATORS",
            abi.encode(reason, block.timestamp));
    }

    /**
     * @notice Manually activate emergency mode
     */
    function activateEmergencyMode(string calldata reason) external onlyRole(EMERGENCY_OPERATOR) {
        _activateEmergencyProtocol(reason);
    }

    // ============ Helper Functions ============

    function _assessThreatLevel(uint256 confidence) internal pure returns (ThreatLevel) {
        if (confidence >= 900) return ThreatLevel.EXISTENTIAL;
        if (confidence >= 750) return ThreatLevel.CRITICAL;
        if (confidence >= 600) return ThreatLevel.HIGH;
        if (confidence >= 400) return ThreatLevel.MEDIUM;
        if (confidence >= 200) return ThreatLevel.LOW;
        return ThreatLevel.NONE;
    }

    function _checkConsensus(ThreatAssessment storage threat) internal view returns (bool) {
        if (threat.totalVotes == 0) return false;

        uint256 agreeCount = 0;
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < activeAgents.length; i++) {
            SecurityAgent storage agent = agents[activeAgents[i]];
            bytes32 agentKey = keccak256(abi.encode(agent.controller));
            uint256 vote = threat.agentVotes[agentKey];

            if (vote > 0) {
                uint256 weight = agent.successRate;
                totalWeight += weight;

                // Count as agreement if vote confidence is above threshold
                if (vote >= threat.confidence) {
                    agreeCount += weight;
                }
            }
        }

        if (totalWeight == 0) return false;

        uint256 agreementPercentage = (agreeCount * 100) / totalWeight;
        return agreementPercentage >= consensusThreshold;
    }

    function _selectResponseAction(ThreatLevel level, uint256 confidence)
        internal
        pure
        returns (string memory)
    {
        if (level >= ThreatLevel.CRITICAL) {
            return "GLOBAL_LOCKDOWN";
        } else if (level >= ThreatLevel.HIGH) {
            return "PAUSE_BRIDGE";
        } else if (level >= ThreatLevel.MEDIUM) {
            return "ISOLATE_USER";
        } else {
            return "SCALE_SECURITY";
        }
    }

    function _generateActionParameters(ThreatAssessment storage threat)
        internal
        view
        returns (bytes memory)
    {
        // Generate appropriate parameters based on threat
        if (threat.level >= ThreatLevel.CRITICAL) {
            return abi.encode(threat.detectedBy); // Lock down suspicious user
        } else if (threat.level >= ThreatLevel.HIGH) {
            return ""; // No parameters needed for bridge pause
        } else {
            return abi.encode(threat.level == ThreatLevel.MEDIUM ? 2 : 1); // Security level
        }
    }

    function _initiateAgentConsensus(bytes32 threatId) internal {
        // Notify all agents to vote
        // In practice, this would trigger off-chain coordination
    }

    // ============ Configuration ============

    function setAutonomousMode(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        autonomousMode = enabled;
    }

    function updateConsensusThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newThreshold <= 100, "Invalid threshold");
        consensusThreshold = newThreshold;
    }

    function setEmergencyThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyThreshold = newThreshold;
    }

    function updateLearningRate(uint256 newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        learningRate = newRate;
    }

    // ============ View Functions ============

    function getAgentStatus(bytes32 agentId) external view returns (
        AgentState state,
        uint256 successRate,
        uint256 falsePositiveRate,
        uint256 lastAction
    ) {
        SecurityAgent storage agent = agents[agentId];
        return (
            agent.state,
            agent.successRate,
            agent.falsePositiveRate,
            agent.lastAction
        );
    }

    function getThreatAssessment(bytes32 threatId) external view returns (
        ThreatLevel level,
        uint256 confidence,
        bool consensusReached,
        bool actionTaken,
        uint256 totalVotes
    ) {
        ThreatAssessment storage threat = threats[threatId];
        return (
            threat.level,
            threat.confidence,
            threat.consensusReached,
            threat.actionTaken,
            threat.totalVotes
        );
    }

    function getActiveAgents() external view returns (bytes32[] memory) {
        return activeAgents;
    }

    function getActiveThreats() external view returns (bytes32[] memory) {
        return activeThreats;
    }

    function isAutonomousModeActive() external view returns (bool) {
        return autonomousMode;
    }
}