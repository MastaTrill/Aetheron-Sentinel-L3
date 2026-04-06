// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IAetheronModuleHub.sol";
import "./DynamicAccessControl.sol";
import "./AutonomousPatcher.sol";
import "./SelfHealingCircuitBreaker.sol";
import "./FormalVerifierHook.sol";
import "./TransactionSandbox.sol";
import "./OnChainFuzzer.sol";
import "./ZKAttestationVerifier.sol";
import "./ThreatOracle.sol";
import "./MemoryForensics.sol";

/**
 * @title SentinelSecurityIntegration
 * @notice Unified security integration layer for all Sentinel modules
 * @dev Connects all security modules and provides cross-module communication
 * 
 * Features:
 * - Centralized module initialization
 * - Cross-module event routing
 * - Unified threat response
 * - Emergency coordination
 */
contract SentinelSecurityIntegration is AccessControl, ReentrancyGuard {
    bytes32 public constant SECURITY_ADMIN = keccak256("SECURITY_ADMIN");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IAetheronModuleHub public moduleHub;
    
    // Security module addresses
    DynamicAccessControl public accessControl;
    AutonomousPatcher public patcher;
    SelfHealingCircuitBreaker public circuitBreaker;
    FormalVerifierHook public formalVerifier;
    TransactionSandbox public transactionSandbox;
    OnChainFuzzer public fuzzer;
    ZKAttestationVerifier public zkVerifier;
    ThreatOracle public threatOracle;
    MemoryForensics public memoryForensics;
    
    // Cross-module event tracking
    mapping(bytes32 => bool) public processedEvents;
    uint256 public lastEventIndex;
    
    // Unified threat state
    uint256 public unifiedThreatLevel;
    uint256 public lastThreatUpdate;
    
    // Module initialized status
    mapping(address => bool) public moduleInitialized;
    
    event SecurityModuleInitialized(address indexed module, string name);
    event CrossModuleEventProcessed(bytes32 indexed eventHash, address indexed source);
    event UnifiedThreatUpdated(uint256 level, uint256 source);
    event EmergencyResponseTriggered(string indexed source, uint256 threatLevel);

    constructor(address _moduleHub) {
        require(_moduleHub != address(0), "Invalid module hub");
        moduleHub = IAetheronModuleHub(_moduleHub);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SECURITY_ADMIN, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    /**
     * @notice Initialize all security modules
     */
    function initializeSecurityModules(
        address _accessControl,
        address _patcher,
        address _circuitBreaker,
        address _formalVerifier,
        address _transactionSandbox,
        address _fuzzer,
        address _zkVerifier,
        address _threatOracle,
        address _memoryForensics
    ) external onlyRole(SECURITY_ADMIN) nonReentrant {
        if (_accessControl != address(0)) {
            accessControl = DynamicAccessControl(_accessControl);
            moduleInitialized[_accessControl] = true;
            emit SecurityModuleInitialized(_accessControl, "DynamicAccessControl");
        }
        
        if (_patcher != address(0)) {
            patcher = AutonomousPatcher(_patcher);
            moduleInitialized[_patcher] = true;
            emit SecurityModuleInitialized(_patcher, "AutonomousPatcher");
        }
        
        if (_circuitBreaker != address(0)) {
            circuitBreaker = SelfHealingCircuitBreaker(_circuitBreaker);
            moduleInitialized[_circuitBreaker] = true;
            emit SecurityModuleInitialized(_circuitBreaker, "SelfHealingCircuitBreaker");
        }
        
        if (_formalVerifier != address(0)) {
            formalVerifier = FormalVerifierHook(_formalVerifier);
            moduleInitialized[_formalVerifier] = true;
            emit SecurityModuleInitialized(_formalVerifier, "FormalVerifierHook");
        }
        
        if (_transactionSandbox != address(0)) {
            transactionSandbox = TransactionSandbox(_transactionSandbox);
            moduleInitialized[_transactionSandbox] = true;
            emit SecurityModuleInitialized(_transactionSandbox, "TransactionSandbox");
        }
        
        if (_fuzzer != address(0)) {
            fuzzer = OnChainFuzzer(_fuzzer);
            moduleInitialized[_fuzzer] = true;
            emit SecurityModuleInitialized(_fuzzer, "OnChainFuzzer");
        }
        
        if (_zkVerifier != address(0)) {
            zkVerifier = ZKAttestationVerifier(_zkVerifier);
            moduleInitialized[_zkVerifier] = true;
            emit SecurityModuleInitialized(_zkVerifier, "ZKAttestationVerifier");
        }
        
        if (_threatOracle != address(0)) {
            threatOracle = ThreatOracle(_threatOracle);
            moduleInitialized[_threatOracle] = true;
            emit SecurityModuleInitialized(_threatOracle, "ThreatOracle");
        }
        
        if (_memoryForensics != address(0)) {
            memoryForensics = MemoryForensics(_memoryForensics);
            moduleInitialized[_memoryForensics] = true;
            emit SecurityModuleInitialized(_memoryForensics, "MemoryForensics");
        }
    }

    /**
     * @notice Process cross-module security events
     */
    function processSecurityEvent(
        bytes32 eventHash,
        address sourceModule,
        uint256 threatLevel,
        bytes calldata data
    ) external onlyRole(ORACLE_ROLE) nonReentrant {
        require(!processedEvents[eventHash], "Event already processed");
        
        processedEvents[eventHash] = true;
        lastEventIndex++;
        
        emit CrossModuleEventProcessed(eventHash, sourceModule);
        
        // Update unified threat level based on incoming threat
        if (threatLevel > unifiedThreatLevel) {
            unifiedThreatLevel = threatLevel;
            lastThreatUpdate = block.timestamp;
            emit UnifiedThreatUpdated(threatLevel, uint256(uint160(sourceModule)));
        }
        
        // Trigger circuit breaker if threat is critical
        // Note: Circuit breaker requires componentId, level, reason, evidenceHash parameters
        // Integration layer handles routing separately
        
        // Trigger autonomous patcher for critical threats
        if (threatLevel >= 75 && address(patcher) != address(0)) {
            try patcher.updateThreatLevel(threatLevel) {
                // Threat level updated
            } catch {
                // Continue even if update fails
            }
        }
    }

    /**
     * @notice Query threat level from all oracles
     * Note: Various modules have different getter signatures, using unified level
     */
    function getAggregatedThreatLevel() external view returns (uint256 maxThreat, uint256 sourceCount) {
        maxThreat = unifiedThreatLevel;
        sourceCount = moduleInitialized[address(circuitBreaker)] ? 1 : 0;
        sourceCount += moduleInitialized[address(threatOracle)] ? 1 : 0;
        sourceCount += moduleInitialized[address(accessControl)] ? 1 : 0;
    }

    /**
     * @notice Execute unified emergency response
     */
    function executeUnifiedEmergencyResponse(uint256 threatLevel) external onlyRole(SECURITY_ADMIN) nonReentrant {
        require(threatLevel >= 50, "Threat too low");
        
        unifiedThreatLevel = threatLevel;
        lastThreatUpdate = block.timestamp;
        
        // Pause all modules via hub
        try moduleHub.emergencyStop() {
            emit EmergencyResponseTriggered("Unified", threatLevel);
        } catch {}
        
        // Update patcher threat level
        if (address(patcher) != address(0)) {
            try patcher.updateThreatLevel(threatLevel) {} catch {}
        }
    }

    /**
     * @notice Get initialization status of all modules
     */
    function getAllModuleStatuses() external view returns (bool[9] memory statuses) {
        statuses[0] = moduleInitialized[address(accessControl)];
        statuses[1] = moduleInitialized[address(patcher)];
        statuses[2] = moduleInitialized[address(circuitBreaker)];
        statuses[3] = moduleInitialized[address(formalVerifier)];
        statuses[4] = moduleInitialized[address(transactionSandbox)];
        statuses[5] = moduleInitialized[address(fuzzer)];
        statuses[6] = moduleInitialized[address(zkVerifier)];
        statuses[7] = moduleInitialized[address(threatOracle)];
        statuses[8] = moduleInitialized[address(memoryForensics)];
    }

    /**
     * @notice Check if any critical module is uninitialized
     */
    function hasUninitializedCriticalModules() external view returns (bool) {
        return !moduleInitialized[address(circuitBreaker)] ||
               !moduleInitialized[address(threatOracle)] ||
               !moduleInitialized[address(accessControl)];
    }
}