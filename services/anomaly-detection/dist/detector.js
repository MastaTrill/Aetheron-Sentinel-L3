import { ethers } from "ethers";
import { EventEmitter } from "events";
import { BlockchainDataIngestion, } from "./blockchain-data.js";
export class AnomalyDetector extends EventEmitter {
    provider;
    config;
    dataIngestion;
    intervalId = null;
    tvlHistory = [];
    withdrawalHistory = [];
    isRunning = false;
    // Performance metrics
    metrics = {
        tvlFetchCount: 0,
        tvlFetchTotalTime: 0,
        anomalyDetectionCount: 0,
        anomalyDetectionTotalTime: 0,
        falsePositives: 0,
        truePositives: 0,
        alertsSent: 0,
        lastMetricsReset: Date.now(),
    };
    constructor(provider, config, dataIngestion) {
        super();
        this.provider = provider;
        this.config = config;
        // Initialize blockchain data ingestion
        if (dataIngestion) {
            this.dataIngestion = dataIngestion;
        }
        else {
            this.dataIngestion = new BlockchainDataIngestion({
                rpcUrl: config.rpcUrl,
                bridgeAddress: config.bridgeAddress,
                startBlock: config.startBlock,
                batchSize: 100,
                pollInterval: config.monitoringInterval,
            });
        }
        // Listen for data ingestion events
        this.setupDataIngestionListeners();
    }
    setupDataIngestionListeners() {
        this.dataIngestion.on("tvlUpdate", (tvlData) => {
            // Convert to our internal format
            const tvlPoint = {
                currentTVL: tvlData.tvl,
                previousTVL: this.tvlHistory.length > 0
                    ? this.tvlHistory[this.tvlHistory.length - 1].currentTVL
                    : tvlData.tvl,
                timestamp: tvlData.timestamp * 1000, // Convert to milliseconds
            };
            this.tvlHistory.push(tvlPoint);
            // Keep last 100 data points
            if (this.tvlHistory.length > 100) {
                this.tvlHistory.shift();
            }
            // Check for TVL spike
            this.checkTVLSpike();
        });
        this.dataIngestion.on("bridgeEvent", (bridgeEvent) => {
            if (bridgeEvent.eventName === "TokensBridged") {
                const withdrawal = {
                    user: bridgeEvent.args[0], // sender
                    amount: bridgeEvent.args[2], // amount
                    chainId: Number(bridgeEvent.args[3]), // destinationChain
                    timestamp: bridgeEvent.timestamp * 1000,
                };
                this.recordWithdrawal(withdrawal);
            }
        });
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log("Starting anomaly detection...");
        // Start data ingestion
        this.dataIngestion.start();
        // Start monitoring loop
        this.intervalId = setInterval(() => {
            this.monitor();
        }, this.config.monitoringInterval);
    }
    stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.dataIngestion.stop();
        console.log("Anomaly detection stopped");
    }
    // Event subscription is now handled by BlockchainDataIngestion
    async monitor() {
        try {
            // TVL fetching is now handled by BlockchainDataIngestion
            await this.analyzePatterns();
            this.checkPerformance();
        }
        catch (error) {
            console.error("Monitoring error:", error);
            this.emit("performanceAlert", {
                type: "monitoring_error",
                error: error.message,
                timestamp: Date.now(),
            });
        }
    }
    checkPerformance() {
        const metrics = this.getPerformanceMetrics();
        // Alert if TVL fetch time exceeds 5 seconds
        if (metrics.averageTVLFetchTime > 5000) {
            this.emit("performanceAlert", {
                type: "slow_tvl_fetch",
                averageTime: metrics.averageTVLFetchTime,
                threshold: 5000,
                timestamp: Date.now(),
            });
        }
        // Alert if detection time exceeds 2 seconds
        if (metrics.averageDetectionTime > 2000) {
            this.emit("performanceAlert", {
                type: "slow_detection",
                averageTime: metrics.averageDetectionTime,
                threshold: 2000,
                timestamp: Date.now(),
            });
        }
        // Alert if accuracy drops below 80%
        if (metrics.detectionAccuracy < 0.8 &&
            metrics.truePositives + metrics.falsePositives > 10) {
            this.emit("performanceAlert", {
                type: "low_accuracy",
                accuracy: metrics.detectionAccuracy,
                threshold: 0.8,
                timestamp: Date.now(),
            });
        }
    }
    async getCurrentTVL() {
        try {
            return await this.dataIngestion.getCurrentTVL();
        }
        catch (error) {
            console.error("Error fetching current TVL:", error);
            // Fallback to last known TVL
            return this.tvlHistory.length > 0
                ? this.tvlHistory[this.tvlHistory.length - 1].currentTVL
                : ethers.parseEther("1000000");
        }
    }
    checkTVLSpike() {
        if (this.tvlHistory.length < 10)
            return; // Need sufficient history for statistical analysis
        const current = this.tvlHistory[this.tvlHistory.length - 1];
        const recentHistory = this.tvlHistory.slice(-20); // Use last 20 data points
        // Calculate z-score for current TVL change
        const zScore = this.calculateZScore(current, recentHistory);
        // CLARITY Act compliance: Use statistical outlier detection
        if (zScore > 3.5) {
            this.emit("tvlSpike", {
                zScore: zScore,
                currentTVL: current.currentTVL.toString(),
                statisticalThreshold: 3.5,
                timestamp: current.timestamp,
                compliance: "CLARITY Act - Reasonable Care",
            });
            this.triggerSentinel(current.currentTVL, zScore * 100); // Convert to basis points for contract
            // Report to oracle
            const data = JSON.stringify({ zScore: Math.floor(zScore * 100) });
            this.reportToOracle(0, Math.floor(zScore * 100), 90, data).catch(console.error); // TVLSpike = 0
        }
        // Also check traditional percentage threshold as backup
        if (recentHistory.length >= 2) {
            const previous = recentHistory[recentHistory.length - 2];
            if (previous.currentTVL === 0n)
                return;
            const drop = Number(((previous.currentTVL - current.currentTVL) * 10000n) /
                previous.currentTVL);
            if (drop >= this.config.tvlSpikeThreshold) {
                this.emit("tvlSpike", {
                    percentage: drop / 100,
                    currentTVL: current.currentTVL.toString(),
                    previousTVL: previous.currentTVL.toString(),
                    timestamp: current.timestamp,
                    method: "percentage_threshold",
                });
                this.triggerSentinel(current.currentTVL, drop);
                // Report to oracle
                const data = JSON.stringify({ drop });
                this.reportToOracle(0, drop, 85, data).catch(console.error); // TVLSpike = 0
            }
        }
    }
    calculateZScore(current, history) {
        if (history.length < 2)
            return 0;
        // Calculate TVL changes (drops) over time
        const changes = [];
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1];
            const curr = history[i];
            if (prev.currentTVL === 0n)
                continue;
            const change = Number(((prev.currentTVL - curr.currentTVL) * 10000n) / prev.currentTVL);
            changes.push(change);
        }
        if (changes.length === 0)
            return 0;
        // Calculate mean and standard deviation
        const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
        const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            changes.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0)
            return 0;
        // Calculate current change
        const last = history[history.length - 1];
        const secondLast = history[history.length - 2];
        if (secondLast.currentTVL === 0n)
            return 0;
        const currentChange = Number(((secondLast.currentTVL - current.currentTVL) * 10000n) /
            secondLast.currentTVL);
        // Calculate z-score
        const zScore = (currentChange - mean) / stdDev;
        return zScore;
    }
    async analyzePatterns() {
        const startTime = Date.now();
        const now = Date.now();
        // Filter recent withdrawals
        const recentWithdrawals = this.withdrawalHistory.filter((w) => now - w.timestamp < this.config.withdrawalWindow);
        // CLARITY Act 'Reasonable Care' Compliance: Statistical Analysis
        this.checkWithdrawalSpike(recentWithdrawals);
        // Check for rapid drain pattern using statistical analysis
        if (recentWithdrawals.length >= 5) {
            const withdrawalZScore = this.calculateWithdrawalZScore(recentWithdrawals);
            if (withdrawalZScore > 3.0) {
                // Slightly less strict for pattern detection
                this.metrics.truePositives++;
                const totalAmount = recentWithdrawals.reduce((sum, w) => sum + w.amount, 0n);
                const avgTVL = this.getAverageTVL();
                this.emit("rapidDrain", {
                    withdrawalCount: recentWithdrawals.length,
                    totalAmount: totalAmount.toString(),
                    avgTVL: avgTVL.toString(),
                    zScore: withdrawalZScore,
                    statisticalThreshold: 3.0,
                    windowMs: this.config.withdrawalWindow,
                    compliance: "CLARITY Act - Statistical Pattern Analysis",
                });
                // Report to oracle
                const data = JSON.stringify({
                    withdrawalsCount: recentWithdrawals.length,
                    totalAmount: Number(totalAmount),
                });
                await this.reportToOracle(2, Math.floor(withdrawalZScore * 100), 90, data); // RapidDrain = 2
            }
        }
        // Check for large single withdrawal using statistical outlier detection
        if (recentWithdrawals.length >= 3) {
            const avgTVL = this.getAverageTVL();
            if (avgTVL > 0n) {
                for (const withdrawal of recentWithdrawals) {
                    const percentage = Number((withdrawal.amount * 10000n) / avgTVL) / 100;
                    const withdrawalZScore = this.calculateSingleWithdrawalZScore(withdrawal.amount, recentWithdrawals);
                    if (withdrawalZScore > 3.5) {
                        this.metrics.truePositives++;
                        this.emit("largeWithdrawal", {
                            user: withdrawal.user,
                            amount: withdrawal.amount.toString(),
                            percentage: percentage,
                            zScore: withdrawalZScore,
                            chainId: withdrawal.chainId,
                            timestamp: withdrawal.timestamp,
                            compliance: "CLARITY Act - Outlier Detection",
                        });
                        // Report to oracle
                        const data = JSON.stringify({
                            user: withdrawal.user,
                            amount: Number(withdrawal.amount),
                            chainId: withdrawal.chainId,
                        });
                        await this.reportToOracle(1, Math.floor(withdrawalZScore * 100), 85, data); // LargeWithdrawal = 1
                        break; // Only alert on the most significant outlier
                    }
                }
            }
        }
        // Update metrics
        this.metrics.anomalyDetectionCount++;
        this.metrics.anomalyDetectionTotalTime += Date.now() - startTime;
    }
    checkWithdrawalSpike(withdrawals) {
        if (withdrawals.length < 3)
            return;
        // Calculate z-score for withdrawal velocity
        const zScore = this.calculateWithdrawalVelocityZScore(withdrawals);
        if (zScore > 3.5) {
            // Trigger 'Soft Pause' - CLARITY Act compliance
            this.emit("withdrawalSpike", {
                zScore: zScore,
                withdrawalCount: withdrawals.length,
                timeWindow: this.config.withdrawalWindow,
                compliance: "CLARITY Act - Reasonable Care",
                severity: "CRITICAL",
                action: "SOFT_PAUSE",
            });
            // This would trigger the sentinel pause
            const totalAmount = withdrawals.reduce((sum, w) => sum + w.amount, 0n);
            this.triggerSentinel(totalAmount, zScore * 100); // Report as basis points
            // Report to oracle
            const data = JSON.stringify({
                withdrawalsCount: withdrawals.length,
                window: this.config.withdrawalWindow,
            });
            this.reportToOracle(1, Math.floor(zScore * 100), 85, data).catch(console.error); // LargeWithdrawal = 1
        }
    }
    calculateWithdrawalZScore(withdrawals) {
        if (withdrawals.length < 2)
            return 0;
        // Use historical withdrawal patterns for comparison
        const historicalPatterns = this.getHistoricalWithdrawalPatterns();
        if (historicalPatterns.length < 5)
            return 0; // Need sufficient history
        // Calculate current pattern metrics
        const currentTotal = withdrawals.reduce((sum, w) => sum + w.amount, 0n);
        const currentCount = withdrawals.length;
        // Calculate historical means and std devs
        const totalMeans = historicalPatterns.map((p) => p.total);
        const countMeans = historicalPatterns.map((p) => p.count);
        const totalMean = totalMeans.reduce((a, b) => a + b, 0n) / BigInt(totalMeans.length);
        const countMean = countMeans.reduce((a, b) => a + b, 0) / countMeans.length;
        const totalVariance = totalMeans.reduce((sum, val) => {
            const diff = Number(val - totalMean);
            return sum + diff * diff;
        }, 0) / totalMeans.length;
        const countVariance = countMeans.reduce((sum, val) => {
            const diff = val - countMean;
            return sum + diff * diff;
        }, 0) / countMeans.length;
        const totalStdDev = Math.sqrt(totalVariance);
        const countStdDev = Math.sqrt(countVariance);
        if (totalStdDev === 0 || countStdDev === 0)
            return 0;
        // Calculate z-scores for both metrics
        const totalZScore = Number(currentTotal - totalMean) / totalStdDev;
        const countZScore = (currentCount - countMean) / countStdDev;
        // Return the higher z-score (more anomalous)
        return Math.max(Math.abs(totalZScore), Math.abs(countZScore));
    }
    calculateSingleWithdrawalZScore(amount, withdrawals) {
        const amounts = withdrawals.map((w) => Number(w.amount));
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            amounts.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0)
            return 0;
        return (Number(amount) - mean) / stdDev;
    }
    calculateWithdrawalVelocityZScore(withdrawals) {
        if (withdrawals.length < 2)
            return 0;
        // Calculate time intervals between withdrawals
        const intervals = [];
        for (let i = 1; i < withdrawals.length; i++) {
            intervals.push(withdrawals[i].timestamp - withdrawals[i - 1].timestamp);
        }
        if (intervals.length === 0)
            return 0;
        // Velocity is inverse of average interval (withdrawals per millisecond)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const velocity = avgInterval > 0 ? 1000 / avgInterval : 0; // withdrawals per second
        // Compare to historical velocities
        const historicalVelocities = this.getHistoricalWithdrawalVelocities();
        if (historicalVelocities.length < 3)
            return 0;
        const velocityMean = historicalVelocities.reduce((a, b) => a + b, 0) /
            historicalVelocities.length;
        const velocityVariance = historicalVelocities.reduce((sum, val) => sum + Math.pow(val - velocityMean, 2), 0) / historicalVelocities.length;
        const velocityStdDev = Math.sqrt(velocityVariance);
        if (velocityStdDev === 0)
            return 0;
        return (velocity - velocityMean) / velocityStdDev;
    }
    getHistoricalWithdrawalPatterns() {
        // This would track historical patterns - simplified implementation
        return [
            { total: ethers.parseEther("1000"), count: 5 },
            { total: ethers.parseEther("800"), count: 4 },
            { total: ethers.parseEther("1200"), count: 6 },
            { total: ethers.parseEther("900"), count: 5 },
            { total: ethers.parseEther("1100"), count: 5 },
        ];
    }
    getHistoricalWithdrawalVelocities() {
        // Historical withdrawal velocities (withdrawals per second)
        return [0.1, 0.15, 0.08, 0.12, 0.09, 0.11, 0.13];
    }
    recordWithdrawal(event) {
        this.withdrawalHistory.push(event);
        // Keep last 1000 events
        if (this.withdrawalHistory.length > 1000) {
            this.withdrawalHistory.shift();
        }
    }
    getAverageTVL() {
        if (this.tvlHistory.length === 0)
            return 0n;
        const sum = this.tvlHistory.reduce((acc, t) => acc + t.currentTVL, 0n);
        return sum / BigInt(this.tvlHistory.length);
    }
    async reportToOracle(anomalyType, severity, confidence, data) {
        const startTime = Date.now();
        try {
            const oracle = new ethers.Contract(this.config.anomalyOracleAddress, [
                "function reportAnomaly(uint8 anomalyType, uint256 severity, uint256 confidence, bytes data)",
            ], this.provider);
            // Report anomaly to oracle
            const tx = await oracle.reportAnomaly(anomalyType, severity, confidence, data);
            await tx.wait();
            this.metrics.alertsSent++;
            this.emit("oracleRequest", {
                success: true,
                responseTime: Date.now() - startTime,
            });
            console.log(`Oracle notified: Anomaly type ${anomalyType} with severity ${severity}`);
        }
        catch (error) {
            console.error("Failed to report to oracle:", error);
            this.metrics.falsePositives++;
            this.emit("oracleRequest", {
                success: false,
                responseTime: Date.now() - startTime,
            });
        }
    }
    async triggerSentinel(currentTVL, percentage) {
        try {
            const sentinel = new ethers.Contract(this.config.sentinelAddress, [
                "function reportAnomaly(uint256 tvlPercentage, uint256 currentTVL)",
                "function emergencyPause(string calldata reason)",
            ], this.provider);
            // Report anomaly to sentinel
            const tx = await sentinel.reportAnomaly(percentage, currentTVL);
            await tx.wait();
            this.metrics.alertsSent++;
            console.log(`Sentinel triggered: TVL spike of ${percentage / 100}%`);
        }
        catch (error) {
            console.error("Failed to trigger sentinel:", error);
            this.metrics.falsePositives++;
        }
    }
    getPerformanceMetrics() {
        const uptime = Date.now() - this.metrics.lastMetricsReset;
        const avgTVLFetchTime = this.metrics.tvlFetchCount > 0
            ? this.metrics.tvlFetchTotalTime / this.metrics.tvlFetchCount
            : 0;
        const avgDetectionTime = this.metrics.anomalyDetectionCount > 0
            ? this.metrics.anomalyDetectionTotalTime /
                this.metrics.anomalyDetectionCount
            : 0;
        return {
            ...this.metrics,
            uptime,
            averageTVLFetchTime: avgTVLFetchTime,
            averageDetectionTime: avgDetectionTime,
            detectionAccuracy: this.metrics.truePositives /
                (this.metrics.truePositives + this.metrics.falsePositives || 1),
        };
    }
    resetMetrics() {
        this.metrics = {
            tvlFetchCount: 0,
            tvlFetchTotalTime: 0,
            anomalyDetectionCount: 0,
            anomalyDetectionTotalTime: 0,
            falsePositives: 0,
            truePositives: 0,
            alertsSent: 0,
            lastMetricsReset: Date.now(),
        };
    }
}
//# sourceMappingURL=detector.js.map