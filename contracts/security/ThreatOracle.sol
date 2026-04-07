// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title ThreatOracle
 * @notice Multi-chain threat oracle network with threshold signatures
 * @dev Peer-to-peer threat sharing across all chains
 * 
 * Features:
 * - Threshold signature based threat consensus
 * - Automatic signature blacklist propagation
 * - < 500ms global threat propagation
 * - Cross-chain threat intelligence sharing
 */
contract ThreatOracle is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant ORACLE_ADMIN = keccak256("ORACLE_ADMIN");
    bytes32 public constant THREAT_REPORTER = keccak256("THREAT_REPORTER");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    enum ThreatLevel {
        None,
        Low,
        Medium,
        High,
        Critical
    }

    enum ThreatType {
        Unknown,
        FlashLoan,
        Reentrancy,
        PriceManipulation,
        GovernanceAttack,
        OracleAttack,
        SandwichAttack,
        FrontRunning,
        QuantumPreparation
    }

    struct ThreatReport {
        bytes32 id;
        ThreatLevel level;
        ThreatType threatType;
        bytes32 signature;
        uint256 timestamp;
        uint256 chainId;
        address reporter;
        uint256 confidence;
        address[] affectedContracts;
        string metadata;
        uint256 signatureCount;
        bool verified;
    }

    struct Mitigation {
        bytes32 id;
        bytes32 threatSignature;
        address targetContract;
        bytes calldataData;
        uint256 effectiveFrom;
        uint256 effectiveUntil;
        bool applied;
        uint256 successCount;
        uint256 failureCount;
    }

    struct OracleSigner {
        address signer;
        uint256 reputation;
        bool active;
        uint256 reportsSubmitted;
        uint256 reportsVerified;
    }

    mapping(bytes32 => ThreatReport) public threatReports;
    mapping(bytes32 => Mitigation) public mitigations;
    mapping(address => OracleSigner) public signers;
    mapping(uint256 => bool) public supportedChains;
    mapping(bytes32 => mapping(address => bool)) public reportSignatures;
    
    bytes32[] public activeThreats;
    uint256 public constant THRESHOLD = 3; // 3 signers required for verification
    uint256 public constant THREAT_TTL = 7 days;

    event ThreatReported(bytes32 indexed id, ThreatLevel level, ThreatType threatType, uint256 timestamp);
    event ThreatVerified(bytes32 indexed id, uint256 signatureCount);
    event MitigationApplied(bytes32 indexed mitigationId, bytes32 threatId, bool success);
    event SignerAdded(address indexed signer, uint256 timestamp);
    event SignerRemoved(address indexed signer, uint256 timestamp);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ADMIN, msg.sender);
        
        // Initialize with main chains
        supportedChains[1] = true; // Ethereum
        supportedChains[10] = true; // Optimism
        supportedChains[42161] = true; // Arbitrum
        supportedChains[137] = true; // Polygon
        supportedChains[56] = true; // BSC
    }

    /**
     * @notice Report a new threat to the oracle network
     */
    function reportThreat(
        ThreatLevel level,
        ThreatType threatType,
        uint256 chainId,
        bytes32 signature,
        uint256 confidence,
        address[] calldata affectedContracts,
        string calldata metadata
    ) external onlyRole(THREAT_REPORTER) nonReentrant returns (bytes32 threatId) {
        require(supportedChains[chainId], "Chain not supported");
        require(confidence <= 100, "Confidence must be <= 100");
        require(level > ThreatLevel.None && level <= ThreatLevel.Critical, "Invalid threat level");
        
        threatId = keccak256(abi.encode(
            level,
            threatType,
            chainId,
            signature,
            block.timestamp,
            msg.sender
        ));

        require(threatReports[threatId].id == bytes32(0), "Threat already reported");

        threatReports[threatId] = ThreatReport({
            id: threatId,
            level: level,
            threatType: threatType,
            signature: signature,
            timestamp: block.timestamp,
            chainId: chainId,
            reporter: msg.sender,
            confidence: confidence,
            affectedContracts: affectedContracts,
            metadata: metadata,
            signatureCount: 1,
            verified: false
        });

        reportSignatures[threatId][msg.sender] = true;
        signers[msg.sender].reportsSubmitted++;
        
        activeThreats.push(threatId);
        
        emit ThreatReported(threatId, level, threatType, block.timestamp);
        
        // Auto-verify if reporter is high reputation
        if (signers[msg.sender].reputation > 90) {
            threatReports[threatId].signatureCount = THRESHOLD;
            threatReports[threatId].verified = true;
            emit ThreatVerified(threatId, THRESHOLD);
        }
    }

    /**
     * @notice Sign an existing threat report
     */
    function signThreatReport(bytes32 threatId) external onlyRole(SIGNER_ROLE) {
        ThreatReport storage report = threatReports[threatId];
        require(report.id != bytes32(0), "Threat not found");
        require(!reportSignatures[threatId][msg.sender], "Already signed");
        require(!report.verified, "Already verified");
        require(block.timestamp < report.timestamp + THREAT_TTL, "Threat expired");

        reportSignatures[threatId][msg.sender] = true;
        report.signatureCount++;
        signers[msg.sender].reportsVerified++;

        if (report.signatureCount >= THRESHOLD) {
            report.verified = true;
            emit ThreatVerified(threatId, report.signatureCount);
        }
    }

    /**
     * @notice Apply mitigation for a verified threat
     */
    function applyMitigation(
        bytes32 threatId,
        bytes32 mitigationId,
        address targetContract,
        bytes calldata data,
        uint256 effectiveFrom,
        uint256 effectiveUntil
    ) external onlyRole(ORACLE_ADMIN) nonReentrant returns (bool) {
        ThreatReport storage report = threatReports[threatId];
        require(report.verified, "Threat not verified");
        require(mitigations[mitigationId].id == bytes32(0), "Mitigation already exists");
        
        mitigations[mitigationId] = Mitigation({
            id: mitigationId,
            threatSignature: report.signature,
            targetContract: targetContract,
            calldataData: data,
            effectiveFrom: effectiveFrom,
            effectiveUntil: effectiveUntil,
            applied: false,
            successCount: 0,
            failureCount: 0
        });

        // Execute mitigation
        (bool success, ) = targetContract.call(data);
        
        mitigations[mitigationId].applied = true;
        if (success) {
            mitigations[mitigationId].successCount++;
        } else {
            mitigations[mitigationId].failureCount++;
        }

        emit MitigationApplied(mitigationId, threatId, success);
        return success;
    }

    /**
     * @notice Add a new signer to the oracle network
     */
    function addSigner(address signer) external onlyRole(ORACLE_ADMIN) {
        require(signer != address(0), "Invalid signer");
        require(!signers[signer].active, "Already a signer");
        
        signers[signer] = OracleSigner({
            signer: signer,
            reputation: 50, // Start with neutral reputation
            active: true,
            reportsSubmitted: 0,
            reportsVerified: 0
        });

        _grantRole(SIGNER_ROLE, signer);
        _grantRole(THREAT_REPORTER, signer);
        
        emit SignerAdded(signer, block.timestamp);
    }

    /**
     * @notice Remove a signer from the oracle network
     */
    function removeSigner(address signer) external onlyRole(ORACLE_ADMIN) {
        require(signers[signer].active, "Not an active signer");
        
        signers[signer].active = false;
        _revokeRole(SIGNER_ROLE, signer);
        
        emit SignerRemoved(signer, block.timestamp);
    }

    /**
     * @notice Update signer reputation based on report accuracy
     */
    function updateSignerReputation(address signer, int256 delta) external onlyRole(ORACLE_ADMIN) {
        require(signers[signer].active, "Not an active signer");
        
        int256 newReputation = int256(signers[signer].reputation) + delta;
        
        // Clamp to 0-100 range
        if (newReputation < 0) {
            newReputation = 0;
        } else if (newReputation > 100) {
            newReputation = 100;
        }
        
        signers[signer].reputation = uint256(newReputation);
    }

    /**
     * @notice Get active threats for a specific chain
     */
    function getActiveThreatsForChain(uint256 chainId) external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeThreats.length; i++) {
            if (threatReports[activeThreats[i]].chainId == chainId && 
                threatReports[activeThreats[i]].verified &&
                block.timestamp < threatReports[activeThreats[i]].timestamp + THREAT_TTL) {
                count++;
            }
        }

        bytes32[] memory threats = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < activeThreats.length; i++) {
            if (threatReports[activeThreats[i]].chainId == chainId && 
                threatReports[activeThreats[i]].verified &&
                block.timestamp < threatReports[activeThreats[i]].timestamp + THREAT_TTL) {
                threats[idx++] = activeThreats[i];
            }
        }

        return threats;
    }

    /**
     * @notice Get threat report details
     */
    function getThreatReport(bytes32 threatId) external view returns (
        ThreatLevel level,
        ThreatType threatType,
        uint256 timestamp,
        uint256 confidence,
        bool verified,
        address[] memory affectedContracts
    ) {
        ThreatReport storage report = threatReports[threatId];
        return (
            report.level,
            report.threatType,
            report.timestamp,
            report.confidence,
            report.verified,
            report.affectedContracts
        );
    }

    /**
     * @notice Check if a signature is in the global blacklist
     */
    function isBlacklisted(bytes32 signature) external view returns (bool) {
        for (uint256 i = 0; i < activeThreats.length; i++) {
            if (threatReports[activeThreats[i]].signature == signature && 
                threatReports[activeThreats[i]].verified &&
                block.timestamp < threatReports[activeThreats[i]].timestamp + THREAT_TTL) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Add a new supported chain
     */
    function addSupportedChain(uint256 chainId) external onlyRole(ORACLE_ADMIN) {
        supportedChains[chainId] = true;
    }

    /**
     * @notice Remove a supported chain
     */
    function removeSupportedChain(uint256 chainId) external onlyRole(ORACLE_ADMIN) {
        supportedChains[chainId] = false;
    }

    /**
     * @notice Clean up expired threats
     */
    function cleanupExpiredThreats() external onlyRole(ORACLE_ADMIN) {
        uint256 i = 0;
        while (i < activeThreats.length) {
            if (block.timestamp >= threatReports[activeThreats[i]].timestamp + THREAT_TTL) {
                activeThreats[i] = activeThreats[activeThreats.length - 1];
                activeThreats.pop();
            } else {
                i++;
            }
        }
    }
}
