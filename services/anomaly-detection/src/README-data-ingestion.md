# Blockchain Data Ingestion Service

Real-time blockchain data ingestion service for anomaly detection, replacing mock data with actual on-chain data.

## Features

- **Real-time TVL Monitoring**: Fetches TVL from bridge contracts at each block
- **Event Streaming**: Listens for bridge events (TokensBridged, TokensUnbridged)
- **Transaction Analysis**: Monitors large transactions across the network
- **Historical Data**: Backfills data from specified start block
- **Event-Driven Architecture**: Emits events for anomaly detection processing

## Configuration

```typescript
interface DataIngestionConfig {
  rpcUrl: string; // Ethereum RPC endpoint
  bridgeAddress: string; // Bridge contract address
  startBlock?: number; // Block to start historical data from
  batchSize?: number; // Blocks to process per batch (default: 1000)
  pollInterval?: number; // Polling interval in ms (default: 12000)
}
```

## Data Sources

### TVL Data

- Fetched from `bridge.totalValueLocked()` at regular intervals
- Stored with block number and timestamp
- Maintains rolling history of last 1000 data points

### Bridge Events

- `TokensBridged`: User bridge transactions
- `TokensUnbridged`: Relayer completion transactions
- Includes sender, amount, destination chain, recipient

### Large Transactions

- Transactions with value > 1 ETH (historical) or > 10 ETH (real-time)
- Includes gas usage, gas price, method signatures

## Integration with Anomaly Detection

The data ingestion service feeds directly into the anomaly detector:

```typescript
// TVL updates trigger spike detection
dataIngestion.on("tvlUpdate", (tvlData) => {
  detector.processTVLUpdate(tvlData);
});

// Bridge events trigger withdrawal analysis
dataIngestion.on("bridgeEvent", (event) => {
  detector.processBridgeEvent(event);
});
```

## Usage

```typescript
import { BlockchainDataIngestion } from "./blockchain-data";

const ingestion = new BlockchainDataIngestion({
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
  bridgeAddress: "0x...",
  startBlock: 18000000, // Start from recent block
});

ingestion.start();

// Listen for data
ingestion.on("tvlUpdate", (data) => console.log("TVL:", data));
ingestion.on("bridgeEvent", (event) => console.log("Bridge event:", event));

// Get historical data
const tvlHistory = ingestion.getTVLHistory(24); // Last 24 hours
const bridgeEvents = ingestion.getBridgeEvents(24);
```

## Performance

- Processes ~1000 blocks per batch for historical data
- Real-time processing with 12-second polling interval
- Maintains efficient memory usage with rolling data windows
- Event-driven architecture minimizes polling overhead

## Error Handling

- Automatic retry on RPC failures
- Graceful degradation when contract calls fail
- Comprehensive logging for debugging
- Circuit breaker pattern for unstable RPC connections

## Environment Variables

- `RPC_URL`: Ethereum RPC endpoint
- `BRIDGE_ADDRESS`: Bridge contract address to monitor
- `START_BLOCK`: Block number to begin historical data ingestion
