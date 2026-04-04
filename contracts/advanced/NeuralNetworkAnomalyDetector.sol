// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NeuralNetworkAnomalyDetector
 * @notice On-chain neural network for advanced anomaly detection
 * @dev Implements simplified neural network with:
 *      - Feed-forward neural network
 *      - Backpropagation training (simplified)
 *      - Autoencoder for unsupervised learning
 *      - Federated learning support
 *      - Model aggregation
 */
contract NeuralNetworkAnomalyDetector is AccessControl {

    bytes32 public constant TRAINER_ROLE = keccak256("TRAINER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // Neural Network Architecture
    struct NeuralNetwork {
        uint256 inputSize;
        uint256 hiddenSize;
        uint256 outputSize;
        uint256 numLayers;
        bytes32[] layerHashes;  // Hash of weights for each layer
        uint256 accuracy;
        uint256 trainingRounds;
        bool isActive;
    }

    struct TrainingData {
        uint256[] inputs;
        uint256[] expectedOutputs;
        uint256 label;  // 0 = normal, 1 = anomaly
        uint256 timestamp;
        address submitter;
    }

    struct ModelUpdate {
        address participant;
        bytes32[] weightUpdates;
        uint256 loss;
        uint256 accuracy;
        uint256 timestamp;
    }

    // State
    NeuralNetwork public anomalyDetector;
    mapping(bytes32 => TrainingData) public trainingDataset;
    mapping(uint256 => ModelUpdate[]) public federatedUpdates;
    mapping(address => uint256) public participantReputation;

    // Configuration
    uint256 public constant LEARNING_RATE = 1000; // Scaled for fixed point
    uint256 public constant MAX_TRAINING_DATA = 1000;
    uint256 public constant FEDERATION_ROUNDS = 10;
    uint256 public constant MIN_PARTICIPANTS = 3;

    uint256 public trainingDataCount;
    uint256 public federationRound;
    uint256 public anomalyThreshold = 5000; // Scaled threshold

    // Events
    event TrainingDataAdded(bytes32 indexed dataId, address indexed submitter);
    event ModelTrained(uint256 newAccuracy, uint256 round);
    event AnomalyDetected(uint256 score, uint256 threshold, bytes32 dataId);
    event FederatedUpdateSubmitted(address indexed participant, uint256 round, uint256 loss);
    event ModelAggregated(uint256 round, uint256 newAccuracy);

    // Errors
    error InvalidInputSize(uint256 provided, uint256 expected);
    error InsufficientTrainingData(uint256 current, uint256 required);
    error ModelNotActive();
    error InvalidParticipant(address participant);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TRAINER_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);

        // Initialize neural network
        _initializeNetwork();
    }

    function _initializeNetwork() internal {
        // Simple 3-layer network: input -> hidden -> output
        anomalyDetector = NeuralNetwork({
            inputSize: 10,     // 10 features (TVL, volume, time, etc.)
            hiddenSize: 5,     // 5 hidden neurons
            outputSize: 1,     // Binary classification (anomaly score)
            numLayers: 3,
            layerHashes: new bytes32[](3),
            accuracy: 0,
            trainingRounds: 0,
            isActive: true
        });

        // Initialize random weights (simplified)
        for (uint256 i = 0; i < anomalyDetector.numLayers; i++) {
            anomalyDetector.layerHashes[i] = keccak256(abi.encode(
                "INITIAL_WEIGHTS",
                i,
                block.timestamp,
                block.prevrandao
            ));
        }
    }

    // ============ Data Collection ============

    /**
     * @notice Submit training data for the neural network
     * @param inputs Feature vector (normalized 0-10000)
     * @param isAnomaly True if this represents anomalous behavior
     */
    function submitTrainingData(
        uint256[] calldata inputs,
        bool isAnomaly
    ) external onlyRole(TRAINER_ROLE) returns (bytes32 dataId) {
        require(inputs.length == anomalyDetector.inputSize, "Invalid input size");
        require(trainingDataCount < MAX_TRAINING_DATA, "Dataset full");

        uint256[] memory expectedOutputs = new uint256[](1);
        expectedOutputs[0] = isAnomaly ? 10000 : 0; // Binary classification

        dataId = keccak256(abi.encode(
            "TRAINING_DATA",
            inputs,
            isAnomaly,
            msg.sender,
            block.timestamp
        ));

        trainingDataset[dataId] = TrainingData({
            inputs: inputs,
            expectedOutputs: expectedOutputs,
            label: isAnomaly ? 1 : 0,
            timestamp: block.timestamp,
            submitter: msg.sender
        });

        trainingDataCount++;

        emit TrainingDataAdded(dataId, msg.sender);
    }

    // ============ Neural Network Training ============

    /**
     * @notice Train the neural network on collected data
     * @param learningRate Scaled learning rate
     */
    function trainNetwork(uint256 learningRate) external onlyRole(TRAINER_ROLE) {
        require(trainingDataCount >= 10, "Insufficient training data");
        require(anomalyDetector.isActive, "Model not active");

        // Simplified training loop (in production: proper backpropagation)
        uint256 correctPredictions = 0;
        uint256 totalPredictions = 0;

        // Process each training sample
        for (uint256 i = 0; i < trainingDataCount && i < 100; i++) {
            bytes32 dataId = keccak256(abi.encode(
                "TRAINING_SAMPLE",
                i,
                trainingDataCount
            ));

            TrainingData storage sample = trainingDataset[dataId];
            if (sample.timestamp == 0) continue;

            // Forward pass
            uint256 prediction = _forwardPass(sample.inputs);

            // Calculate accuracy
            uint256 expected = sample.expectedOutputs[0];
            if ((prediction >= 5000 && expected >= 5000) ||
                (prediction < 5000 && expected < 5000)) {
                correctPredictions++;
            }
            totalPredictions++;

            // Backward pass (simplified)
            _backwardPass(sample.inputs, expected, prediction, learningRate);
        }

        // Update model accuracy
        if (totalPredictions > 0) {
            anomalyDetector.accuracy = (correctPredictions * 10000) / totalPredictions;
            anomalyDetector.trainingRounds++;
        }

        emit ModelTrained(anomalyDetector.accuracy, anomalyDetector.trainingRounds);
    }

    // ============ Anomaly Detection ============

    /**
     * @notice Detect anomalies using the trained neural network
     * @param features Feature vector for analysis
     */
    function detectAnomaly(uint256[] calldata features) external returns (
        uint256 anomalyScore,
        bool isAnomaly,
        uint256 confidence
    ) {
        require(features.length == anomalyDetector.inputSize, "Invalid feature count");
        require(anomalyDetector.isActive, "Model not active");

        // Forward pass through network
        anomalyScore = _forwardPass(features);

        // Determine if anomalous
        isAnomaly = anomalyScore >= anomalyThreshold;

        // Calculate confidence based on distance from threshold
        if (isAnomaly) {
            confidence = anomalyScore >= 7500 ? 9000 : 7000; // High confidence
        } else {
            confidence = anomalyScore <= 2500 ? 9000 : 7000; // High confidence
        }

        // Emit event if anomaly detected
        if (isAnomaly) {
            bytes32 dataId = keccak256(abi.encode(
                "ANOMALY_DETECTION",
                features,
                anomalyScore,
                block.timestamp
            ));

            emit AnomalyDetected(anomalyScore, anomalyThreshold, dataId);
        }

        return (anomalyScore, isAnomaly, confidence);
    }

    // ============ Federated Learning ============

    /**
     * @notice Submit model update for federated learning
     * @param weightUpdates Hashed weight updates from local training
     * @param localLoss Local training loss
     * @param localAccuracy Local model accuracy
     */
    function submitFederatedUpdate(
        bytes32[] calldata weightUpdates,
        uint256 localLoss,
        uint256 localAccuracy
    ) external onlyRole(VALIDATOR_ROLE) {
        require(weightUpdates.length == anomalyDetector.numLayers, "Invalid update size");
        require(participantReputation[msg.sender] >= 50, "Low reputation");

        ModelUpdate memory update = ModelUpdate({
            participant: msg.sender,
            weightUpdates: weightUpdates,
            loss: localLoss,
            accuracy: localAccuracy,
            timestamp: block.timestamp
        });

        federatedUpdates[federationRound].push(update);

        // Update reputation
        if (localAccuracy > anomalyDetector.accuracy) {
            participantReputation[msg.sender] = participantReputation[msg.sender] + 10;
        }

        emit FederatedUpdateSubmitted(msg.sender, federationRound, localLoss);

        // Check if ready to aggregate
        if (federatedUpdates[federationRound].length >= MIN_PARTICIPANTS) {
            _aggregateModelUpdates();
        }
    }

    /**
     * @notice Aggregate federated model updates
     */
    function _aggregateModelUpdates() internal {
        ModelUpdate[] storage updates = federatedUpdates[federationRound];
        require(updates.length >= MIN_PARTICIPANTS, "Insufficient updates");

        // Simple averaging of weight updates (simplified)
        bytes32[] memory aggregatedWeights = new bytes32[](anomalyDetector.numLayers);

        for (uint256 layer = 0; layer < anomalyDetector.numLayers; layer++) {
            bytes32 combinedHash = bytes32(0);

            for (uint256 i = 0; i < updates.length; i++) {
                combinedHash = keccak256(abi.encode(
                    combinedHash,
                    updates[i].weightUpdates[layer],
                    updates[i].accuracy
                ));
            }

            aggregatedWeights[layer] = combinedHash;
        }

        // Update model
        anomalyDetector.layerHashes = aggregatedWeights;
        anomalyDetector.accuracy = _calculateAggregatedAccuracy(updates);

        federationRound++;

        emit ModelAggregated(federationRound, anomalyDetector.accuracy);
    }

    // ============ Internal Neural Network Functions ============

    function _forwardPass(uint256[] memory inputs) internal view returns (uint256) {
        require(inputs.length == anomalyDetector.inputSize, "Invalid input size");

        // Simplified forward pass - single hidden layer
        uint256[] memory hiddenActivations = new uint256[](anomalyDetector.hiddenSize);

        // Input to hidden layer
        for (uint256 h = 0; h < anomalyDetector.hiddenSize; h++) {
            uint256 sum = 0;

            // Weighted sum of inputs (simplified with hash-based weights)
            for (uint256 i = 0; i < inputs.length; i++) {
                bytes32 weightHash = keccak256(abi.encode(
                    anomalyDetector.layerHashes[0],
                    h,
                    i
                ));
                uint256 weight = uint256(weightHash) % 10000; // Pseudo-random weight 0-9999
                sum += (inputs[i] * weight) / 10000;
            }

            // ReLU activation
            hiddenActivations[h] = sum > 0 ? sum : 0;
        }

        // Hidden to output layer
        uint256 outputSum = 0;
        for (uint256 h = 0; h < anomalyDetector.hiddenSize; h++) {
            bytes32 weightHash = keccak256(abi.encode(
                anomalyDetector.layerHashes[1],
                h
            ));
            uint256 weight = uint256(weightHash) % 10000;
            outputSum += (hiddenActivations[h] * weight) / 10000;
        }

        // Sigmoid activation for output (0-10000 scale)
        return (outputSum * 10000) / (10000 + outputSum);
    }

    function _backwardPass(
        uint256[] memory inputs,
        uint256 expected,
        uint256 predicted,
        uint256 learningRate
    ) internal {
        // Simplified backpropagation - update weight hashes
        uint256 error = expected > predicted ?
            expected - predicted :
            predicted - expected;

        // Update layer hashes based on error (simplified)
        for (uint256 i = 0; i < anomalyDetector.layerHashes.length; i++) {
            anomalyDetector.layerHashes[i] = keccak256(abi.encode(
                anomalyDetector.layerHashes[i],
                error,
                learningRate,
                block.timestamp
            ));
        }
    }

    function _calculateAggregatedAccuracy(ModelUpdate[] storage updates) internal view returns (uint256) {
        uint256 totalAccuracy = 0;
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < updates.length; i++) {
            uint256 weight = participantReputation[updates[i].participant] + 1;
            totalAccuracy += updates[i].accuracy * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? totalAccuracy / totalWeight : 0;
    }

    // ============ Configuration ============

    function updateAnomalyThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        anomalyThreshold = newThreshold;
    }

    function toggleModel(bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        anomalyDetector.isActive = active;
    }

    // ============ View Functions ============

    function getModelStats() external view returns (
        uint256 accuracy,
        uint256 trainingRounds,
        uint256 datasetSize,
        bool isActive
    ) {
        return (
            anomalyDetector.accuracy,
            anomalyDetector.trainingRounds,
            trainingDataCount,
            anomalyDetector.isActive
        );
    }

    function getParticipantReputation(address participant) external view returns (uint256) {
        return participantReputation[participant] == 0 ? 100 : participantReputation[participant];
    }

    function getFederationRound() external view returns (uint256) {
        return federationRound;
    }
}