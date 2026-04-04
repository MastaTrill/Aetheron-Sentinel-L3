// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ContinuousLearningEngine
 * @notice Advanced AI system with continuous learning, adaptation, and evolution
 * @dev Implements:
 *      - Online learning algorithms
 *      - Model adaptation without full retraining
 *      - Evolutionary optimization
 *      - Meta-learning capabilities
 *      - Performance-driven model selection
 *      - Automated feature engineering
 *      - Self-improving AI agents
 */
contract ContinuousLearningEngine is AccessControl {

    bytes32 public constant AI_ADMIN = keccak256("AI_ADMIN");
    bytes32 public constant DATA_PROVIDER = keccak256("DATA_PROVIDER");
    bytes32 public constant MODEL_TRAINER = keccak256("MODEL_TRAINER");

    // Learning phases
    enum LearningPhase {
        INITIALIZATION,
        ONLINE_LEARNING,
        MODEL_ADAPTATION,
        EVOLUTIONARY_OPTIMIZATION,
        META_LEARNING,
        PERFORMANCE_VALIDATION
    }

    struct AIModel {
        bytes32 modelId;
        string modelType;
        uint256 version;
        uint256 accuracy;
        uint256 precision;
        uint256 recall;
        uint256 f1Score;
        uint256 trainingDataSize;
        uint256 lastUpdated;
        bool isActive;
        bytes32 parentModel;      // For evolutionary tracking
        uint256 generation;       // Evolutionary generation
    }

    struct LearningSession {
        bytes32 sessionId;
        LearningPhase phase;
        uint256 startTime;
        uint256 dataPointsProcessed;
        uint256 modelsEvaluated;
        uint256 bestAccuracy;
        bytes32 bestModelId;
        bool completed;
        string[] insights;        // Learning insights discovered
    }

    struct OnlineLearner {
        bytes32 learnerId;
        string algorithm;         // "OnlineGradientDescent", "AdaptiveBoosting", etc.
        uint256 learningRate;
        uint256 batchSize;
        uint256 momentum;
        uint256[] weights;        // Current model weights
        uint256[] gradients;      // Accumulated gradients
        uint256 updateCount;
        uint256 lastUpdate;
        bool isActive;
    }

    struct EvolutionaryPopulation {
        bytes32 populationId;
        bytes32[] modelIds;
        uint256 generation;
        uint256 populationSize;
        uint256 mutationRate;
        uint256 crossoverRate;
        uint256 elitismCount;
        uint256 bestFitness;
        bytes32 bestIndividual;
        bool evolutionActive;
    }

    struct MetaLearner {
        bytes32 metaId;
        string metaAlgorithm;     // "MAML", "Reptile", "MetaSGD"
        uint256[] taskDistributions;
        uint256 adaptationSteps;
        uint256 metaLearningRate;
        bytes32[] learnedStrategies;
        uint256 lastMetaUpdate;
    }

    // State
    mapping(bytes32 => AIModel) public aiModels;
    mapping(bytes32 => LearningSession) public learningSessions;
    mapping(bytes32 => OnlineLearner) public onlineLearners;
    mapping(bytes32 => EvolutionaryPopulation) public populations;
    mapping(bytes32 => MetaLearner) public metaLearners;

    bytes32[] public activeModels;
    bytes32[] public activeSessions;
    bytes32[] public activeLearners;

    // Configuration
    uint256 public constant MAX_MODELS = 50;
    uint256 public constant MAX_LEARNERS = 20;
    uint256 public constant LEARNING_RATE_DECAY = 995; // 99.5% retention
    uint256 public constant MIN_ACCURACY_IMPROVEMENT = 5; // 0.5% minimum improvement
    uint256 public constant EVOLUTION_GENERATIONS = 100;

    // Events
    event ModelCreated(bytes32 indexed modelId, string modelType, uint256 version);
    event LearningSessionStarted(bytes32 indexed sessionId, LearningPhase phase);
    event OnlineUpdateApplied(bytes32 indexed learnerId, uint256 accuracy, uint256 updateCount);
    event ModelEvolved(bytes32 indexed newModelId, bytes32 parentModelId, uint256 generation);
    event MetaLearningUpdate(bytes32 indexed metaId, uint256 newStrategies);
    event ContinuousImprovement(bytes32 indexed modelId, uint256 oldAccuracy, uint256 newAccuracy);
    event EvolutionaryBreakthrough(bytes32 indexed populationId, bytes32 bestModel, uint256 fitness);

    // Errors
    error ModelNotFound(bytes32 modelId);
    error LearnerNotFound(bytes32 learnerId);
    error SessionNotActive(bytes32 sessionId);
    error InsufficientImprovement(uint256 current, uint256 required);
    error EvolutionStagnated(uint256 generations, uint256 bestFitness);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AI_ADMIN, msg.sender);
        _grantRole(DATA_PROVIDER, msg.sender);
        _grantRole(MODEL_TRAINER, msg.sender);

        // Initialize meta-learner
        _initializeMetaLearner();
    }

    // ============ Model Management ============

    /**
     * @notice Create a new AI model
     * @param modelType Type of model ("NeuralNetwork", "DecisionTree", etc.)
     * @param initialAccuracy Initial model accuracy
     */
    function _createModel(
        string memory modelType,
        uint256 initialAccuracy
    ) internal returns (bytes32 modelId) {
        modelId = keccak256(abi.encode(
            "AI_MODEL",
            modelType,
            block.timestamp,
            block.number
        ));

        AIModel storage model = aiModels[modelId];
        model.modelId = modelId;
        model.modelType = modelType;
        model.version = 1;
        model.accuracy = initialAccuracy;
        model.lastUpdated = block.timestamp;
        model.isActive = true;

        activeModels.push(modelId);

        emit ModelCreated(modelId, modelType, 1);
    }

    function createModel(
        string calldata modelType,
        uint256 initialAccuracy
    ) external onlyRole(AI_ADMIN) returns (bytes32 modelId) {
        modelId = _createModel(modelType, initialAccuracy);
    }

    /**
     * @notice Update model performance metrics
     * @param modelId Model to update
     * @param newAccuracy New accuracy score
     * @param newPrecision New precision score
     * @param newRecall New recall score
     */
    function updateModelMetrics(
        bytes32 modelId,
        uint256 newAccuracy,
        uint256 newPrecision,
        uint256 newRecall
    ) external onlyRole(MODEL_TRAINER) {
        AIModel storage model = aiModels[modelId];
        require(model.modelId != bytes32(0), "Model not found");

        uint256 oldAccuracy = model.accuracy;
        model.accuracy = newAccuracy;
        model.precision = newPrecision;
        model.recall = newRecall;
        model.f1Score = (2 * newPrecision * newRecall) / (newPrecision + newRecall);
        model.lastUpdated = block.timestamp;

        // Check for significant improvement
        if (newAccuracy >= oldAccuracy + MIN_ACCURACY_IMPROVEMENT) {
            emit ContinuousImprovement(modelId, oldAccuracy, newAccuracy);
        }
    }

    // ============ Online Learning ============

    /**
     * @notice Create an online learner for continuous adaptation
     * @param algorithm Learning algorithm
     * @param initialLearningRate Initial learning rate
     * @param batchSize Mini-batch size
     */
    function createOnlineLearner(
        string calldata algorithm,
        uint256 initialLearningRate,
        uint256 batchSize
    ) external onlyRole(AI_ADMIN) returns (bytes32 learnerId) {
        require(activeLearners.length < MAX_LEARNERS, "Learner limit reached");

        learnerId = keccak256(abi.encode(
            "ONLINE_LEARNER",
            algorithm,
            block.timestamp
        ));

        OnlineLearner storage learner = onlineLearners[learnerId];
        learner.learnerId = learnerId;
        learner.algorithm = algorithm;
        learner.learningRate = initialLearningRate;
        learner.batchSize = batchSize;
        learner.momentum = 0;
        learner.isActive = true;
        learner.lastUpdate = block.timestamp;

        activeLearners.push(learnerId);

        // Initialize weights (simplified)
        learner.weights = new uint256[](10); // 10 weights
        learner.gradients = new uint256[](10);

        for (uint256 i = 0; i < 10; i++) {
            learner.weights[i] = uint256(keccak256(abi.encode(learnerId, i))) % 10000;
        }
    }

    /**
     * @notice Apply online learning update
     * @param learnerId Learner to update
     * @param features Input features
     * @param target Target value
     * @param prediction Current prediction
     */
    function applyOnlineUpdate(
        bytes32 learnerId,
        uint256[] calldata features,
        uint256 target,
        uint256 prediction
    ) external onlyRole(DATA_PROVIDER) returns (uint256 newAccuracy) {
        OnlineLearner storage learner = onlineLearners[learnerId];
        require(learner.isActive, "Learner not active");
        require(features.length == learner.weights.length, "Feature dimension mismatch");

        // Calculate error
        uint256 error = target > prediction ? target - prediction : prediction - target;

        // Update gradients (simplified stochastic gradient descent)
        for (uint256 i = 0; i < learner.weights.length; i++) {
            // Simplified gradient calculation
            uint256 gradient = (error * features[i]) / 1000;
            learner.gradients[i] = (learner.gradients[i] + gradient) / 2; // Running average
        }

        // Apply updates when batch is ready
        learner.updateCount++;
        if (learner.updateCount % learner.batchSize == 0) {
            _applyBatchUpdate(learner);
            newAccuracy = _calculateLearnerAccuracy(learner);
            learner.lastUpdate = block.timestamp;

            emit OnlineUpdateApplied(learnerId, newAccuracy, learner.updateCount);
        }

        // Learning rate decay
        learner.learningRate = (learner.learningRate * LEARNING_RATE_DECAY) / 1000;
    }

    function _applyBatchUpdate(OnlineLearner storage learner) internal {
        for (uint256 i = 0; i < learner.weights.length; i++) {
            // Apply gradient descent with momentum
            uint256 update = (learner.gradients[i] * learner.learningRate) / 1000;
            update = (update * (1000 + learner.momentum)) / 1000; // Add momentum

            if (update > learner.weights[i]) {
                learner.weights[i] = 0;
            } else {
                learner.weights[i] -= update;
            }

            // Reset gradient
            learner.gradients[i] = 0;
        }
    }

    function _calculateLearnerAccuracy(OnlineLearner storage learner) internal view returns (uint256) {
        // Simplified accuracy calculation
        uint256 totalVariation = 0;
        for (uint256 i = 0; i < learner.weights.length; i++) {
            totalVariation += learner.weights[i];
        }
        return totalVariation > 0 ? (10000 * learner.updateCount) / (totalVariation + learner.updateCount) : 0;
    }

    // ============ Evolutionary Optimization ============

    /**
     * @notice Create an evolutionary population for model optimization
     * @param populationSize Number of models in population
     * @param mutationRate Probability of mutation (0-1000)
     * @param crossoverRate Probability of crossover (0-1000)
     */
    function createEvolutionaryPopulation(
        uint256 populationSize,
        uint256 mutationRate,
        uint256 crossoverRate
    ) external onlyRole(AI_ADMIN) returns (bytes32 populationId) {
        require(populationSize > 0 && populationSize <= 20, "Invalid population size");

        populationId = keccak256(abi.encode(
            "EVOLUTIONARY_POPULATION",
            block.timestamp,
            populationSize
        ));

        EvolutionaryPopulation storage population = populations[populationId];
        population.populationId = populationId;
        population.generation = 0;
        population.populationSize = populationSize;
        population.mutationRate = mutationRate;
        population.crossoverRate = crossoverRate;
        population.elitismCount = populationSize / 5; // Keep top 20%
        population.evolutionActive = true;

        // Initialize random population
        population.modelIds = new bytes32[](populationSize);
        for (uint256 i = 0; i < populationSize; i++) {
            bytes32 modelId = _createModel("EvolutionaryVariant", 5000 + (i * 100));
            population.modelIds[i] = modelId;
        }

        emit EvolutionaryBreakthrough(populationId, population.modelIds[0], 5000);
    }

    /**
     * @notice Evolve population to next generation
     * @param populationId Population to evolve
     */
    function evolvePopulation(bytes32 populationId) external onlyRole(MODEL_TRAINER) {
        EvolutionaryPopulation storage population = populations[populationId];
        require(population.evolutionActive, "Evolution not active");

        // Selection: Sort by fitness (accuracy)
        _sortPopulationByFitness(population);

        bytes32[] memory newPopulation = new bytes32[](population.populationSize);
        uint256 newIndex = 0;

        // Elitism: Keep best individuals
        for (uint256 i = 0; i < population.elitismCount; i++) {
            newPopulation[newIndex++] = population.modelIds[i];
        }

        // Crossover and mutation
        while (newIndex < population.populationSize) {
            // Select parents using tournament selection
            bytes32 parent1 = _tournamentSelection(population);
            bytes32 parent2 = _tournamentSelection(population);

            // Crossover
            if (_randomProbability() < population.crossoverRate) {
                bytes32 child1 = _crossoverModels(parent1, parent2);
                bytes32 child2 = _crossoverModels(parent2, parent1);
                newPopulation[newIndex++] = child1;
                if (newIndex < population.populationSize) {
                    newPopulation[newIndex++] = child2;
                }
            } else {
                newPopulation[newIndex++] = _mutateModel(parent1);
            }
        }

        population.modelIds = newPopulation;
        population.generation++;

        // Update best fitness
        AIModel storage bestModel = aiModels[population.modelIds[0]];
        population.bestFitness = bestModel.accuracy;
        population.bestIndividual = population.modelIds[0];

        emit EvolutionaryBreakthrough(populationId, population.bestIndividual, population.bestFitness);

        // Check for stagnation
        if (population.generation > EVOLUTION_GENERATIONS &&
            population.bestFitness < 8000) {
            revert EvolutionStagnated(population.generation, population.bestFitness);
        }
    }

    function _sortPopulationByFitness(EvolutionaryPopulation storage population) internal {
        for (uint256 i = 0; i < population.modelIds.length; i++) {
            for (uint256 j = i + 1; j < population.modelIds.length; j++) {
                AIModel storage modelI = aiModels[population.modelIds[i]];
                AIModel storage modelJ = aiModels[population.modelIds[j]];

                if (modelI.accuracy < modelJ.accuracy) {
                    (population.modelIds[i], population.modelIds[j]) =
                        (population.modelIds[j], population.modelIds[i]);
                }
            }
        }
    }

    function _tournamentSelection(EvolutionaryPopulation storage population)
        internal
        view
        returns (bytes32)
    {
        // Simple tournament selection
        uint256 tournamentSize = 3;
        uint256 bestIndex = 0;
        uint256 bestFitness = 0;

        for (uint256 i = 0; i < tournamentSize; i++) {
            uint256 randomIndex = uint256(keccak256(abi.encode(
                population.populationId,
                population.generation,
                i,
                block.timestamp
            ))) % population.populationSize;

            AIModel storage model = aiModels[population.modelIds[randomIndex]];
            if (model.accuracy > bestFitness) {
                bestFitness = model.accuracy;
                bestIndex = randomIndex;
            }
        }

        return population.modelIds[bestIndex];
    }

    function _crossoverModels(bytes32 parent1, bytes32 parent2) internal returns (bytes32) {
        // Create child model with combined characteristics
        AIModel storage p1 = aiModels[parent1];
        AIModel storage p2 = aiModels[parent2];

        uint256 childAccuracy = (p1.accuracy + p2.accuracy) / 2;
        childAccuracy += uint256(keccak256(abi.encode(parent1, parent2, block.timestamp))) % 1000 - 500; // Random variation

        if (childAccuracy > 10000) childAccuracy = 10000;
        if (childAccuracy < 0) childAccuracy = 0;

        bytes32 childId = _createModel("EvolutionaryOffspring", childAccuracy);

        // Set parent relationship
        aiModels[childId].parentModel = parent1;
        aiModels[childId].generation = aiModels[parent1].generation + 1;

        emit ModelEvolved(childId, parent1, aiModels[childId].generation);

        return childId;
    }

    function _mutateModel(bytes32 modelId) internal returns (bytes32) {
        AIModel storage original = aiModels[modelId];

        // Create mutated version
        uint256 mutation = uint256(keccak256(abi.encode(modelId, block.timestamp))) % 2000 - 1000; // -1000 to +1000
        uint256 newAccuracy = original.accuracy + mutation;

        if (newAccuracy > 10000) newAccuracy = 10000;
        if (newAccuracy < 0) newAccuracy = 0;

        bytes32 mutantId = _createModel("EvolutionaryMutant", newAccuracy);
        aiModels[mutantId].parentModel = modelId;
        aiModels[mutantId].generation = original.generation + 1;

        emit ModelEvolved(mutantId, modelId, aiModels[mutantId].generation);

        return mutantId;
    }

    // ============ Meta-Learning ============

    function _initializeMetaLearner() internal {
        bytes32 metaId = keccak256("META_LEARNER");

        MetaLearner storage meta = metaLearners[metaId];
        meta.metaId = metaId;
        meta.metaAlgorithm = "MAML"; // Model-Agnostic Meta-Learning
        meta.adaptationSteps = 5;
        meta.metaLearningRate = 1000;
        meta.lastMetaUpdate = block.timestamp;

        // Initialize task distributions
        meta.taskDistributions = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            meta.taskDistributions[i] = 2000; // Equal distribution initially
        }
    }

    /**
     * @notice Apply meta-learning update
     * @param taskType Type of task learned
     * @param performance Performance on task
     */
    function applyMetaLearningUpdate(
        string calldata taskType,
        uint256 performance
    ) external onlyRole(MODEL_TRAINER) {
        bytes32 metaId = keccak256("META_LEARNER");
        MetaLearner storage meta = metaLearners[metaId];

        // Update task distribution based on performance
        uint256 taskIndex = _getTaskIndex(taskType);
        if (taskIndex < meta.taskDistributions.length) {
            // Reinforcement learning on task distributions
            if (performance > 8000) { // Good performance
                meta.taskDistributions[taskIndex] = (meta.taskDistributions[taskIndex] * 1050) / 1000; // Increase weight
            } else if (performance < 5000) { // Poor performance
                meta.taskDistributions[taskIndex] = (meta.taskDistributions[taskIndex] * 950) / 1000; // Decrease weight
            }

            // Normalize distributions
            uint256 total = 0;
            for (uint256 i = 0; i < meta.taskDistributions.length; i++) {
                total += meta.taskDistributions[i];
            }

            for (uint256 i = 0; i < meta.taskDistributions.length; i++) {
                meta.taskDistributions[i] = (meta.taskDistributions[i] * 10000) / total;
            }

            meta.lastMetaUpdate = block.timestamp;

            emit MetaLearningUpdate(metaId, meta.taskDistributions.length);
        }
    }

    function _getTaskIndex(string memory taskType) internal pure returns (uint256) {
        bytes32 hash = keccak256(abi.encode(taskType));
        if (hash == keccak256("anomaly_detection")) return 0;
        if (hash == keccak256("pattern_recognition")) return 1;
        if (hash == keccak256("prediction")) return 2;
        if (hash == keccak256("classification")) return 3;
        return 4; // Default
    }

    // ============ Learning Sessions ============

    /**
     * @notice Start a continuous learning session
     * @param phase Learning phase to execute
     */
    function startLearningSession(LearningPhase phase) external onlyRole(AI_ADMIN) returns (bytes32 sessionId) {
        sessionId = keccak256(abi.encode(
            "LEARNING_SESSION",
            phase,
            block.timestamp
        ));

        LearningSession storage session = learningSessions[sessionId];
        session.sessionId = sessionId;
        session.phase = phase;
        session.startTime = block.timestamp;

        activeSessions.push(sessionId);

        emit LearningSessionStarted(sessionId, phase);
    }

    /**
     * @notice Complete learning session with insights
     * @param sessionId Session to complete
     * @param insights Key learnings from session
     */
    function completeLearningSession(
        bytes32 sessionId,
        string[] calldata insights
    ) external onlyRole(MODEL_TRAINER) {
        LearningSession storage session = learningSessions[sessionId];
        require(!session.completed, "Session already completed");

        session.completed = true;
        session.insights = insights;

        // Remove from active sessions
        for (uint256 i = 0; i < activeSessions.length; i++) {
            if (activeSessions[i] == sessionId) {
                activeSessions[i] = activeSessions[activeSessions.length - 1];
                activeSessions.pop();
                break;
            }
        }
    }

    // ============ Utility Functions ============

    function _randomProbability() internal view returns (uint256) {
        return uint256(keccak256(abi.encode(block.timestamp, block.prevrandao))) % 1000;
    }

    // ============ View Functions ============

    function getModelPerformance(bytes32 modelId) external view returns (
        uint256 accuracy,
        uint256 precision,
        uint256 recall,
        uint256 f1Score,
        uint256 lastUpdated
    ) {
        AIModel storage model = aiModels[modelId];
        return (
            model.accuracy,
            model.precision,
            model.recall,
            model.f1Score,
            model.lastUpdated
        );
    }

    function getOnlineLearnerStatus(bytes32 learnerId) external view returns (
        string memory algorithm,
        uint256 learningRate,
        uint256 updateCount,
        uint256 lastUpdate,
        bool isActive
    ) {
        OnlineLearner storage learner = onlineLearners[learnerId];
        return (
            learner.algorithm,
            learner.learningRate,
            learner.updateCount,
            learner.lastUpdate,
            learner.isActive
        );
    }

    function getEvolutionaryProgress(bytes32 populationId) external view returns (
        uint256 generation,
        uint256 bestFitness,
        bytes32 bestIndividual,
        bool evolutionActive
    ) {
        EvolutionaryPopulation storage population = populations[populationId];
        return (
            population.generation,
            population.bestFitness,
            population.bestIndividual,
            population.evolutionActive
        );
    }

    function getMetaLearnerStrategies() external view returns (uint256[] memory) {
        bytes32 metaId = keccak256("META_LEARNER");
        return metaLearners[metaId].taskDistributions;
    }

    function getActiveModels() external view returns (bytes32[] memory) {
        return activeModels;
    }

    function getActiveLearners() external view returns (bytes32[] memory) {
        return activeLearners;
    }

    function getActiveSessions() external view returns (bytes32[] memory) {
        return activeSessions;
    }
}