// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MemoryForensics
 * @notice On-chain memory pattern analysis for anomaly detection
 * @dev Detects malicious memory patterns and suspicious storage access
 * 
 * Features:
 * - Memory access pattern analysis
 * - Storage-gas temporal correlation detection
 * - Reentrancy pattern detection
 * - Dynamic memory allocation analysis
 * - Stack frame anomaly detection
 */
contract MemoryForensics is AccessControl, ReentrancyGuard {
    bytes32 public constant FORENSICS_ADMIN = keccak256("FORENSICS_ADMIN");
    bytes32 public constant ANALYZER_ROLE = keccak256("ANALYZER_ROLE");

    enum AnomalyType {
        None,
        UnusualMemoryAccess,
        StorageGasCorrelation,
        ReentrancyPattern,
        DynamicAllocation,
        StackFrameAnomaly,
        FlashLoanIndicator,
        SandwichAttack
    }

    struct MemorySnapshot {
        bytes32 hash;
        uint256 gasUsed;
        uint256 memorySize;
        uint256 allocationCount;
        uint256 timestamp;
        uint8 flags;
    }

    struct AnalysisResult {
        AnomalyType anomalyType;
        uint256 confidence;
        uint256 threatScore;
        bytes32 evidence;
    }

    mapping(bytes32 => MemorySnapshot[]) public memorySnapshots;
    mapping(address => AnalysisResult[]) public recentAnalysis;
    mapping(address => uint256) public lastAnalysisTime;
    
    uint256 public snapshotInterval = 1 hours;
    uint256 public analysisThreshold = 75;
    uint256 public maxSnapshotsPerContract = 100;
    
    uint256 public constant MEMORY_WORD_SIZE = 32;
    uint256 public constant STORAGE_SLOT_SIZE = 32;
    
    event MemoryAnalyzed(address indexed contractAddr, AnomalyType anomalyType, uint256 confidence);
    event ThreatDetected(address indexed contractAddr, uint256 threatScore, bytes32 evidence);
    event SnapshotRecorded(address indexed contractAddr, bytes32 snapshotHash);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FORENSICS_ADMIN, msg.sender);
        _grantRole(ANALYZER_ROLE, msg.sender);
    }

    function captureSnapshot(
        address targetContract,
        bytes32 callHash,
        uint256 gasUsed,
        uint256 memorySize,
        uint256 allocationCount,
        uint8 flags
    ) external onlyRole(ANALYZER_ROLE) nonReentrant {
        require(targetContract != address(0), "Invalid contract");
        
        bytes32 snapshotHash = keccak256(abi.encode(
            callHash,
            gasUsed,
            memorySize,
            allocationCount,
            block.timestamp,
            flags
        ));
        
        MemorySnapshot memory snapshot = MemorySnapshot({
            hash: snapshotHash,
            gasUsed: gasUsed,
            memorySize: memorySize,
            allocationCount: allocationCount,
            timestamp: block.timestamp,
            flags: flags
        });
        
        memorySnapshots[callHash].push(snapshot);
        
        emit SnapshotRecorded(targetContract, snapshotHash);
    }

    function analyzeMemoryPatterns(
        address targetContract,
        bytes32[] calldata snapshotHashes
    ) external onlyRole(ANALYZER_ROLE) returns (AnalysisResult[] memory results) {
        require(targetContract != address(0), "Invalid contract");
        require(snapshotHashes.length >= 2, "Need multiple snapshots");
        
        results = new AnalysisResult[](snapshotHashes.length);
        
        for (uint256 i = 0; i < snapshotHashes.length; i++) {
            MemorySnapshot storage snapshot = memorySnapshots[snapshotHashes[i]][0];
            
            AnomalyType anomalyType = AnomalyType.None;
            uint256 confidence = 0;
            uint256 threatScore = 0;
            bytes32 evidence = 0;
            
            // Check for reentrancy pattern
            if (i > 0) {
                MemorySnapshot storage prev = memorySnapshots[snapshotHashes[i - 1]][0];
                
                if (snapshot.memorySize > prev.memorySize * 2) {
                    anomalyType = AnomalyType.DynamicAllocation;
                    confidence = 75;
                    threatScore = 60;
                    evidence = keccak256(abi.encode(snapshot.memorySize, prev.memorySize));
                }
                
                // Check storage-gas correlation for storage reads
                uint256 gasDiff = snapshot.gasUsed > prev.gasUsed ? 
                    snapshot.gasUsed - prev.gasUsed : prev.gasUsed - snapshot.gasUsed;
                
                if (gasDiff > 50000 && snapshot.memorySize == prev.memorySize) {
                    anomalyType = AnomalyType.StorageGasCorrelation;
                    confidence = 80;
                    threatScore = 70;
                    evidence = keccak256(abi.encode(gasDiff, "storage"));
                }
            }
            
            // Check for unusual flags
            if (snapshot.flags & 0x01 != 0) {
                if (anomalyType == AnomalyType.None) {
                    anomalyType = AnomalyType.UnusualMemoryAccess;
                }
                confidence = confidence > confidence ? confidence : 65;
                threatScore += 30;
            }
            
            results[i] = AnalysisResult({
                anomalyType: anomalyType,
                confidence: confidence,
                threatScore: threatScore,
                evidence: evidence
            });
            
            if (threatScore >= analysisThreshold) {
                emit ThreatDetected(targetContract, threatScore, evidence);
            }
            
            emit MemoryAnalyzed(targetContract, anomalyType, confidence);
        }
    }

    function detectReentrancyAttempt(
        bytes32 callDataHash,
        uint256 initialBalance,
        uint256 finalBalance,
        uint256 callCount
    ) external view returns (bool isReentrancy, uint256 riskScore) {
        require(callCount > 0, "No calls recorded");
        
        // High call count with minimal balance change indicates reentrancy loop
        if (callCount > 5 && finalBalance > initialBalance * 95 / 100) {
            isReentrancy = true;
            riskScore = 90;
        } else if (callCount > 3 && finalBalance > initialBalance * 90 / 100) {
            isReentrancy = true;
            riskScore = 60;
        } else {
            riskScore = 0;
        }
    }

    function detectSandwichAttack(
        uint256 frontRunGas,
        uint256 victimGas,
        uint256 backRunGas,
        uint256 priceImpact
    ) external view returns (bool isSandwich, uint256 confidence) {
        require(frontRunGas > 0 && victimGas > 0 && backRunGas > 0, "Invalid gas values");
        
        // Sandwich pattern: similar gas usage before and after with significant price impact
        bool hasFrontRun = frontRunGas > victimGas * 3 / 2;
        bool hasBackRun = backRunGas > victimGas * 3 / 2;
        
        if (hasFrontRun && hasBackRun && priceImpact > 100) {
            isSandwich = true;
            confidence = 85;
        } else if (hasFrontRun && hasBackRun) {
            isSandwich = true;
            confidence = 50;
        } else {
            confidence = 0;
        }
    }

    function detectFlashLoan(
        address token,
        uint256 borrowAmount,
        uint256 blockNumber
    ) external view returns (bool isFlashLoan, uint256 riskScore) {
        require(borrowAmount > 0, "Invalid borrow amount");
        
        // Simplified flash loan detection based on borrow size
        // In production, integrate with price oracles for accurate detection
        if (borrowAmount > 1000 ether) {
            isFlashLoan = true;
            riskScore = 85;
        } else if (borrowAmount > 100 ether) {
            isFlashLoan = true;
            riskScore = 50;
        } else {
            riskScore = 0;
        }
    }

    function setSnapshotInterval(uint256 interval) external onlyRole(FORENSICS_ADMIN) {
        require(interval >= 5 minutes && interval <= 24 hours, "Invalid interval");
        snapshotInterval = interval;
    }

    function setAnalysisThreshold(uint256 threshold) external onlyRole(FORENSICS_ADMIN) {
        require(threshold >= 0 && threshold <= 100, "Invalid threshold");
        analysisThreshold = threshold;
    }

    function getMemorySnapshots(address contractAddr) external view returns (MemorySnapshot[] memory) {
        return memorySnapshots[keccak256(abi.encode(contractAddr))];
    }
}