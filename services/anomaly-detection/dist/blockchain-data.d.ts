import { EventEmitter } from "events";
/**
 * @title BlockchainDataIngestion
 * @notice Real-time blockchain data ingestion for anomaly detection
 * @dev Connects to actual blockchain RPC and indexes relevant data
 */
interface DataIngestionConfig {
    rpcUrl: string;
    bridgeAddress: string;
    startBlock?: number;
    batchSize?: number;
    pollInterval?: number;
}
export interface TVLDataPoint {
    blockNumber: number;
    timestamp: number;
    tvl: bigint;
    source: string;
}
interface TransactionData {
    hash: string;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string;
    value: bigint;
    gasUsed: bigint;
    gasPrice: bigint;
    method?: string;
    params?: any[];
}
export interface BridgeEvent {
    eventName: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    args: any[];
}
export declare class BlockchainDataIngestion extends EventEmitter {
    private provider;
    private config;
    private isRunning;
    private lastProcessedBlock;
    private bridgeContract;
    private tvlHistory;
    private transactionHistory;
    private bridgeEvents;
    constructor(config: DataIngestionConfig);
    start(): Promise<void>;
    stop(): void;
    private fetchHistoricalData;
    private fetchBridgeEvents;
    private fetchTVLAtBlock;
    private fetchLargeTransactions;
    private subscribeToEvents;
    private processNewBlock;
    private pollNewData;
    getTVLHistory(hoursBack?: number): TVLDataPoint[];
    getBridgeEvents(hoursBack?: number): BridgeEvent[];
    getLargeTransactions(hoursBack?: number): TransactionData[];
    getCurrentTVL(): Promise<bigint>;
    getTransactionDetails(txHash: string): Promise<TransactionData | null>;
}
export {};
//# sourceMappingURL=blockchain-data.d.ts.map