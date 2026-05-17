// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./lzApp/LzApp.sol";

/**
 * @title SentinelCrossChainSecurityOracle
 * @notice Cross-chain security oracles aggregating threat data across multiple blockchains
 */
contract SentinelCrossChainSecurityOracle is LzApp {
    using ECDSA for bytes32;

    // Chain configuration
    struct ChainConfig {
        uint16 chainId;
        address oracleAddress;
        bool isActive;
        uint256 lastUpdate;
        uint256 trustScore; // 0-100
    }

    // Security data structure
    struct SecurityData {
        uint256 timestamp;
        uint256 threatLevel; // 0-100
        uint256 anomalyCount;
        uint256 activeAlerts;
        bytes32 dataHash;
        address reporter;
        uint16 sourceChain;
    }

    // Aggregated security metrics
    struct AggregatedMetrics {
        uint256 globalThreatLevel;
        uint256 totalChains;
        uint256 activeChains;
        uint256 averageTrustScore;
        uint256 lastAggregation;
        mapping(uint16 => SecurityData) chainData;
    }

    mapping(uint16 => ChainConfig) public chainConfigs;
    mapping(bytes32 => SecurityData) public securityData;
    mapping(address => bool) public authorizedReporters;

    AggregatedMetrics public aggregatedMetrics;
    uint256 public constant TRUST_THRESHOLD = 70;
    uint256 public constant DATA_FRESHNESS_THRESHOLD = 1 hours;

    event SecurityDataReported(uint16 indexed chainId, bytes32 indexed dataHash, uint256 threatLevel);
    event ChainOracleUpdated(uint16 indexed chainId, address indexed oracleAddress);
    event MetricsAggregated(uint256 globalThreatLevel, uint256 activeChains);
    event AlertTriggered(uint16 indexed chainId, string alertType, uint256 severity);

    constructor(address _lzEndpoint) LzApp(_lzEndpoint) {
        aggregatedMetrics.totalChains = 0;
        aggregatedMetrics.activeChains = 0;
    }

    /**
     * @notice Configure chain oracle
     */
    function configureChainOracle(uint16 chainId, address oracleAddress, uint256 initialTrustScore) external onlyOwner {
        require(initialTrustScore <= 100, "Invalid trust score");

        chainConfigs[chainId] = ChainConfig({
            chainId: chainId,
            oracleAddress: oracleAddress,
            isActive: true,
            lastUpdate: block.timestamp,
            trustScore: initialTrustScore
        });

        if (aggregatedMetrics.totalChains == 0 || chainConfigs[chainId].oracleAddress == address(0)) {
            aggregatedMetrics.totalChains++;
        }

        emit ChainOracleUpdated(chainId, oracleAddress);
    }

    /**
     * @notice Report security data from chain oracle
     */
    function reportSecurityData(
        uint16 sourceChain,
        uint256 threatLevel,
        uint256 anomalyCount,
        uint256 activeAlerts,
        bytes32 dataHash,
        bytes memory signature
    ) external {
        require(chainConfigs[sourceChain].isActive, "Chain not configured");
        require(
            authorizedReporters[msg.sender] || msg.sender == chainConfigs[sourceChain].oracleAddress,
            "Unauthorized reporter"
        );

        // Verify signature (optional, for additional security)
        if (signature.length > 0) {
            _verifySignature(sourceChain, threatLevel, anomalyCount, activeAlerts, dataHash, signature);
        }

        SecurityData memory data = SecurityData({
            timestamp: block.timestamp,
            threatLevel: threatLevel,
            anomalyCount: anomalyCount,
            activeAlerts: activeAlerts,
            dataHash: dataHash,
            reporter: msg.sender,
            sourceChain: sourceChain
        });

        securityData[dataHash] = data;

        // Update chain config
        chainConfigs[sourceChain].lastUpdate = block.timestamp;

        // Check for alerts
        _checkSecurityAlerts(sourceChain, data);

        emit SecurityDataReported(sourceChain, dataHash, threatLevel);
    }

    /**
     * @notice Aggregate security metrics across all chains
     */
    function aggregateSecurityMetrics() external {
        uint256 totalThreatLevel = 0;
        uint256 activeChains = 0;
        uint256 totalTrustScore = 0;

        for (uint16 chainId = 1; chainId <= 100; chainId++) {
            // Reasonable upper bound
            if (chainConfigs[chainId].isActive) {
                ChainConfig memory config = chainConfigs[chainId];

                // Only use fresh data
                if (block.timestamp - config.lastUpdate <= DATA_FRESHNESS_THRESHOLD) {
                    SecurityData memory latestData = _getLatestChainData(chainId);

                    if (latestData.timestamp > 0) {
                        uint256 weightedThreat = (latestData.threatLevel * config.trustScore) / 100;
                        totalThreatLevel += weightedThreat;
                        totalTrustScore += config.trustScore;
                        activeChains++;

                        aggregatedMetrics.chainData[chainId] = latestData;
                    }
                }
            }
        }

        if (activeChains > 0) {
            aggregatedMetrics.globalThreatLevel = totalThreatLevel / activeChains;
            aggregatedMetrics.activeChains = activeChains;
            aggregatedMetrics.averageTrustScore = totalTrustScore / activeChains;
            aggregatedMetrics.lastAggregation = block.timestamp;

            emit MetricsAggregated(aggregatedMetrics.globalThreatLevel, activeChains);
        }
    }

    /**
     * @notice Cross-chain security data sharing via LayerZero
     */
    function shareSecurityData(
        uint16 dstChainId,
        uint256 threatLevel,
        uint256 anomalyCount,
        uint256 activeAlerts,
        address payable refundAddress,
        address zroPaymentAddress,
        bytes calldata adapterParams
    ) external payable {
        require(chainConfigs[dstChainId].isActive, "Destination chain not configured");

        bytes32 dataHash =
            keccak256(abi.encodePacked(dstChainId, threatLevel, anomalyCount, activeAlerts, block.timestamp));

        bytes memory payload = abi.encode(
            uint16(block.chainid), // sourceChain
            threatLevel,
            anomalyCount,
            activeAlerts,
            dataHash,
            "" // signature placeholder
        );

        _lzSend(dstChainId, payload, refundAddress, zroPaymentAddress, adapterParams, msg.value);
    }

    /**
     * @notice Receive cross-chain security data
     */
    function _blockingLzReceive(uint16, bytes memory, uint64, bytes memory _payload) internal override {
        (
            uint16 sourceChain,
            uint256 threatLevel,
            uint256 anomalyCount,
            uint256 activeAlerts,
            bytes32 dataHash,
            bytes memory signature
        ) = abi.decode(_payload, (uint16, uint256, uint256, uint256, bytes32, bytes));

        // Verify signature if provided
        if (signature.length > 0) {
            _verifySignature(sourceChain, threatLevel, anomalyCount, activeAlerts, dataHash, signature);
        }

        // Store security data
        securityData[dataHash] = SecurityData({
            timestamp: block.timestamp,
            threatLevel: threatLevel,
            anomalyCount: anomalyCount,
            activeAlerts: activeAlerts,
            dataHash: dataHash,
            reporter: msg.sender,
            sourceChain: sourceChain
        });

        // Update chain config
        chainConfigs[sourceChain].lastUpdate = block.timestamp;

        // Check for alerts
        _checkSecurityAlerts(sourceChain, securityData[dataHash]);

        emit SecurityDataReported(sourceChain, dataHash, threatLevel);
    }

    /**
     * @notice Get global security metrics
     */
    function getGlobalSecurityMetrics()
        external
        view
        returns (uint256 globalThreatLevel, uint256 totalChains, uint256 activeChains, uint256 averageTrustScore)
    {
        return (
            aggregatedMetrics.globalThreatLevel,
            aggregatedMetrics.totalChains,
            aggregatedMetrics.activeChains,
            aggregatedMetrics.averageTrustScore
        );
    }

    /**
     * @notice Get chain-specific security data
     */
    function getChainSecurityData(uint16 chainId) external view returns (SecurityData memory) {
        return aggregatedMetrics.chainData[chainId];
    }

    /**
     * @notice Add authorized reporter
     */
    function addAuthorizedReporter(address reporter) external onlyOwner {
        authorizedReporters[reporter] = true;
    }

    /**
     * @notice Remove authorized reporter
     */
    function removeAuthorizedReporter(address reporter) external onlyOwner {
        authorizedReporters[reporter] = false;
    }

    /**
     * @notice Update chain trust score
     */
    function updateChainTrustScore(uint16 chainId, uint256 newScore) external onlyOwner {
        require(newScore <= 100, "Invalid trust score");
        chainConfigs[chainId].trustScore = newScore;
    }

    /**
     * @notice Deactivate chain oracle
     */
    function deactivateChainOracle(uint16 chainId) external onlyOwner {
        chainConfigs[chainId].isActive = false;
        aggregatedMetrics.totalChains--;
    }

    /**
     * @dev Check for security alerts
     */
    function _checkSecurityAlerts(uint16 chainId, SecurityData memory data) internal {
        if (data.threatLevel >= 80) {
            emit AlertTriggered(chainId, "HIGH_THREAT_LEVEL", data.threatLevel);
        }

        if (data.anomalyCount > 100) {
            emit AlertTriggered(chainId, "HIGH_ANOMALY_COUNT", data.anomalyCount);
        }

        if (data.activeAlerts > 10) {
            emit AlertTriggered(chainId, "MULTIPLE_ACTIVE_ALERTS", data.activeAlerts);
        }
    }

    /**
     * @dev Get latest security data for chain
     */
    function _getLatestChainData(uint16) internal pure returns (SecurityData memory) {
        // This would need a more sophisticated data structure to track latest data per chain
        // For now, return empty data
        return SecurityData(0, 0, 0, 0, bytes32(0), address(0), 0);
    }

    /**
     * @dev Verify oracle signature
     */
    function _verifySignature(
        uint16 sourceChain,
        uint256 threatLevel,
        uint256 anomalyCount,
        uint256 activeAlerts,
        bytes32 dataHash,
        bytes memory signature
    ) internal view {
        bytes32 messageHash = keccak256(
            abi.encodePacked(sourceChain, threatLevel, anomalyCount, activeAlerts, dataHash)
        );

        address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signature);
        require(signer == chainConfigs[sourceChain].oracleAddress, "Invalid signature");
    }
}
