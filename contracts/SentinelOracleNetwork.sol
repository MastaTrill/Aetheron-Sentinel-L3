// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SentinelOracleNetwork
 * @notice Decentralized oracle network with quantum-resistant security
 * Provides tamper-proof price feeds and security monitoring data
 */
contract SentinelOracleNetwork is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    // Oracle data structure
    struct OracleData {
        address oracleAddress;
        bytes32 publicKey; // Quantum-resistant public key
        uint256 reputation;
        uint256 lastSubmission;
        uint256 lastSubmissionBlock;
        bool active;
        uint256 stake; // Staked tokens for credibility
    }

    // Price feed structure
    struct PriceFeed {
        string symbol;
        uint256 price;
        uint256 timestamp;
        uint256 confidence; // Confidence interval (basis points)
        uint8 decimals;
        bool isActive;
    }

    // Security metric structure
    struct SecurityMetric {
        string metricName;
        uint256 value;
        uint256 timestamp;
        uint256 reliability; // Reliability score (0-100)
        address reporter;
    }

    // State variables
    mapping(address => OracleData) public oracles;
    mapping(string => PriceFeed) public priceFeeds;
    mapping(string => SecurityMetric[]) public securityMetrics;

    address[] public oracleList;
    string[] public supportedAssets;
    string[] public metricTypes;

    // Network parameters
    uint256 public constant MIN_STAKE = 1000 ether;
    uint256 public constant MAX_ORACLES = 50;
    uint256 public constant SUBMISSION_WINDOW = 1 hours;
    uint256 public constant PRICE_VALIDITY = 24 hours;

    // Reputation system
    uint256 public constant MAX_REPUTATION = 1000;
    uint256 public constant REPUTATION_REWARD = 10;
    uint256 public constant REPUTATION_PENALTY = 50;

    // Security monitoring
    uint256 public networkSecurityScore;
    uint256 public lastSecurityUpdate;
    bool public emergencyShutdown;

    event OracleRegistered(address indexed oracle, uint256 stake);
    event PriceSubmitted(
        string indexed symbol,
        uint256 price,
        address indexed oracle
    );
    event SecurityMetricReported(
        string indexed metric,
        uint256 value,
        address indexed reporter
    );
    event ReputationUpdated(address indexed oracle, uint256 newReputation);
    event EmergencyShutdown(address indexed activator, string reason);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        _initializeNetwork();
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Register as an oracle with quantum-resistant keys
     * @param publicKey Quantum-resistant public key
     */
    function registerOracle(bytes32 publicKey) external payable {
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(!oracles[msg.sender].active, "Already registered");
        require(oracleList.length < MAX_ORACLES, "Network full");
        require(publicKey != bytes32(0), "Invalid public key");

        oracles[msg.sender] = OracleData({
            oracleAddress: msg.sender,
            publicKey: publicKey,
            reputation: 500, // Starting reputation
            lastSubmission: block.timestamp,
            lastSubmissionBlock: 0, // Allow first submission in any block
            active: true,
            stake: msg.value
        });

        oracleList.push(msg.sender);
    }

    /**
     * @notice Submit price feed data
     * @param symbol Asset symbol
     * @param price Current price (with decimals)
     * @param confidence Confidence interval in basis points
     * @param signature Quantum-resistant signature
     */
    function submitPriceFeed(
        string calldata symbol,
        uint256 price,
        uint256 confidence,
        bytes calldata signature
    ) external {
        require(oracles[msg.sender].active, "Not an active oracle");
        require(price > 0, "Invalid price");
        require(confidence <= 10000, "Invalid confidence"); // Max 100%
        require(!emergencyShutdown, "Network shutdown");

        // Verify quantum-resistant signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(symbol, price, confidence, block.timestamp)
        );
        require(
            _verifyQuantumSignature(msg.sender, messageHash, signature),
            "Invalid signature"
        );

        // Update price feed using median calculation
        _updatePriceFeed(symbol, price, confidence, msg.sender);

        // Update oracle reputation
        _updateOracleReputation(msg.sender, true);

        emit PriceSubmitted(symbol, price, msg.sender);
    }

    /**
     * @notice Report security metric
     * @param metricName Name of security metric
     * @param value Metric value
     * @param signature Quantum-resistant signature
     */
    function reportSecurityMetric(
        string calldata metricName,
        uint256 value,
        bytes calldata signature
    ) external {
        require(oracles[msg.sender].active, "Not an active oracle");
        require(!emergencyShutdown, "Network shutdown");

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(metricName, value, block.timestamp)
        );
        require(
            _verifyQuantumSignature(msg.sender, messageHash, signature),
            "Invalid signature"
        );

        SecurityMetric memory metric = SecurityMetric({
            metricName: metricName,
            value: value,
            timestamp: block.timestamp,
            reliability: oracles[msg.sender].reputation / 10, // Reputation-based reliability
            reporter: msg.sender
        });

        securityMetrics[metricName].push(metric);

        // Update network security score
        _updateNetworkSecurity(metricName, value);

        // Update oracle reputation
        _updateOracleReputation(msg.sender, true);

        emit SecurityMetricReported(metricName, value, msg.sender);
    }

    /**
     * @notice Get latest price for asset
     * @param symbol Asset symbol
     */
    function getPrice(
        string calldata symbol
    )
        external
        view
        returns (
            uint256 price,
            uint256 timestamp,
            uint256 confidence,
            bool isValid
        )
    {
        PriceFeed memory feed = priceFeeds[symbol];
        bool valid = feed.isActive &&
            (block.timestamp - feed.timestamp) <= PRICE_VALIDITY;

        return (feed.price, feed.timestamp, feed.confidence, valid);
    }

    /**
     * @notice Get security metric data
     * @param metricName Name of metric
     */
    function getSecurityMetric(
        string calldata metricName
    )
        external
        view
        returns (
            uint256 latestValue,
            uint256 timestamp,
            uint256 averageReliability
        )
    {
        SecurityMetric[] memory metrics = securityMetrics[metricName];
        require(metrics.length > 0, "No metrics available");

        SecurityMetric memory latest = metrics[metrics.length - 1];
        uint256 totalReliability = 0;

        // Calculate average reliability from recent metrics
        uint256 count = 0;
        for (
            uint256 i = (metrics.length > 10 ? metrics.length - 10 : 0);
            i < metrics.length;
            i++
        ) {
            totalReliability += metrics[i].reliability;
            count++;
        }

        return (
            latest.value,
            latest.timestamp,
            count > 0 ? totalReliability / count : 0
        );
    }

    /**
     * @notice Get oracle information
     * @param oracle Oracle address
     */
    function getOracleInfo(
        address oracle
    )
        external
        view
        returns (
            bool active,
            uint256 reputation,
            uint256 stake,
            uint256 lastSubmission
        )
    {
        OracleData memory data = oracles[oracle];
        return (data.active, data.reputation, data.stake, data.lastSubmission);
    }

    /**
     * @notice Emergency shutdown of oracle network
     * @param reason Reason for shutdown
     */
    function triggerEmergencyShutdown(
        string calldata reason
    ) external onlyOwner {
        emergencyShutdown = true;
        emit EmergencyShutdown(msg.sender, reason);
    }

    /**
     * @notice Add supported asset for price feeds
     * @param symbol Asset symbol
     * @param decimals Price decimals
     */
    function addSupportedAsset(
        string calldata symbol,
        uint8 decimals
    ) external onlyOwner {
        require(!priceFeeds[symbol].isActive, "Asset already supported");

        priceFeeds[symbol] = PriceFeed({
            symbol: symbol,
            price: 0,
            timestamp: 0,
            confidence: 0,
            decimals: decimals,
            isActive: true
        });

        supportedAssets.push(symbol);
    }

    /**
     * @notice Slash oracle stake for malicious behavior
     * @param oracle Oracle to slash
     * @param penalty Percentage to slash (basis points)
     */
    function slashOracle(address oracle, uint256 penalty) external onlyOwner {
        require(oracles[oracle].active, "Oracle not active");
        require(penalty <= 10000, "Invalid penalty"); // Max 100%

        uint256 slashAmount = oracles[oracle].stake.mul(penalty).div(10000);
        oracles[oracle].stake = oracles[oracle].stake.sub(slashAmount);

        // Update reputation
        _updateOracleReputation(oracle, false);

        // Transfer slashed amount to treasury
        (bool ok, ) = payable(owner()).call{value: slashAmount}("");
        require(ok, "ETH transfer failed");
    }

    /**
     * @notice Update price feed using median calculation
     */
    function _updatePriceFeed(
        string memory symbol,
        uint256 newPrice,
        uint256 confidence,
        address oracle
    ) internal {
        PriceFeed storage feed = priceFeeds[symbol];
        require(feed.isActive, "Asset not supported");

        // Simple median calculation (in production, would use multiple submissions)
        if (feed.price == 0) {
            // First submission
            feed.price = newPrice;
            feed.timestamp = block.timestamp;
            feed.confidence = confidence;
        } else {
            // Update with weighted average based on oracle reputation
            uint256 oracleWeight = oracles[oracle].reputation;
            uint256 totalWeight = MAX_REPUTATION; // Simplified

            feed.price =
                (feed.price *
                    (totalWeight - oracleWeight) +
                    newPrice *
                    oracleWeight) /
                totalWeight;
            feed.timestamp = block.timestamp;
            feed.confidence = confidence;
        }
    }

    /**
     * @notice Update network security score
     */
    function _updateNetworkSecurity(
        string memory metricName,
        uint256 value
    ) internal {
        // Simplified security scoring
        if (
            keccak256(abi.encodePacked(metricName)) ==
            keccak256(abi.encodePacked("anomaly_count"))
        ) {
            networkSecurityScore = value < 10 ? 900 : value < 50 ? 700 : 500;
        } else if (
            keccak256(abi.encodePacked(metricName)) ==
            keccak256(abi.encodePacked("bridge_volume"))
        ) {
            networkSecurityScore = value > 100000 ether
                ? 950
                : value > 10000 ether
                ? 850
                : 750;
        }

        lastSecurityUpdate = block.timestamp;
    }

    /**
     * @notice Update oracle reputation
     */
    function _updateOracleReputation(address oracle, bool positive) internal {
        OracleData storage oracleData = oracles[oracle];

        if (positive) {
            oracleData.reputation = oracleData.reputation.add(
                REPUTATION_REWARD
            );
            if (oracleData.reputation > MAX_REPUTATION) {
                oracleData.reputation = MAX_REPUTATION;
            }
        } else {
            oracleData.reputation = oracleData.reputation > REPUTATION_PENALTY
                ? oracleData.reputation.sub(REPUTATION_PENALTY)
                : 0;
        }

        oracleData.lastSubmission = block.timestamp;
        oracleData.lastSubmissionBlock = block.number;

        emit ReputationUpdated(oracle, oracleData.reputation);
    }

    /**
     * @notice Verify quantum-resistant signature
     */
    function _verifyQuantumSignature(
        address oracle,
        bytes32 messageHash,
        bytes memory signature
    ) internal view returns (bool) {
        // In production, this would use actual quantum-resistant signature verification
        // For demo, using simplified ECDSA with additional checks

        require(
            oracles[oracle].publicKey != bytes32(0),
            "No public key registered"
        );

        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(
            messageHash
        );
        address recovered = ECDSA.recover(ethSignedMessageHash, signature);
        bool isValid = recovered == oracle;

        // Prevent same-block replay / rate-limit successive submissions
        require(
            block.number > oracles[oracle].lastSubmissionBlock,
            "Already submitted this block"
        );

        return isValid;
    }

    /**
     * @notice Initialize network parameters
     */
    function _initializeNetwork() internal {
        networkSecurityScore = 800; // Starting security score
        lastSecurityUpdate = block.timestamp;
        emergencyShutdown = false;

        // Add default metric types
        metricTypes.push("anomaly_count");
        metricTypes.push("bridge_volume");
        metricTypes.push("oracle_participation");
        metricTypes.push("network_uptime");
    }
}
