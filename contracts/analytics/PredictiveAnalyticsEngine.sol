// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictiveAnalyticsEngine
 * @notice ML-based forecasting for bridge demand, risk assessment, and optimization
 * @dev On-chain data aggregation with predictive modeling for automated decisions
 */
contract PredictiveAnalyticsEngine is AccessControl, ReentrancyGuard {
    bytes32 public constant DATA_PROVIDER_ROLE =
        keccak256("DATA_PROVIDER_ROLE");
    bytes32 public constant MODEL_UPDATER_ROLE =
        keccak256("MODEL_UPDATER_ROLE");

    // Structs
    struct DataPoint {
        uint256 timestamp;
        uint256 value;
        uint256 confidence;
        uint256 volume;
        uint256 volatility;
    }

    struct Prediction {
        uint256 predictedValue;
        uint256 confidence;
        uint256 horizon; // seconds
        uint256 accuracy; // historical accuracy score
        uint256 modelVersion;
        uint256 timestamp;
    }

    struct ModelConfig {
        string modelType;
        uint256 horizon;
        uint256 updateFrequency;
        uint256 minDataPoints;
        uint256 trainingWindow;
        bool isActive;
    }

    struct ForecastWindow {
        uint256 windowStart;
        uint256 windowEnd;
        uint256 predictedInflow;
        uint256 predictedOutflow;
        uint256 predictedVolume;
        uint256 predictedLatency;
        uint256 confidence;
        int256 predictedRiskScore; // -100 to 100
    }

    struct MetricThresholds {
        uint256 volumeSpike;
        uint256 latencyThreshold;
        uint256 liquidityMin;
        uint256 riskScoreMax;
        uint256 priceDeviation;
    }

    struct Alert {
        uint256 alertId;
        AlertType alertType;
        uint256 severity; // 1-5
        string message;
        uint256 predictedValue;
        uint256 actualValue;
        uint256 timestamp;
        bool acknowledged;
    }

    enum AlertType {
        VolumeSpike,
        HighLatency,
        LowLiquidity,
        RiskIncrease,
        PriceDeviation,
        AnomalyDetected,
        OpportunityIdentified
    }

    // State
    uint256 public predictionCount;
    uint256 public alertCount;
    uint256 public modelVersion = 1;

    // Data storage
    mapping(bytes32 => DataPoint[]) public timeSeriesData; // key => data points
    mapping(bytes32 => uint256) public dataPointCounts;
    mapping(bytes32 => Prediction) public latestPredictions;
    mapping(bytes32 => ForecastWindow[]) public forecastHistory;
    mapping(uint256 => Alert) public alerts;
    mapping(bytes32 => ModelConfig) public modelConfigs;

    // Metric thresholds
    MetricThresholds public thresholds =
        MetricThresholds({
            volumeSpike: 500, // 5x normal
            latencyThreshold: 30 minutes,
            liquidityMin: 10000e18,
            riskScoreMax: 80,
            priceDeviation: 500 // 5%
        });

    // Historical tracking
    mapping(bytes32 => uint256) public lastAnomalyTime;
    mapping(bytes32 => uint256) public anomalyFrequency;
    uint256 public constant ANOMALY_COOLDOWN = 1 hours;

    // Accuracy tracking
    mapping(bytes32 => uint256) public totalPredictions;
    mapping(bytes32 => uint256) public accuratePredictions;
    uint256 public constant ACCURACY_WINDOW = 100; // Last N predictions

    // Events
    event DataPointAdded(bytes32 indexed key, uint256 value, uint256 timestamp);
    event PredictionGenerated(
        bytes32 indexed key,
        uint256 predictedValue,
        uint256 confidence,
        uint256 horizon
    );
    event ForecastGenerated(
        bytes32 indexed key,
        uint256 windowStart,
        uint256 predictedInflow,
        uint256 predictedOutflow,
        int256 riskScore
    );
    event AlertTriggered(
        uint256 indexed alertId,
        AlertType indexed alertType,
        uint256 severity,
        string message
    );
    event AlertAcknowledged(uint256 indexed alertId);
    event ModelUpdated(bytes32 indexed key, uint256 newVersion);
    event AnomalyDetected(
        bytes32 indexed key,
        uint256 expected,
        uint256 actual,
        uint256 deviation
    );
    event OpportunityIdentified(
        bytes32 indexed key,
        string opportunityType,
        uint256 estimatedValue
    );
    event ThresholdsUpdated(
        uint256 volumeSpike,
        uint256 latencyThreshold,
        uint256 liquidityMin
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DATA_PROVIDER_ROLE, msg.sender);
        _grantRole(MODEL_UPDATER_ROLE, msg.sender);

        // Initialize default model configs
        _initializeDefaultModels();
    }

    function _initializeDefaultModels() internal {
        // Bridge Volume Prediction
        modelConfigs[keccak256("bridge_volume")] = ModelConfig({
            modelType: "LinearRegression",
            horizon: 1 hours,
            updateFrequency: 15 minutes,
            minDataPoints: 24,
            trainingWindow: 7 days,
            isActive: true
        });

        // Liquidity Demand
        modelConfigs[keccak256("liquidity_demand")] = ModelConfig({
            modelType: "MovingAverage",
            horizon: 4 hours,
            updateFrequency: 1 hours,
            minDataPoints: 12,
            trainingWindow: 24 hours,
            isActive: true
        });

        // Risk Score
        modelConfigs[keccak256("risk_score")] = ModelConfig({
            modelType: "ExponentialSmoothing",
            horizon: 30 minutes,
            updateFrequency: 5 minutes,
            minDataPoints: 10,
            trainingWindow: 12 hours,
            isActive: true
        });

        // Latency Prediction
        modelConfigs[keccak256("latency")] = ModelConfig({
            modelType: "ARIMA",
            horizon: 1 hours,
            updateFrequency: 10 minutes,
            minDataPoints: 20,
            trainingWindow: 6 hours,
            isActive: true
        });
    }

    // ============ Data Ingestion ============

    function addDataPoint(
        bytes32 _key,
        uint256 _value,
        uint256 _volume,
        uint256 _volatility,
        uint256 _timestamp
    ) external onlyRole(DATA_PROVIDER_ROLE) {
        require(_timestamp <= block.timestamp, "Future timestamp");
        require(_value > 0, "Invalid value");

        DataPoint memory point = DataPoint({
            timestamp: _timestamp,
            value: _value,
            confidence: _calculateConfidence(_key),
            volume: _volume,
            volatility: _volatility
        });

        timeSeriesData[_key].push(point);
        dataPointCounts[_key]++;

        // Trim old data (keep last 1000 points per key)
        if (timeSeriesData[_key].length > 1000) {
            delete timeSeriesData[_key][0];
        }

        emit DataPointAdded(_key, _value, _timestamp);

        // Check for anomalies
        _checkForAnomaly(_key, _value);

        // Generate prediction if enough data
        if (dataPointCounts[_key] >= modelConfigs[_key].minDataPoints) {
            _generatePrediction(_key);
        }
    }

    function addBatchDataPoints(
        bytes32[] calldata _keys,
        uint256[] calldata _values,
        uint256[] calldata _volumes,
        uint256[] calldata _volatilities,
        uint256[] calldata _timestamps
    ) external onlyRole(DATA_PROVIDER_ROLE) {
        require(_keys.length == _values.length, "Length mismatch");
        require(_keys.length == _timestamps.length, "Length mismatch");

        for (uint256 i = 0; i < _keys.length; i++) {
            this.addDataPoint(
                _keys[i],
                _values[i],
                _volumes[i],
                _volatilities[i],
                _timestamps[i]
            );
        }
    }

    // ============ Predictive Models ============

    function _generatePrediction(bytes32 _key) internal {
        DataPoint[] storage data = timeSeriesData[_key];
        ModelConfig memory config = modelConfigs[_key];

        if (!config.isActive || data.length < config.minDataPoints) return;

        // Simplified ML prediction (in production would use actual ML model off-chain)
        uint256 predictedValue = _predictValue(_key, data, config);
        uint256 confidence = _calculatePredictionConfidence(_key, data, config);
        uint256 horizon = config.horizon;

        latestPredictions[_key] = Prediction({
            predictedValue: predictedValue,
            confidence: confidence,
            horizon: horizon,
            accuracy: _calculateAccuracy(_key),
            modelVersion: modelVersion,
            timestamp: block.timestamp
        });

        predictionCount++;

        emit PredictionGenerated(_key, predictedValue, confidence, horizon);

        // Generate forecast window
        _generateForecastWindow(_key, predictedValue, confidence);
    }

    function _predictValue(
        bytes32 _key,
        DataPoint[] storage _data,
        ModelConfig memory _config
    ) internal view returns (uint256 predicted) {
        // Simplified linear regression / moving average
        uint256 window = _config.trainingWindow / 1 hours;
        if (window > _data.length) window = _data.length;
        if (window == 0) window = 1;

        uint256 sum;
        uint256 weights;
        uint256 baseWeight = 100;

        for (uint256 i = 0; i < window; i++) {
            uint256 idx = _data.length - 1 - i;
            uint256 weight = (baseWeight * (window - i)) / window;
            sum += _data[idx].value * weight;
            weights += weight;
        }

        if (weights == 0) return 0;

        uint256 basePrediction = sum / weights;

        // Apply trend adjustment
        int256 trend = _calculateTrend(_data, window);
        uint256 adjustment = uint256((int256(basePrediction) * trend) / 1000);

        // Apply seasonality factor (simplified)
        uint256 hourOfDay = (block.timestamp / 1 hours) % 24;
        uint256 seasonalityFactor = _getSeasonalityFactor(_key, hourOfDay);

        predicted = ((basePrediction + adjustment) * seasonalityFactor) / 100;

        return predicted;
    }

    function _calculateTrend(
        DataPoint[] storage _data,
        uint256 _window
    ) internal view returns (int256 trend) {
        if (_data.length < 2 || _window < 2) return 0;

        uint256 halfWindow = _window / 2;
        uint256 sum1;
        uint256 sum2;

        for (uint256 i = 0; i < halfWindow; i++) {
            sum1 += _data[_data.length - 1 - i].value;
        }

        for (uint256 i = halfWindow; i < _window; i++) {
            sum2 += _data[_data.length - 1 - i].value;
        }

        uint256 avg1 = sum1 / halfWindow;
        uint256 avg2 = sum2 / (_window - halfWindow);

        if (avg1 == 0) return 0;

        int256 change = int256(avg2) - int256(avg1);
        trend = (change * 1000) / int256(avg1);

        return trend; // Returns trend in bps
    }

    function _getSeasonalityFactor(
        bytes32 _key,
        uint256 _hourOfDay
    ) internal pure returns (uint256) {
        // Simplified seasonality - higher during peak hours
        // Bridge usage typically higher during business hours
        if (_hourOfDay >= 9 && _hourOfDay <= 17) {
            return 120; // 20% higher
        } else if (_hourOfDay >= 0 && _hourOfDay <= 5) {
            return 70; // 30% lower
        }
        return 100; // Baseline
    }

    function _calculateConfidence(
        bytes32 _key
    ) internal view returns (uint256) {
        DataPoint[] storage data = timeSeriesData[_key];
        ModelConfig memory config = modelConfigs[_key];

        if (data.length < config.minDataPoints) {
            return (data.length * 100) / config.minDataPoints; // Growing confidence
        }

        return 95; // Max confidence when enough data
    }

    function _calculatePredictionConfidence(
        bytes32 _key,
        DataPoint[] storage _data,
        ModelConfig memory _config
    ) internal view returns (uint256) {
        if (_data.length < _config.minDataPoints) return 0;

        // Calculate variance of recent data points
        uint256 avg = _getAverage(_data, 10);
        uint256 variance = _getVariance(_data, 10, avg);

        // Lower variance = higher confidence
        uint256 stability = 10000 / (variance / 1e18 + 1);

        return stability > 100 ? 100 : stability;
    }

    function _getAverage(
        DataPoint[] storage _data,
        uint256 _window
    ) internal view returns (uint256) {
        if (_data.length == 0) return 0;
        uint256 window = _window > _data.length ? _data.length : _window;
        uint256 sum;
        for (uint256 i = 0; i < window; i++) {
            sum += _data[_data.length - 1 - i].value;
        }
        return sum / window;
    }

    function _getVariance(
        DataPoint[] storage _data,
        uint256 _window,
        uint256 _avg
    ) internal view returns (uint256) {
        if (_data.length == 0) return 0;
        uint256 window = _window > _data.length ? _data.length : _window;
        uint256 sumSquared;
        for (uint256 i = 0; i < window; i++) {
            uint256 diff = _data[_data.length - 1 - i].value > _avg
                ? _data[_data.length - 1 - i].value - _avg
                : _avg - _data[_data.length - 1 - i].value;
            sumSquared += diff * diff;
        }
        return sumSquared / window;
    }

    // ============ Forecast Windows ============

    function _generateForecastWindow(
        bytes32 _key,
        uint256 _basePrediction,
        uint256 _confidence
    ) internal {
        ForecastWindow memory forecast = ForecastWindow({
            windowStart: block.timestamp,
            windowEnd: block.timestamp + 1 hours,
            predictedInflow: _basePrediction,
            predictedOutflow: (_basePrediction * 80) / 100,
            predictedVolume: (_basePrediction * 150) / 100,
            predictedLatency: 15 minutes,
            confidence: _confidence,
            predictedRiskScore: _calculatePredictedRisk(_key, _basePrediction)
        });

        forecastHistory[_key].push(forecast);

        // Check for opportunities
        _identifyOpportunities(_key, forecast);

        // Trim old forecasts
        if (forecastHistory[_key].length > 100) {
            delete forecastHistory[_key][0];
        }
    }

    function _calculatePredictedRisk(
        bytes32 _key,
        uint256 _predictedValue
    ) internal view returns (int256) {
        // Simplified risk calculation
        int256 risk = 0;

        DataPoint[] storage data = timeSeriesData[_key];
        if (data.length > 1) {
            uint256 recentAvg = _getAverage(data, 5);
            uint256 historicalAvg = _getAverage(data, 50);

            if (historicalAvg > 0) {
                int256 deviation = ((int256(recentAvg) -
                    int256(historicalAvg)) * 100) / int256(historicalAvg);
                risk = deviation;
            }
        }

        return risk > 100 ? int256(100) : (risk < -100 ? int256(-100) : risk);
    }

    // ============ Anomaly Detection ============

    function _checkForAnomaly(bytes32 _key, uint256 _value) internal {
        DataPoint[] storage data = timeSeriesData[_key];
        if (data.length < 3) return;

        uint256 avg = _getAverage(data, data.length - 1);
        uint256 stdDev = _getStandardDeviation(data, avg);

        uint256 deviation = _value > avg
            ? ((_value - avg) * 100) / avg
            : ((avg - _value) * 100) / avg;

        uint256 anomalyThreshold = 300; // 3x standard deviation

        if (deviation > anomalyThreshold) {
            // Check cooldown
            if (block.timestamp - lastAnomalyTime[_key] > ANOMALY_COOLDOWN) {
                lastAnomalyTime[_key] = block.timestamp;
                anomalyFrequency[_key]++;

                _triggerAnomalyAlert(_key, avg, _value, deviation);
            }
        }
    }

    function _getStandardDeviation(
        DataPoint[] storage _data,
        uint256 _avg
    ) internal view returns (uint256) {
        uint256 sumSquared;
        for (uint256 i = 0; i < _data.length; i++) {
            uint256 diff = _data[i].value > _avg
                ? _data[i].value - _avg
                : _avg - _data[i].value;
            sumSquared += diff * diff;
        }
        uint256 variance = sumSquared / _data.length;
        return _sqrt(variance);
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function _triggerAnomalyAlert(
        bytes32 _key,
        uint256 _expected,
        uint256 _actual,
        uint256 _deviation
    ) internal {
        uint256 severity = _deviation > 500
            ? 5
            : (_deviation > 300 ? 4 : (_deviation > 200 ? 3 : 2));

        uint256 alertId = alertCount++;

        alerts[alertId] = Alert({
            alertId: alertId,
            alertType: AlertType.AnomalyDetected,
            severity: uint8(severity),
            message: "Significant deviation from predicted value",
            predictedValue: _expected,
            actualValue: _actual,
            timestamp: block.timestamp,
            acknowledged: false
        });

        emit AnomalyDetected(_key, _expected, _actual, _deviation);
        emit AlertTriggered(
            alertId,
            AlertType.AnomalyDetected,
            severity,
            "Anomaly detected"
        );
    }

    // ============ Opportunity Identification ============

    function _identifyOpportunities(
        bytes32 _key,
        ForecastWindow memory _forecast
    ) internal {
        // Identify rebalancing opportunity
        if (
            _forecast.predictedOutflow > (_forecast.predictedInflow * 150) / 100
        ) {
            uint256 alertId = alertCount++;

            alerts[alertId] = Alert({
                alertId: alertId,
                alertType: AlertType.OpportunityIdentified,
                severity: 2,
                message: "Rebalancing opportunity detected - high outflow predicted",
                predictedValue: _forecast.predictedOutflow,
                actualValue: 0,
                timestamp: block.timestamp,
                acknowledged: false
            });

            emit OpportunityIdentified(
                _key,
                "REBALANCE",
                _forecast.predictedOutflow - _forecast.predictedInflow
            );
            emit AlertTriggered(
                alertId,
                AlertType.OpportunityIdentified,
                2,
                "Rebalancing opportunity"
            );
        }

        // Identify high demand opportunity
        if (
            _forecast.confidence > 80 &&
            _forecast.predictedVolume > 1_000_000e18
        ) {
            emit OpportunityIdentified(
                _key,
                "HIGH_DEMAND",
                _forecast.predictedVolume
            );
        }
    }

    // ============ Accuracy Tracking ============

    function updatePredictionAccuracy(
        bytes32 _key,
        uint256 _actualValue
    ) external onlyRole(DATA_PROVIDER_ROLE) {
        Prediction storage prediction = latestPredictions[_key];
        require(prediction.timestamp > 0, "No prediction to verify");

        totalPredictions[_key]++;
        uint256 predicted = prediction.predictedValue;

        // Check if within 10% of actual
        uint256 deviation = predicted > _actualValue
            ? ((predicted - _actualValue) * 100) / predicted
            : ((_actualValue - predicted) * 100) / _actualValue;

        if (deviation <= 10) {
            accuratePredictions[_key]++;
        }
    }

    function _calculateAccuracy(bytes32 _key) internal view returns (uint256) {
        if (totalPredictions[_key] == 0) return 0;
        return (accuratePredictions[_key] * 100) / totalPredictions[_key];
    }

    // ============ Alert Management ============

    function acknowledgeAlert(
        uint256 _alertId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(alerts[_alertId].alertId == _alertId, "Alert not found");
        alerts[_alertId].acknowledged = true;
        emit AlertAcknowledged(_alertId);
    }

    function dismissAlert(
        uint256 _alertId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete alerts[_alertId];
    }

    // ============ Model Configuration ============

    function updateModelConfig(
        bytes32 _key,
        string calldata _modelType,
        uint256 _horizon,
        uint256 _updateFrequency,
        uint256 _minDataPoints
    ) external onlyRole(MODEL_UPDATER_ROLE) {
        modelConfigs[_key] = ModelConfig({
            modelType: _modelType,
            horizon: _horizon,
            updateFrequency: _updateFrequency,
            minDataPoints: _minDataPoints,
            trainingWindow: 7 days,
            isActive: true
        });

        modelVersion++;
        emit ModelUpdated(_key, modelVersion);
    }

    function toggleModel(bytes32 _key) external onlyRole(DEFAULT_ADMIN_ROLE) {
        modelConfigs[_key].isActive = !modelConfigs[_key].isActive;
    }

    // ============ Threshold Management ============

    function updateThresholds(
        uint256 _volumeSpike,
        uint256 _latencyThreshold,
        uint256 _liquidityMin,
        uint256 _riskScoreMax,
        uint256 _priceDeviation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        thresholds = MetricThresholds({
            volumeSpike: _volumeSpike,
            latencyThreshold: _latencyThreshold,
            liquidityMin: _liquidityMin,
            riskScoreMax: _riskScoreMax,
            priceDeviation: _priceDeviation
        });

        emit ThresholdsUpdated(_volumeSpike, _latencyThreshold, _liquidityMin);
    }

    // ============ View Functions ============

    function getPrediction(
        bytes32 _key
    )
        external
        view
        returns (
            uint256 predictedValue,
            uint256 confidence,
            uint256 horizon,
            uint256 accuracy,
            uint256 timestamp
        )
    {
        Prediction storage pred = latestPredictions[_key];
        return (
            pred.predictedValue,
            pred.confidence,
            pred.horizon,
            pred.accuracy,
            pred.timestamp
        );
    }

    function getRecentData(
        bytes32 _key,
        uint256 _count
    )
        external
        view
        returns (
            uint256[] memory values,
            uint256[] memory timestamps,
            uint256[] memory volumes
        )
    {
        DataPoint[] storage data = timeSeriesData[_key];
        uint256 start = data.length > _count ? data.length - _count : 0;
        uint256 length = data.length > _count ? _count : data.length;

        values = new uint256[](length);
        timestamps = new uint256[](length);
        volumes = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            DataPoint storage point = data[start + i];
            values[i] = point.value;
            timestamps[i] = point.timestamp;
            volumes[i] = point.volume;
        }

        return (values, timestamps, volumes);
    }

    function getForecasts(
        bytes32 _key,
        uint256 _count
    ) external view returns (ForecastWindow[] memory forecasts) {
        ForecastWindow[] storage data = forecastHistory[_key];
        uint256 start = data.length > _count ? data.length - _count : 0;
        uint256 length = data.length > _count ? _count : data.length;

        forecasts = new ForecastWindow[](length);
        for (uint256 i = 0; i < length; i++) {
            forecasts[i] = data[start + i];
        }

        return forecasts;
    }

    function getUnacknowledgedAlerts()
        external
        view
        returns (
            uint256[] memory ids,
            AlertType[] memory types,
            uint256[] memory severities,
            string[] memory messages
        )
    {
        uint256 count;
        for (uint256 i = 0; i < alertCount; i++) {
            if (!alerts[i].acknowledged) count++;
        }

        ids = new uint256[](count);
        types = new AlertType[](count);
        severities = new uint256[](count);
        messages = new string[](count);

        uint256 idx;
        for (uint256 i = 0; i < alertCount; i++) {
            if (!alerts[i].acknowledged) {
                ids[idx] = alerts[i].alertId;
                types[idx] = alerts[i].alertType;
                severities[idx] = alerts[i].severity;
                messages[idx] = alerts[i].message;
                idx++;
            }
        }

        return (ids, types, severities, messages);
    }

    function getModelConfig(
        bytes32 _key
    )
        external
        view
        returns (string memory modelType, uint256 horizon, uint256 accuracy)
    {
        ModelConfig storage config = modelConfigs[_key];
        return (config.modelType, config.horizon, _calculateAccuracy(_key));
    }

    function getDataPointCount(bytes32 _key) external view returns (uint256) {
        return dataPointCounts[_key];
    }

    function getAnomalyStats(
        bytes32 _key
    ) external view returns (uint256 lastAnomaly, uint256 frequency) {
        return (lastAnomalyTime[_key], anomalyFrequency[_key]);
    }
}
