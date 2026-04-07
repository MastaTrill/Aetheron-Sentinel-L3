import { ethers } from "ethers";
import { EventEmitter } from "events";
import { BlockchainDataIngestion } from "./blockchain-data";
interface DetectorConfig {
    bridgeAddress: string;
    sentinelAddress: string;
    anomalyOracleAddress: string;
    tvlSpikeThreshold: number;
    withdrawalWindow: number;
    monitoringInterval: number;
    rpcUrl: string;
    startBlock?: number;
}
export declare class AnomalyDetector extends EventEmitter {
    private provider;
    private config;
    private dataIngestion;
    private intervalId;
    private tvlHistory;
    private withdrawalHistory;
    private isRunning;
    private metrics;
    constructor(provider: ethers.JsonRpcProvider, config: DetectorConfig, dataIngestion?: BlockchainDataIngestion);
    private setupDataIngestionListeners;
    start(): void;
    stop(): void;
    private monitor;
    private checkPerformance;
    private getCurrentTVL;
    private checkTVLSpike;
    private calculateZScore;
    private analyzePatterns;
    private checkWithdrawalSpike;
    private calculateWithdrawalZScore;
    private calculateSingleWithdrawalZScore;
    private calculateWithdrawalVelocityZScore;
    private getHistoricalWithdrawalPatterns;
    private getHistoricalWithdrawalVelocities;
    private recordWithdrawal;
    private getAverageTVL;
    private reportToOracle;
    private triggerSentinel;
    getPerformanceMetrics(): {
        uptime: number;
        averageTVLFetchTime: number;
        averageDetectionTime: number;
        detectionAccuracy: number;
        tvlFetchCount: number;
        tvlFetchTotalTime: number;
        anomalyDetectionCount: number;
        anomalyDetectionTotalTime: number;
        falsePositives: number;
        truePositives: number;
        alertsSent: number;
        lastMetricsReset: number;
    };
    resetMetrics(): void;
}
export {};
//# sourceMappingURL=detector.d.ts.map