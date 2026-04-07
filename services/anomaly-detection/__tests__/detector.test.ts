import { AnomalyDetector } from "../dist/detector.js";
import { BlockchainDataIngestion } from "../dist/blockchain-data.js";

// Mock BlockchainDataIngestion
const mockIngestion = {
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  getCurrentTVL: jest.fn(() => Promise.resolve(1000n)),
  on: jest.fn(), // event emitter
  emit: jest.fn(),
} as unknown as BlockchainDataIngestion;

describe("AnomalyDetector", () => {
  let detector: AnomalyDetector;
  const provider = {} as any; // simple mock provider

  const config = {
    bridgeAddress: "0xTestBridge",
    sentinelAddress: "0xTestSentinel",
    anomalyOracleAddress: "0xTestOracle",
    tvlSpikeThreshold: 10,
    withdrawalWindow: 60,
    monitoringInterval: 1000,
    rpcUrl: "http://localhost:8545",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new AnomalyDetector(provider, config, mockIngestion);
  });

  test("should initialize with correct config", () => {
    // The detector is created without throwing
    expect(detector).toBeDefined();
  });

  test("should start and stop without errors", async () => {
    await detector.start();
    expect(mockIngestion.start).toHaveBeenCalled();
    await detector.stop();
    expect(mockIngestion.stop).toHaveBeenCalled();
  });

  test("should calculate performance metrics", () => {
    const metrics = detector.getPerformanceMetrics();
    expect(metrics).toHaveProperty("tvlFetchCount");
    expect(metrics).toHaveProperty("alertsSent");
  });
});
