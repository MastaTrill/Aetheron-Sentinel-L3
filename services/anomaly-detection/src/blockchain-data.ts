// @ts-nocheck
import { ethers } from "ethers";
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

export class BlockchainDataIngestion extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private config: DataIngestionConfig;
  private isRunning = false;
  private lastProcessedBlock = 0;
  private bridgeContract: ethers.Contract;

  // Data caches
  private tvlHistory: TVLDataPoint[] = [];
  private transactionHistory: TransactionData[] = [];
  private bridgeEvents: BridgeEvent[] = [];

  constructor(config: DataIngestionConfig) {
    super();
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // Initialize bridge contract for event listening
    this.bridgeContract = new ethers.Contract(
      config.bridgeAddress,
      [
        "event TokensBridged(address indexed sender, address indexed token, uint256 amount, uint256 destinationChain, address recipient, bytes32 transferId)",
        "event TokensUnbridged(address indexed recipient, address indexed token, uint256 amount, bytes32 indexed transferId)",
        "function totalValueLocked() view returns (uint256)",
      ],
      this.provider,
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("🚀 Starting blockchain data ingestion...");

    // Get starting block
    if (!this.config.startBlock) {
      this.lastProcessedBlock = (await this.provider.getBlockNumber()) - 1000; // Start 1000 blocks ago
    } else {
      this.lastProcessedBlock = this.config.startBlock;
    }

    // Initial data fetch
    await this.fetchHistoricalData();
    await this.subscribeToEvents();

    // Start polling for new data
    setInterval(() => {
      this.pollNewData();
    }, this.config.pollInterval || 12000); // 12 seconds

    this.emit("started");
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log("🛑 Blockchain data ingestion stopped");
    this.emit("stopped");
  }

  private async fetchHistoricalData(): Promise<void> {
    console.log(
      `📚 Fetching historical data from block ${this.lastProcessedBlock}...`,
    );

    const currentBlock = await this.provider.getBlockNumber();
    const batchSize = this.config.batchSize || 1000;

    for (
      let fromBlock = this.lastProcessedBlock;
      fromBlock < currentBlock;
      fromBlock += batchSize
    ) {
      const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

      try {
        // Fetch bridge events
        await this.fetchBridgeEvents(fromBlock, toBlock);

        // Fetch TVL at regular intervals
        if (fromBlock % 100 === 0) {
          // Every 100 blocks
          await this.fetchTVLAtBlock(toBlock);
        }

        // Fetch large transactions
        await this.fetchLargeTransactions(fromBlock, toBlock);

        this.lastProcessedBlock = toBlock;
      } catch (error) {
        console.error(
          `Error fetching data for blocks ${fromBlock}-${toBlock}:`,
          error,
        );
      }
    }

    console.log("✅ Historical data fetch completed");
  }

  private async fetchBridgeEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    try {
      // Query for TokensBridged events
      const bridgeFilter = this.bridgeContract.filters.TokensBridged();
      const bridgeEvents = await this.bridgeContract.queryFilter(
        bridgeFilter,
        fromBlock,
        toBlock,
      );

      for (const event of bridgeEvents) {
        const block = await event.getBlock();
        const bridgeEvent: BridgeEvent = {
          eventName: "TokensBridged",
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
          timestamp: block.timestamp,
          args: event.args,
        };

        this.bridgeEvents.push(bridgeEvent);
        this.emit("bridgeEvent", bridgeEvent);
      }

      // Query for TokensUnbridged events
      const unbridgeFilter = this.bridgeContract.filters.TokensUnbridged();
      const unbridgeEvents = await this.bridgeContract.queryFilter(
        unbridgeFilter,
        fromBlock,
        toBlock,
      );

      for (const event of unbridgeEvents) {
        const block = await event.getBlock();
        const bridgeEvent: BridgeEvent = {
          eventName: "TokensUnbridged",
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
          timestamp: block.timestamp,
          args: event.args,
        };

        this.bridgeEvents.push(bridgeEvent);
        this.emit("bridgeEvent", bridgeEvent);
      }
    } catch (error) {
      console.error("Error fetching bridge events:", error);
    }
  }

  private async fetchTVLAtBlock(blockNumber: number): Promise<void> {
    try {
      // Get TVL from bridge contract at specific block
      const tvl = await this.bridgeContract.totalValueLocked({
        blockTag: blockNumber,
      });
      const block = await this.provider.getBlock(blockNumber);

      const tvlData: TVLDataPoint = {
        blockNumber,
        timestamp: block.timestamp,
        tvl,
        source: "bridge_contract",
      };

      this.tvlHistory.push(tvlData);
      this.emit("tvlUpdate", tvlData);

      // Keep last 1000 TVL points
      if (this.tvlHistory.length > 1000) {
        this.tvlHistory.shift();
      }
    } catch (error) {
      console.error(`Error fetching TVL at block ${blockNumber}:`, error);
    }
  }

  private async fetchLargeTransactions(
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    try {
      // Get blocks in range
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        const block = await this.provider.getBlock(blockNum, true);

        if (!block || !block.transactions) continue;

        for (const tx of block.transactions) {
          // Check if transaction value is significant (> 1 ETH)
          if (tx.value > ethers.parseEther("1")) {
            const txData: TransactionData = {
              hash: tx.hash,
              blockNumber: tx.blockNumber,
              timestamp: block.timestamp,
              from: tx.from,
              to: tx.to || "",
              value: tx.value,
              gasUsed: tx.gasLimit, // Approximate, actual gas used would need receipt
              gasPrice: tx.gasPrice,
            };

            this.transactionHistory.push(txData);
            this.emit("largeTransaction", txData);
          }
        }
      }

      // Keep last 5000 transactions
      if (this.transactionHistory.length > 5000) {
        this.transactionHistory.splice(
          0,
          this.transactionHistory.length - 5000,
        );
      }
    } catch (error) {
      console.error("Error fetching large transactions:", error);
    }
  }

  private async subscribeToEvents(): Promise<void> {
    console.log("👂 Subscribing to real-time events...");

    // Listen for new blocks
    this.provider.on("block", async (blockNumber) => {
      await this.processNewBlock(blockNumber);
    });

    // Listen for bridge events
    this.bridgeContract.on("TokensBridged", async (...args) => {
      const event = args[args.length - 1]; // Last arg is the event object
      const block = await event.getBlock();
      const bridgeEvent: BridgeEvent = {
        eventName: "TokensBridged",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        timestamp: block.timestamp,
        args: event.args,
      };

      this.bridgeEvents.push(bridgeEvent);
      this.emit("bridgeEvent", bridgeEvent);
    });

    this.bridgeContract.on("TokensUnbridged", async (...args) => {
      const event = args[args.length - 1];
      const block = await event.getBlock();
      const bridgeEvent: BridgeEvent = {
        eventName: "TokensUnbridged",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        timestamp: block.timestamp,
        args: event.args,
      };

      this.bridgeEvents.push(bridgeEvent);
      this.emit("bridgeEvent", bridgeEvent);
    });
  }

  private async processNewBlock(blockNumber: number): Promise<void> {
    try {
      // Fetch TVL for new block
      await this.fetchTVLAtBlock(blockNumber);

      // Check for large transactions in the block
      const block = await this.provider.getBlock(blockNumber, true);
      if (block && block.transactions) {
        for (const tx of block.transactions) {
          if (tx.value > ethers.parseEther("10")) {
            // Higher threshold for real-time
            const txData: TransactionData = {
              hash: tx.hash,
              blockNumber: tx.blockNumber,
              timestamp: block.timestamp,
              from: tx.from,
              to: tx.to || "",
              value: tx.value,
              gasUsed: tx.gasLimit,
              gasPrice: tx.gasPrice,
            };

            this.transactionHistory.push(txData);
            this.emit("largeTransaction", txData);
          }
        }
      }

      this.lastProcessedBlock = blockNumber;
    } catch (error) {
      console.error(`Error processing block ${blockNumber}:`, error);
    }
  }

  private async pollNewData(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();

      if (currentBlock > this.lastProcessedBlock) {
        // Process any missed blocks
        for (
          let blockNum = this.lastProcessedBlock + 1;
          blockNum <= currentBlock;
          blockNum++
        ) {
          await this.processNewBlock(blockNum);
        }
      }
    } catch (error) {
      console.error("Error polling new data:", error);
    }
  }

  // Data access methods
  getTVLHistory(hoursBack: number = 24): TVLDataPoint[] {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
    return this.tvlHistory.filter(
      (point) => point.timestamp * 1000 >= cutoffTime,
    );
  }

  getBridgeEvents(hoursBack: number = 24): BridgeEvent[] {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
    return this.bridgeEvents.filter(
      (event) => event.timestamp * 1000 >= cutoffTime,
    );
  }

  getLargeTransactions(hoursBack: number = 24): TransactionData[] {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
    return this.transactionHistory.filter(
      (tx) => tx.timestamp * 1000 >= cutoffTime,
    );
  }

  getCurrentTVL(): Promise<bigint> {
    return this.bridgeContract.totalValueLocked();
  }

  async getTransactionDetails(txHash: string): Promise<TransactionData | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx || !receipt) return null;

      return {
        hash: tx.hash,
        blockNumber: tx.blockNumber || 0,
        timestamp:
          (await this.provider.getBlock(receipt.blockNumber))?.timestamp || 0,
        from: tx.from,
        to: tx.to || "",
        value: tx.value,
        gasUsed: receipt.gasUsed,
        gasPrice: tx.gasPrice,
        method: tx.data.slice(0, 10), // Function signature
      };
    } catch (error) {
      console.error(`Error getting transaction details for ${txHash}:`, error);
      return null;
    }
  }
}
