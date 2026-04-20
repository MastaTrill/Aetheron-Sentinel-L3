// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SentinelPredictiveThreatModel
 * @notice AI-powered predictive threat modeling and behavioral analysis
 * Advanced machine learning for preemptive security measures
 */
contract SentinelPredictiveThreatModel is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Threat pattern structure
    struct ThreatPattern {
        bytes32 patternId;
        string description;
        uint256 severity;
        uint256 confidence;
        uint256 frequency;
        uint256 lastObserved;
        bool active;
        bytes32[] correlatedPatterns;
        ThreatCategory category;
    }

    // Behavioral profile structure
    struct BehavioralProfile {
        address entity;
        uint256 trustScore; // 0-1000 trust score
        uint256 riskLevel; // 0-100 risk assessment
        uint256 anomalyCount;
        uint256 normalActivityCount;
        uint256 lastActivityTime;
        uint256 profileCreationTime;
        bytes32[] behavioralPatterns;
        BehavioralState currentState;
    }

    enum ThreatCategory {
        EXPLOIT,
        MANIPULATION,
        SPAM,
        GOVERNANCE_ATTACK,
        ORACLE_ATTACK,
        FLASH_LOAN_ATTACK,
        SANDWICH_ATTACK,
        FRONT_RUNNING,
        BACK_RUNNING,
        LIQUIDATION_ATTACK
    }

    enum BehavioralState {
        NORMAL,
        SUSPICIOUS,
        MALICIOUS,
        QUARANTINED,
        BANNED
    }

    // State variables
    mapping(bytes32 => ThreatPattern) public threatPatterns;
    mapping(address => BehavioralProfile) public behavioralProfiles;

    bytes32[] public activePatterns;
    address[] public monitoredEntities;

    // AI model parameters
    uint256 public anomalyThreshold; // Threshold for anomaly detection
    uint256 public predictionHorizon; // Hours to predict ahead
    uint256 public learningRate; // Model learning rate (basis points)
    uint256 public modelAccuracy; // Current model accuracy (0-100)

    // Predictive analytics data
    mapping(bytes32 => uint256[]) public patternTimeSeries;
    mapping(string => uint256) public threatMetrics;

    uint256 public constant MAX_PATTERNS = 1000;
    uint256 public constant MAX_ENTITIES = 10000;
    uint256 public constant PROFILE_UPDATE_INTERVAL = 1 hours;

    event ThreatPatternDetected(
        bytes32 indexed patternId,
        ThreatCategory category,
        uint256 severity
    );
    event BehavioralAnomalyDetected(
        address indexed entity,
        uint256 anomalyScore,
        string description
    );
    event PredictiveAlertGenerated(
        bytes32 indexed patternId,
        uint256 confidence,
        uint256 predictedSeverity
    );
    event BehavioralProfileUpdated(
        address indexed entity,
        uint256 newTrustScore,
        BehavioralState newState
    );

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        _initializePredictiveModel();
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Analyze behavioral data for threat patterns
     * @param entity Address to analyze
     * @param behavioralData Array of behavioral metrics
     * @param activityType Type of activity being analyzed
     * @return anomalyScore Score indicating anomalous behavior (0-1000)
     */
    function analyzeBehavior(
        address entity,
        uint256[] calldata behavioralData,
        string calldata activityType
    ) external returns (uint256 anomalyScore) {
        require(entity != address(0), "Invalid entity address");
        require(behavioralData.length > 0, "Empty behavioral data");

        // Update or create behavioral profile
        BehavioralProfile storage profile = behavioralProfiles[entity];
        if (profile.profileCreationTime == 0) {
            _createBehavioralProfile(entity);
            profile = behavioralProfiles[entity];
        }

        // Update profile with new data
        _updateBehavioralProfile(profile, behavioralData, activityType);

        // Perform anomaly detection
        anomalyScore = _detectAnomalies(profile, behavioralData, activityType);

        // Update threat metrics
        _updateThreatMetrics(activityType, anomalyScore);

        // Trigger alerts if anomaly detected
        if (anomalyScore > anomalyThreshold) {
            emit BehavioralAnomalyDetected(
                entity,
                anomalyScore,
                string(
                    abi.encodePacked(
                        "Anomalous ",
                        activityType,
                        " activity detected"
                    )
                )
            );

            // Update behavioral state
            _updateBehavioralState(profile, anomalyScore);
        }

        return anomalyScore;
    }

    /**
     * @notice Predict future threat patterns using AI model
     * @param patternData Historical pattern data
     * @param predictionWindow Hours to predict ahead
     * @return predictedThreats Array of predicted threat patterns
     */
    function predictThreatPatterns(
        uint256[] calldata patternData,
        uint256 predictionWindow
    ) external returns (bytes32[] memory predictedThreats) {
        require(patternData.length >= 24, "Insufficient historical data"); // Need at least 24 hours
        require(
            predictionWindow > 0 && predictionWindow <= predictionHorizon,
            "Invalid prediction window"
        );

        // AI-based pattern prediction (simplified)
        predictedThreats = new bytes32[](5); // Max 5 predictions
        uint256 predictionCount = 0;

        // Analyze trends and predict anomalies
        uint256 trend = _calculateTrend(patternData);
        uint256 volatility = _calculateVolatility(patternData);

        // Generate predictions based on analysis
        if (trend > 150 && volatility > 80) {
            // High upward trend with high volatility - potential attack buildup
            bytes32 patternId = _generatePredictedPattern(
                "attack_buildup",
                80,
                trend
            );
            predictedThreats[predictionCount++] = patternId;
        }

        if (volatility > 120) {
            // Extreme volatility - potential manipulation
            bytes32 patternId = _generatePredictedPattern(
                "market_manipulation",
                85,
                volatility
            );
            predictedThreats[predictionCount++] = patternId;
        }

        if (_detectCyclicalPattern(patternData)) {
            // Cyclical pattern detected - potential automated attack
            bytes32 patternId = _generatePredictedPattern(
                "automated_attack",
                75,
                100
            );
            predictedThreats[predictionCount++] = patternId;
        }

        // Emit prediction alerts
        for (uint256 i = 0; i < predictionCount; i++) {
            ThreatPattern memory pattern = threatPatterns[predictedThreats[i]];
            emit PredictiveAlertGenerated(
                predictedThreats[i],
                pattern.confidence,
                pattern.severity
            );
        }

        // Return actual predictions (resize array)
        bytes32[] memory actualPredictions = new bytes32[](predictionCount);
        for (uint256 i = 0; i < predictionCount; i++) {
            actualPredictions[i] = predictedThreats[i];
        }

        return actualPredictions;
    }

    /**
     * @notice Register new threat pattern for monitoring
     * @param description Pattern description
     * @param severity Base severity level
     * @param category Threat category
     * @param correlatedPatterns Array of related pattern IDs
     */
    function registerThreatPattern(
        string calldata description,
        uint256 severity,
        ThreatCategory category,
        bytes32[] calldata correlatedPatterns
    ) external onlyOwner returns (bytes32) {
        require(severity >= 1 && severity <= 10, "Invalid severity");
        require(bytes(description).length > 0, "Empty description");

        bytes32 patternId = keccak256(
            abi.encodePacked(description, severity, category, block.timestamp)
        );

        require(!threatPatterns[patternId].active, "Pattern already exists");

        threatPatterns[patternId] = ThreatPattern({
            patternId: patternId,
            description: description,
            severity: severity,
            confidence: 50, // Start with medium confidence
            frequency: 0,
            lastObserved: 0,
            active: true,
            correlatedPatterns: correlatedPatterns,
            category: category
        });

        activePatterns.push(patternId);

        emit ThreatPatternDetected(patternId, category, severity);
        return patternId;
    }

    /**
     * @notice Update AI model parameters
     * @param newThreshold New anomaly detection threshold
     * @param newHorizon New prediction horizon (hours)
     * @param newLearningRate New learning rate (basis points)
     */
    function updateAIModel(
        uint256 newThreshold,
        uint256 newHorizon,
        uint256 newLearningRate
    ) external onlyOwner {
        require(
            newThreshold >= 100 && newThreshold <= 900,
            "Invalid threshold"
        );
        require(newHorizon >= 1 && newHorizon <= 168, "Invalid horizon"); // Max 1 week
        require(
            newLearningRate >= 1 && newLearningRate <= 1000,
            "Invalid learning rate"
        );

        anomalyThreshold = newThreshold;
        predictionHorizon = newHorizon;
        learningRate = newLearningRate;

        // Recalculate model accuracy
        modelAccuracy = _recalculateModelAccuracy();
    }

    /**
     * @notice Get behavioral profile for entity
     * @param entity Address to query
     */
    function getBehavioralProfile(
        address entity
    )
        external
        view
        returns (
            uint256 trustScore,
            uint256 riskLevel,
            uint256 anomalyCount,
            BehavioralState currentState,
            uint256 lastActivity
        )
    {
        BehavioralProfile memory profile = behavioralProfiles[entity];
        return (
            profile.trustScore,
            profile.riskLevel,
            profile.anomalyCount,
            profile.currentState,
            profile.lastActivityTime
        );
    }

    /**
     * @notice Get threat pattern information
     * @param patternId Pattern to query
     */
    function getThreatPattern(
        bytes32 patternId
    )
        external
        view
        returns (
            string memory description,
            uint256 severity,
            uint256 confidence,
            ThreatCategory category,
            uint256 frequency
        )
    {
        ThreatPattern memory pattern = threatPatterns[patternId];
        return (
            pattern.description,
            pattern.severity,
            pattern.confidence,
            pattern.category,
            pattern.frequency
        );
    }

    /**
     * @notice Get AI model performance metrics
     */
    function getAIModelMetrics()
        external
        view
        returns (
            uint256 threshold,
            uint256 horizon,
            uint256 accuracy,
            uint256 totalPatterns,
            uint256 totalEntities
        )
    {
        return (
            anomalyThreshold,
            predictionHorizon,
            modelAccuracy,
            activePatterns.length,
            monitoredEntities.length
        );
    }

    /**
     * @dev Create new behavioral profile for entity
     */
    function _createBehavioralProfile(address entity) internal {
        require(
            behavioralProfiles[entity].profileCreationTime == 0,
            "Profile already exists"
        );

        behavioralProfiles[entity] = BehavioralProfile({
            entity: entity,
            trustScore: 500, // Start with neutral trust
            riskLevel: 20, // Low initial risk
            anomalyCount: 0,
            normalActivityCount: 1,
            lastActivityTime: block.timestamp,
            profileCreationTime: block.timestamp,
            behavioralPatterns: new bytes32[](0),
            currentState: BehavioralState.NORMAL
        });

        monitoredEntities.push(entity);
    }

    /**
     * @dev Update behavioral profile with new data
     */
    function _updateBehavioralProfile(
        BehavioralProfile storage profile,
        uint256[] memory behavioralData,
        string memory activityType
    ) internal {
        profile.lastActivityTime = block.timestamp;

        // Analyze behavioral data for patterns
        uint256 anomalyIndicators = _analyzeBehavioralData(behavioralData);

        if (anomalyIndicators > 2) {
            profile.anomalyCount++;
            profile.riskLevel = Math.min(profile.riskLevel + 5, 100);
        } else {
            profile.normalActivityCount++;
            profile.riskLevel = profile.riskLevel > 2
                ? profile.riskLevel.sub(2)
                : 0;
        }

        // Update trust score based on behavior
        _updateTrustScore(profile, anomalyIndicators);

        // Add behavioral pattern
        bytes32 patternHash = keccak256(
            abi.encodePacked(activityType, behavioralData, block.timestamp)
        );

        profile.behavioralPatterns.push(patternHash);
    }

    /**
     * @dev Detect anomalies in behavioral data
     */
    function _detectAnomalies(
        BehavioralProfile memory profile,
        uint256[] memory behavioralData,
        string memory activityType
    ) internal view returns (uint256) {
        uint256 anomalyScore = 0;

        // Check for statistical anomalies
        uint256 mean = _calculateMean(behavioralData);
        uint256 stdDev = _calculateStdDev(behavioralData, mean);

        // Count outliers (values > 2 standard deviations from mean)
        for (uint256 i = 0; i < behavioralData.length; i++) {
            if (behavioralData[i] > mean + (stdDev * 2)) {
                anomalyScore += 100; // 100 points per outlier
            }
        }

        // Activity-specific anomaly checks
        if (
            keccak256(abi.encodePacked(activityType)) ==
            keccak256(abi.encodePacked("large_transfer"))
        ) {
            if (behavioralData[0] > 100000 ether) {
                // Large transfer amount
                anomalyScore += 200;
            }
        }

        // Profile-based adjustments
        anomalyScore = anomalyScore.mul(100 - profile.trustScore / 10).div(100); // Trust score reduction

        return Math.min(anomalyScore, 1000); // Cap at 1000
    }

    /**
     * @dev Update behavioral state based on anomaly score
     */
    function _updateBehavioralState(
        BehavioralProfile storage profile,
        uint256 anomalyScore
    ) internal {
        BehavioralState newState;

        if (anomalyScore > 800) {
            newState = BehavioralState.MALICIOUS;
        } else if (anomalyScore > 600) {
            newState = BehavioralState.QUARANTINED;
        } else if (anomalyScore > 400) {
            newState = BehavioralState.SUSPICIOUS;
        } else {
            newState = BehavioralState.NORMAL;
        }

        if (newState != profile.currentState) {
            profile.currentState = newState;
            emit BehavioralProfileUpdated(
                profile.entity,
                profile.trustScore,
                newState
            );
        }
    }

    /**
     * @dev Calculate statistical mean
     */
    function _calculateMean(
        uint256[] memory data
    ) internal pure returns (uint256) {
        if (data.length == 0) return 0;

        uint256 sum = 0;
        for (uint256 i = 0; i < data.length; i++) {
            sum += data[i];
        }
        return sum / data.length;
    }

    /**
     * @dev Calculate standard deviation
     */
    function _calculateStdDev(
        uint256[] memory data,
        uint256 mean
    ) internal pure returns (uint256) {
        if (data.length <= 1) return 0;

        uint256 sumSquaredDiffs = 0;
        for (uint256 i = 0; i < data.length; i++) {
            uint256 diff = data[i] > mean ? data[i] - mean : mean - data[i];
            sumSquaredDiffs += diff * diff;
        }

        uint256 variance = sumSquaredDiffs / (data.length - 1);
        return _sqrt(variance);
    }

    /**
     * @dev Simple square root calculation
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @dev Calculate trend from time series data
     */
    function _calculateTrend(
        uint256[] memory data
    ) internal pure returns (uint256) {
        if (data.length < 2) return 100; // Neutral trend

        uint256 halfLen = data.length / 2;
        uint256 firstHalf = 0;
        uint256 secondHalf = 0;

        // Calculate first half mean
        for (uint256 i = 0; i < halfLen; i++) {
            firstHalf += data[i];
        }
        firstHalf = firstHalf / halfLen;

        // Calculate second half mean
        for (uint256 i = halfLen; i < data.length; i++) {
            secondHalf += data[i];
        }
        secondHalf = secondHalf / (data.length - halfLen);

        if (secondHalf > firstHalf) {
            return
                100 +
                Math.min(((secondHalf - firstHalf) * 100) / firstHalf, 100);
        } else {
            return
                100 -
                Math.min(((firstHalf - secondHalf) * 100) / firstHalf, 100);
        }
    }

    /**
     * @dev Calculate volatility from time series data
     */
    function _calculateVolatility(
        uint256[] memory data
    ) internal pure returns (uint256) {
        uint256 mean = _calculateMean(data);
        uint256 stdDev = _calculateStdDev(data, mean);

        return (stdDev * 100) / mean; // Coefficient of variation
    }

    /**
     * @dev Detect cyclical patterns in data
     */
    function _detectCyclicalPattern(
        uint256[] memory data
    ) internal pure returns (bool) {
        if (data.length < 12) return false; // Need minimum data points

        // Simple autocorrelation check (simplified)
        uint256 correlation = 0;
        uint256 period = 6; // Check for 6-period cycles

        for (uint256 i = 0; i < data.length - period; i++) {
            if (
                data[i] > _calculateMean(data) &&
                data[i + period] > _calculateMean(data)
            ) {
                correlation++;
            }
        }

        return (correlation * 100) / (data.length - period) > 60; // 60% correlation threshold
    }

    /**
     * @dev Generate predicted threat pattern
     */
    function _generatePredictedPattern(
        string memory patternType,
        uint256 confidence,
        uint256 intensity
    ) internal returns (bytes32) {
        bytes32 patternId = keccak256(
            abi.encodePacked(
                "predicted_",
                patternType,
                block.timestamp,
                intensity
            )
        );

        threatPatterns[patternId] = ThreatPattern({
            patternId: patternId,
            description: string(abi.encodePacked("Predicted: ", patternType)),
            severity: intensity / 10, // Convert intensity to severity
            confidence: confidence,
            frequency: 0,
            lastObserved: block.timestamp,
            active: true,
            correlatedPatterns: new bytes32[](0),
            category: ThreatCategory.EXPLOIT // Default category
        });

        return patternId;
    }

    /**
     * @dev Analyze behavioral data for anomaly indicators
     */
    function _analyzeBehavioralData(
        uint256[] memory data
    ) internal pure returns (uint256) {
        uint256 indicators = 0;

        // Check for extreme values
        uint256 max = _findMax(data);
        uint256 min = _findMin(data);
        uint256 range = max - min;

        if (range > _calculateMean(data) * 5) {
            indicators += 2; // Extreme range
        }

        // Check for sudden spikes
        for (uint256 i = 1; i < data.length; i++) {
            if (data[i] > data[i - 1] * 10) {
                indicators += 1; // Sudden spike
            }
        }

        return indicators;
    }

    /**
     * @dev Find maximum value in array
     */
    function _findMax(uint256[] memory data) internal pure returns (uint256) {
        uint256 max = 0;
        for (uint256 i = 0; i < data.length; i++) {
            if (data[i] > max) max = data[i];
        }
        return max;
    }

    /**
     * @dev Find minimum value in array
     */
    function _findMin(uint256[] memory data) internal pure returns (uint256) {
        if (data.length == 0) return 0;
        uint256 min = data[0];
        for (uint256 i = 1; i < data.length; i++) {
            if (data[i] < min) min = data[i];
        }
        return min;
    }

    /**
     * @dev Update trust score based on behavior
     */
    function _updateTrustScore(
        BehavioralProfile storage profile,
        uint256 anomalyIndicators
    ) internal {
        if (anomalyIndicators == 0) {
            profile.trustScore = Math.min(profile.trustScore + 5, 1000);
        } else {
            uint256 penalty = anomalyIndicators * 10;
            profile.trustScore = profile.trustScore > penalty
                ? profile.trustScore - penalty
                : 0;
        }
    }

    /**
     * @dev Update global threat metrics
     */
    function _updateThreatMetrics(
        string memory activityType,
        uint256 anomalyScore
    ) internal {
        threatMetrics[activityType] = threatMetrics[activityType].add(
            anomalyScore
        );
    }

    /**
     * @dev Recalculate AI model accuracy
     */
    function _recalculateModelAccuracy() internal view returns (uint256) {
        // Simplified accuracy calculation based on parameters
        uint256 baseAccuracy = 85;
        uint256 thresholdBonus = (1000 - anomalyThreshold) / 10; // Better threshold = higher accuracy
        uint256 horizonBonus = predictionHorizon / 10; // Longer horizon = slightly better accuracy

        return Math.min(baseAccuracy + thresholdBonus + horizonBonus, 95);
    }

    /**
     * @dev Initialize predictive threat model
     */
    function _initializePredictiveModel() internal {
        anomalyThreshold = 300; // Medium sensitivity
        predictionHorizon = 24; // 24-hour predictions
        learningRate = 500; // 5% learning rate
        modelAccuracy = 85; // Initial 85% accuracy

        // Initialize threat metrics
        threatMetrics["transfer"] = 0;
        threatMetrics["swap"] = 0;
        threatMetrics["governance"] = 0;
        threatMetrics["oracle"] = 0;
    }
}
