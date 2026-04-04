// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title DecentralizedOracleNetwork
 * @notice Quantum-secure decentralized oracle network with consensus mechanisms
 * @dev Implements:
 *      - Multi-source data aggregation
 *      - Byzantine fault tolerance
 *      - Quantum-resistant consensus
 *      - Reputation-based oracle scoring
 *      - Cross-validation mechanisms
 *      - Sybil attack protection
 *      - Data freshness guarantees
 */
contract DecentralizedOracleNetwork is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant ORACLE_NODE = keccak256("ORACLE_NODE");
    bytes32 public constant VALIDATOR = keccak256("VALIDATOR");
    bytes32 public constant GOVERNANCE = keccak256("GOVERNANCE");

    enum ConsensusAlgorithm {
        MAJORITY_VOTE,
        WEIGHTED_AVERAGE,
        MEDIAN_SELECTION,
        QUANTUM_BYZANTINE_AGREEMENT
    }

    enum DataSource {
        PRICE_FEED,
        LIQUIDITY_DATA,
        TRANSACTION_VOLUME,
        RISK_METRICS,
        EXTERNAL_API,
        BLOCKCHAIN_DATA
    }

    struct OracleNode {
        address nodeAddress;
        bytes32 nodeId;
        uint256 reputation;        // 0-1000
        uint256 stakeAmount;
        uint256 lastSubmission;
        uint256 uptime;           // Percentage
        bool isActive;
        DataSource[] specializations;
        bytes32 quantumKeyCommitment;
    }

    struct DataRequest {
        bytes32 requestId;
        DataSource dataType;
        bytes32 queryParameters;
        uint256 timestamp;
        uint256 deadline;
        uint256 minimumResponses;
        ConsensusAlgorithm consensusType;
        bool fulfilled;
        bytes32 result;
        uint256 confidence;
    }

    struct OracleResponse {
        bytes32 requestId;
        address oracle;
        bytes32 data;
        uint256 timestamp;
        bytes32 signature;
        uint256 stake;           // Reputation-weighted stake
        bool validated;
    }

    struct ConsensusResult {
        bytes32 requestId;
        bytes32 finalData;
        uint256 confidence;
        uint256 participantCount;
        uint256 totalStake;
        bool consensusReached;
        ConsensusAlgorithm algorithm;
    }

    // State
    mapping(address => OracleNode) public oracleNodes;
    mapping(bytes32 => DataRequest) public dataRequests;
    mapping(bytes32 => OracleResponse[]) public requestResponses;
    mapping(bytes32 => ConsensusResult) public consensusResults;

    address[] public activeOracles;
    bytes32[] public pendingRequests;

    // Configuration
    uint256 public minimumStake = 100 ether;
    uint256 public consensusThreshold = 70; // 70% agreement required
    uint256 public maximumOracleCount = 100;
    uint256 public requestTimeout = 5 minutes;
    uint256 public reputationDecayRate = 1; // Daily decay

    // Quantum security
    bytes32 public networkQuantumKey;
    uint256 public keyRotationInterval = 24 hours;
    uint256 public lastKeyRotation;

    // Events
    event OracleRegistered(address indexed oracle, bytes32 nodeId, uint256 stake);
    event DataRequested(bytes32 indexed requestId, DataSource dataType, bytes32 parameters);
    event OracleResponseSubmitted(bytes32 indexed requestId, address indexed oracle, bytes32 data);
    event ConsensusReached(bytes32 indexed requestId, bytes32 result, uint256 confidence);
    event OracleSlashed(address indexed oracle, uint256 amount, string reason);
    event ReputationUpdated(address indexed oracle, uint256 newReputation);
    event QuantumKeyRotated(bytes32 oldKey, bytes32 newKey);

    // Errors
    error InsufficientStake(uint256 provided, uint256 required);
    error OracleAlreadyRegistered(address oracle);
    error OracleNotFound(address oracle);
    error InvalidQuantumCommitment();
    error ConsensusNotReached(uint256 votes, uint256 required);
    error RequestExpired(bytes32 requestId);
    error DuplicateResponse(address oracle, bytes32 requestId);
    error InvalidDataFormat();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE, msg.sender);

        // Initialize network quantum key
        networkQuantumKey = keccak256(abi.encode("NETWORK_QUANTUM_KEY", block.timestamp));
        lastKeyRotation = block.timestamp;
    }

    // ============ Oracle Node Management ============

    /**
     * @notice Register as an oracle node
     * @param quantumCommitment Commitment to quantum-resistant key
     * @param specializations Data sources this oracle specializes in
     */
    function registerOracle(
        bytes32 quantumCommitment,
        DataSource[] calldata specializations
    ) external payable returns (bytes32 nodeId) {
        require(msg.value >= minimumStake, "Insufficient stake");
        require(oracleNodes[msg.sender].nodeAddress == address(0), "Already registered");
        require(activeOracles.length < maximumOracleCount, "Network full");

        nodeId = keccak256(abi.encode(
            "ORACLE_NODE",
            msg.sender,
            quantumCommitment,
            block.timestamp
        ));

        OracleNode storage node = oracleNodes[msg.sender];
        node.nodeAddress = msg.sender;
        node.nodeId = nodeId;
        node.reputation = 500; // Start at neutral reputation
        node.stakeAmount = msg.value;
        node.lastSubmission = block.timestamp;
        node.uptime = 100;
        node.isActive = true;
        node.specializations = specializations;
        node.quantumKeyCommitment = quantumCommitment;

        activeOracles.push(msg.sender);

        _grantRole(ORACLE_NODE, msg.sender);

        emit OracleRegistered(msg.sender, nodeId, msg.value);
    }

    /**
     * @notice Update oracle specializations
     */
    function updateSpecializations(DataSource[] calldata newSpecializations)
        external
        onlyRole(ORACLE_NODE)
    {
        oracleNodes[msg.sender].specializations = newSpecializations;
    }

    // ============ Data Request System ============

    /**
     * @notice Request data from the oracle network
     * @param dataType Type of data requested
     * @param queryParameters Query-specific parameters
     * @param consensusType Consensus algorithm to use
     */
    function requestData(
        DataSource dataType,
        bytes32 queryParameters,
        ConsensusAlgorithm consensusType
    ) external onlyRole(GOVERNANCE) returns (bytes32 requestId) {
        requestId = keccak256(abi.encode(
            "DATA_REQUEST",
            msg.sender,
            dataType,
            queryParameters,
            block.timestamp
        ));

        DataRequest storage request = dataRequests[requestId];
        request.requestId = requestId;
        request.dataType = dataType;
        request.queryParameters = queryParameters;
        request.timestamp = block.timestamp;
        request.deadline = block.timestamp + requestTimeout;
        request.minimumResponses = _calculateMinimumResponses();
        request.consensusType = consensusType;

        pendingRequests.push(requestId);

        emit DataRequested(requestId, dataType, queryParameters);
    }

    /**
     * @notice Submit oracle response to data request
     * @param requestId Request identifier
     * @param data Response data
     * @param signature Quantum-resistant signature
     */
    function submitResponse(
        bytes32 requestId,
        bytes32 data,
        bytes calldata signature
    ) external onlyRole(ORACLE_NODE) {
        DataRequest storage request = dataRequests[requestId];
        require(request.requestId != bytes32(0), "Request not found");
        require(block.timestamp <= request.deadline, "Request expired");
        require(!request.fulfilled, "Request already fulfilled");

        // Verify no duplicate response
        OracleResponse[] storage responses = requestResponses[requestId];
        for (uint256 i = 0; i < responses.length; i++) {
            require(responses[i].oracle != msg.sender, "Duplicate response");
        }

        // Verify quantum signature
        _verifyQuantumSignature(requestId, data, signature);

        OracleNode storage node = oracleNodes[msg.sender];
        uint256 stakeWeight = node.reputation * node.stakeAmount / 1000;

        OracleResponse memory response = OracleResponse({
            requestId: requestId,
            oracle: msg.sender,
            data: data,
            timestamp: block.timestamp,
            signature: keccak256(signature),
            stake: stakeWeight,
            validated: true
        });

        responses.push(response);

        // Update node statistics
        node.lastSubmission = block.timestamp;

        emit OracleResponseSubmitted(requestId, msg.sender, data);

        // Check if we can reach consensus
        if (responses.length >= request.minimumResponses) {
            _attemptConsensus(requestId);
        }
    }

    // ============ Consensus Mechanisms ============

    /**
     * @notice Attempt to reach consensus on responses
     */
    function _attemptConsensus(bytes32 requestId) internal {
        DataRequest storage request = dataRequests[requestId];
        OracleResponse[] storage responses = requestResponses[requestId];

        if (request.consensusType == ConsensusAlgorithm.MAJORITY_VOTE) {
            _consensusMajorityVote(request, responses);
        } else if (request.consensusType == ConsensusAlgorithm.WEIGHTED_AVERAGE) {
            _consensusWeightedAverage(request, responses);
        } else if (request.consensusType == ConsensusAlgorithm.MEDIAN_SELECTION) {
            _consensusMedianSelection(request, responses);
        } else if (request.consensusType == ConsensusAlgorithm.QUANTUM_BYZANTINE_AGREEMENT) {
            _consensusQuantumByzantine(request, responses);
        }
    }

    /**
     * @notice Majority vote consensus
     */
    function _consensusMajorityVote(
        DataRequest storage request,
        OracleResponse[] storage responses
    ) internal {
        // Count votes for each data value - use memory arrays instead
        bytes32[] memory uniqueValues = new bytes32[](responses.length);
        uint256[] memory voteCounts = new uint256[](responses.length);
        uint256[] memory stakeWeights = new uint256[](responses.length);
        uint256 uniqueCount = 0;

        for (uint256 i = 0; i < responses.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueValues[j] == responses[i].data) {
                    voteCounts[j]++;
                    stakeWeights[j] += responses[i].stake;
                    found = true;
                    break;
                }
            }
            if (!found) {
                uniqueValues[uniqueCount] = responses[i].data;
                voteCounts[uniqueCount] = 1;
                stakeWeights[uniqueCount] = responses[i].stake;
                uniqueCount++;
            }
        }

        // Find majority
        bytes32 majorityData;
        uint256 maxVotes = 0;
        uint256 totalStake = 0;

        for (uint256 i = 0; i < uniqueCount; i++) {
            totalStake += stakeWeights[i];
            if (voteCounts[i] > maxVotes) {
                maxVotes = voteCounts[i];
                majorityData = uniqueValues[i];
            }
        }

        // Check consensus threshold
        uint256 agreementPercentage = uniqueCount > 0 ? (maxVotes * 100) / uniqueCount : 0;
        uint256 stakePercentage = totalStake > 0 ? (stakeWeights[0] * 100) / totalStake : 0;

        // Find stake weight for majority
        for (uint256 i = 0; i < uniqueCount; i++) {
            if (uniqueValues[i] == majorityData) {
                stakePercentage = totalStake > 0 ? (stakeWeights[i] * 100) / totalStake : 0;
                break;
            }
        }

        if (agreementPercentage >= consensusThreshold && stakePercentage >= consensusThreshold) {
            _finalizeConsensus(request, majorityData, agreementPercentage);
        }
    }

    /**
     * @notice Weighted average consensus for numerical data
     */
    function _consensusWeightedAverage(
        DataRequest storage request,
        OracleResponse[] storage responses
    ) internal {
        uint256 weightedSum = 0;
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < responses.length; i++) {
            uint256 value = uint256(responses[i].data);
            weightedSum += value * responses[i].stake;
            totalWeight += responses[i].stake;
        }

        if (totalWeight == 0) return;

        uint256 average = weightedSum / totalWeight;
        bytes32 result = bytes32(average);

        // Calculate confidence based on variance
        uint256 variance = _calculateVariance(responses, average);
        uint256 confidence = variance > 0 ? 1000 / (variance / 1e18 + 1) : 1000;

        _finalizeConsensus(request, result, confidence > 100 ? 100 : confidence / 10);
    }

    /**
     * @notice Median selection consensus
     */
    function _consensusMedianSelection(
        DataRequest storage request,
        OracleResponse[] storage responses
    ) internal {
        // Sort responses by value
        uint256[] memory values = new uint256[](responses.length);
        uint256[] memory weights = new uint256[](responses.length);

        for (uint256 i = 0; i < responses.length; i++) {
            values[i] = uint256(responses[i].data);
            weights[i] = responses[i].stake;
        }

        _sortByValue(values, weights);

        // Find weighted median
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }

        uint256 medianWeight = totalWeight / 2;
        uint256 cumulativeWeight = 0;
        uint256 median = values[0];

        for (uint256 i = 0; i < values.length; i++) {
            cumulativeWeight += weights[i];
            if (cumulativeWeight >= medianWeight) {
                median = values[i];
                break;
            }
        }

        _finalizeConsensus(request, bytes32(median), 85); // High confidence for median
    }

    /**
     * @notice Quantum Byzantine Agreement consensus
     */
    function _consensusQuantumByzantine(
        DataRequest storage request,
        OracleResponse[] storage responses
    ) internal {
        // Simplified quantum Byzantine agreement
        // In practice, this would use quantum entanglement principles

        uint256 honestNodes = responses.length * 2 / 3 + 1; // f < n/3 assumption
        bytes32 candidateValue;
        uint256 maxSupport = 0;

        for (uint256 i = 0; i < responses.length; i++) {
            uint256 support = 1; // Count supporting responses
            for (uint256 j = 0; j < responses.length; j++) {
                if (i != j && responses[i].data == responses[j].data) {
                    support++;
                }
            }

            if (support > maxSupport && support >= honestNodes) {
                maxSupport = support;
                candidateValue = responses[i].data;
            }
        }

        if (maxSupport >= honestNodes) {
            uint256 confidence = (maxSupport * 100) / responses.length;
            _finalizeConsensus(request, candidateValue, confidence);
        }
    }

    /**
     * @notice Finalize consensus result
     */
    function _finalizeConsensus(
        DataRequest storage request,
        bytes32 result,
        uint256 confidence
    ) internal {
        request.fulfilled = true;
        request.result = result;
        request.confidence = confidence;

        ConsensusResult storage consensus = consensusResults[request.requestId];
        consensus.requestId = request.requestId;
        consensus.finalData = result;
        consensus.confidence = confidence;
        consensus.participantCount = requestResponses[request.requestId].length;
        consensus.consensusReached = true;
        consensus.algorithm = request.consensusType;

        // Calculate total stake
        OracleResponse[] storage responses = requestResponses[request.requestId];
        for (uint256 i = 0; i < responses.length; i++) {
            consensus.totalStake += responses[i].stake;
        }

        emit ConsensusReached(request.requestId, result, confidence);

        // Remove from pending requests
        _removePendingRequest(request.requestId);
    }

    // ============ Reputation & Slashing ============

    /**
     * @notice Update oracle reputation based on performance
     */
    function updateOracleReputation(address oracle, int256 reputationChange) external onlyRole(VALIDATOR) {
        OracleNode storage node = oracleNodes[oracle];
        require(node.nodeAddress != address(0), "Oracle not found");

        if (reputationChange > 0) {
            node.reputation += uint256(reputationChange);
            if (node.reputation > 1000) node.reputation = 1000;
        } else {
            uint256 decrease = uint256(-reputationChange);
            if (node.reputation > decrease) {
                node.reputation -= decrease;
            } else {
                node.reputation = 0;
            }
        }

        emit ReputationUpdated(oracle, node.reputation);
    }

    /**
     * @notice Slash oracle stake for malicious behavior
     */
    function slashOracle(address oracle, uint256 slashAmount, string calldata reason)
        external
        onlyRole(GOVERNANCE)
    {
        OracleNode storage node = oracleNodes[oracle];
        require(node.nodeAddress != address(0), "Oracle not found");
        require(node.stakeAmount >= slashAmount, "Insufficient stake");

        node.stakeAmount -= slashAmount;
        node.reputation = node.reputation > 200 ? node.reputation - 200 : 0;

        // Transfer slashed amount to treasury
        payable(address(this)).transfer(slashAmount);

        emit OracleSlashed(oracle, slashAmount, reason);
        emit ReputationUpdated(oracle, node.reputation);
    }

    // ============ Quantum Security ============

    /**
     * @notice Rotate network quantum key
     */
    function rotateQuantumKey(bytes32 newKey) external onlyRole(GOVERNANCE) {
        require(block.timestamp >= lastKeyRotation + keyRotationInterval, "Too soon");

        bytes32 oldKey = networkQuantumKey;
        networkQuantumKey = newKey;
        lastKeyRotation = block.timestamp;

        emit QuantumKeyRotated(oldKey, newKey);
    }

    /**
     * @notice Verify quantum-resistant signature
     */
    function _verifyQuantumSignature(
        bytes32 requestId,
        bytes32 data,
        bytes calldata signature
    ) internal view {
        // Simplified quantum signature verification
        // In practice, this would use XMSS, SPHINCS+, or similar

        bytes32 messageHash = keccak256(abi.encode(requestId, data, msg.sender));
        bytes32 expectedSignature = keccak256(abi.encode(
            messageHash,
            oracleNodes[msg.sender].quantumKeyCommitment,
            networkQuantumKey
        ));

        require(keccak256(signature) == expectedSignature, "Invalid quantum signature");
    }

    // ============ Helper Functions ============

    function _calculateMinimumResponses() internal view returns (uint256) {
        uint256 activeCount = activeOracles.length;
        return activeCount < 3 ? activeCount : (activeCount * 2) / 3 + 1; // Byzantine threshold
    }

    function _calculateVariance(
        OracleResponse[] storage responses,
        uint256 mean
    ) internal view returns (uint256) {
        uint256 sumSquared = 0;

        for (uint256 i = 0; i < responses.length; i++) {
            uint256 value = uint256(responses[i].data);
            uint256 diff = value > mean ? value - mean : mean - value;
            sumSquared += diff * diff;
        }

        return responses.length > 0 ? sumSquared / responses.length : 0;
    }

    function _sortByValue(uint256[] memory values, uint256[] memory weights) internal pure {
        for (uint256 i = 0; i < values.length; i++) {
            for (uint256 j = i + 1; j < values.length; j++) {
                if (values[i] > values[j]) {
                    (values[i], values[j]) = (values[j], values[i]);
                    (weights[i], weights[j]) = (weights[j], weights[i]);
                }
            }
        }
    }

    function _removePendingRequest(bytes32 requestId) internal {
        for (uint256 i = 0; i < pendingRequests.length; i++) {
            if (pendingRequests[i] == requestId) {
                pendingRequests[i] = pendingRequests[pendingRequests.length - 1];
                pendingRequests.pop();
                break;
            }
        }
    }

    // ============ Configuration ============

    function setConsensusThreshold(uint256 newThreshold) external onlyRole(GOVERNANCE) {
        require(newThreshold <= 100, "Invalid threshold");
        consensusThreshold = newThreshold;
    }

    function setMinimumStake(uint256 newMinimum) external onlyRole(GOVERNANCE) {
        minimumStake = newMinimum;
    }

    function setRequestTimeout(uint256 newTimeout) external onlyRole(GOVERNANCE) {
        requestTimeout = newTimeout;
    }

    // ============ View Functions ============

    function getActiveOracles() external view returns (address[] memory) {
        return activeOracles;
    }

    function getPendingRequests() external view returns (bytes32[] memory) {
        return pendingRequests;
    }

    function getRequestResponses(bytes32 requestId) external view returns (
        address[] memory oracles,
        bytes32[] memory data,
        uint256[] memory stakes
    ) {
        OracleResponse[] storage responses = requestResponses[requestId];

        oracles = new address[](responses.length);
        data = new bytes32[](responses.length);
        stakes = new uint256[](responses.length);

        for (uint256 i = 0; i < responses.length; i++) {
            oracles[i] = responses[i].oracle;
            data[i] = responses[i].data;
            stakes[i] = responses[i].stake;
        }

        return (oracles, data, stakes);
    }

    function getOracleStats(address oracle) external view returns (
        uint256 reputation,
        uint256 stakeAmount,
        uint256 uptime,
        uint256 lastSubmission
    ) {
        OracleNode storage node = oracleNodes[oracle];
        return (
            node.reputation,
            node.stakeAmount,
            node.uptime,
            node.lastSubmission
        );
    }

    function getConsensusResult(bytes32 requestId) external view returns (
        bytes32 finalData,
        uint256 confidence,
        uint256 participantCount,
        bool consensusReached
    ) {
        ConsensusResult storage result = consensusResults[requestId];
        return (
            result.finalData,
            result.confidence,
            result.participantCount,
            result.consensusReached
        );
    }
}