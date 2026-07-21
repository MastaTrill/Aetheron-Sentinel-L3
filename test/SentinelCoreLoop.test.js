// test/SentinelCoreLoop.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelCoreLoop Configuration', function () {
  let coreLoop, mockGuard, mockYield;
  let owner, other;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, other] = await ethers.getSigners();

    const MockGuard = await ethers.getContractFactory('MockQuantumGuard');
    mockGuard = await MockGuard.deploy();

    const MockYield = await ethers.getContractFactory('MockYieldMaximizer');
    mockYield = await MockYield.deploy();

    const SentinelCoreLoop = await ethers.getContractFactory('SentinelCoreLoop');
    coreLoop = await SentinelCoreLoop.deploy(owner.address);

    await coreLoop.initializeCoreComponents(mockGuard.target, mockYield.target);
  });

  describe('Calibration Interval', function () {
    it('should initialize with a 24-hour interval', async function () {
      expect(await coreLoop.s_calibrationInterval()).to.equal(24 * 60 * 60);
    });

    it('should allow owner to update the interval', async function () {
      const newInterval = 12 * 60 * 60; // 12 hours
      await expect(coreLoop.setCalibrationInterval(newInterval))
        .to.emit(coreLoop, 'CalibrationIntervalUpdated')
        .withArgs(newInterval);

      expect(await coreLoop.s_calibrationInterval()).to.equal(newInterval);
    });

    it('should revert if non-owner tries to update interval', async function () {
      await expect(coreLoop.connect(other).setCalibrationInterval(3600))
        .to.be.revertedWithCustomError(coreLoop, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Gas Performance', function () {
    it('executeThreatResponse should be gas efficient', async function () {
      const threatId = ethers.id('test-threat');

      // Authorize owner as monitor for testing
      await coreLoop.setMonitor(owner.address, true);

      // First call (cold storage slots)
      const tx1 = await coreLoop.executeThreatResponse(threatId);
      const receipt1 = await tx1.wait();

      // Second call (warm storage slots)
      const tx2 = await coreLoop.executeThreatResponse(threatId);
      const receipt2 = await tx2.wait();

      expect(receipt1.gasUsed).to.be.gt(0n);
      expect(receipt2.gasUsed).to.be.lt(receipt1.gasUsed);

      console.log(`\tGas used (cold): ${receipt1.gasUsed}`);
      console.log(`\tGas used (warm): ${receipt2.gasUsed}`);
    });

    it('batch monitor authorization should be significantly cheaper than single calls', async function () {
      const monitorCount = 5;
      const monitors = Array.from({ length: monitorCount }, () => ethers.Wallet.createRandom().address);

      // Measure Single Calls
      let totalSingleGas = 0n;
      for (const monitor of monitors) {
        const tx = await coreLoop.setMonitor(monitor, true);
        const receipt = await tx.wait();
        totalSingleGas += receipt.gasUsed;
      }

      // Measure Batch Call with fresh addresses to ensure comparable SLOAD/SSTORE costs
      const batchMonitors = Array.from({ length: monitorCount }, () => ethers.Wallet.createRandom().address);
      const txBatch = await coreLoop.setMonitors(batchMonitors, true);
      const receiptBatch = await txBatch.wait();

      console.log(`\tGas for ${monitorCount} single authorizations: ${totalSingleGas}`);
      console.log(`\tGas for 1 batch authorization (${monitorCount} addresses): ${receiptBatch.gasUsed}`);

      expect(receiptBatch.gasUsed).to.be.lt(totalSingleGas);
    });

    it('should report gas impact and emit failure events when components revert', async function () {
      await coreLoop.setKeeper(owner.address, true);
      await coreLoop.setAnomalyDecayPeriod(60 * 60);

      // Measure gas with successful execution
      const txSuccess = await coreLoop.executeCoreLoop();
      const receiptSuccess = await txSuccess.wait();

      // Trigger failure in Yield Maximizer
      await mockYield.setShouldRevert(true);

      // Measure gas with failure (try-catch overhead + event emission)
      const txFailure = await coreLoop.executeCoreLoop();
      const receiptFailure = await txFailure.wait();

      // Verify failure event was emitted
      const filter = coreLoop.filters.ComponentExecutionFailed();
      const events = await coreLoop.queryFilter(filter, receiptFailure.blockNumber);
      expect(events.length).to.be.gt(0);
      expect(events[0].args.component).to.equal(mockYield.target);

      console.log(`\tGas used (Success): ${receiptSuccess.gasUsed}`);
      console.log(`\tGas used (Failure): ${receiptFailure.gasUsed}`);

      // Revert logic usually costs less gas than successful execution,
      // but try-catch logic + bytes capturing + event emission adds marginal overhead.
      // We ensure the failure path remains predictable.
      expect(receiptFailure.gasUsed).to.be.lt(receiptSuccess.gasUsed + 5000n);
    });
  });

  describe('Security Models Integration', function () {
    let mockOracle, mockModel;
    
    beforeEach(async function () {
      // Mock Oracle
      const MockOracle = await ethers.getContractFactory("MockCrossChainOracle");
      mockOracle = await MockOracle.deploy();
      
      // Mock Model
      const MockModel = await ethers.getContractFactory("MockPredictiveModel");
      mockModel = await MockModel.deploy();

      await coreLoop.setCrossChainOracle(mockOracle.target);
      await coreLoop.setPredictiveModel(mockModel.target);
      
      await coreLoop.setKeeper(owner.address, true);
    });

    it('should revert executeCoreLoop if global threat level is high', async function () {
      await mockOracle.setGlobalThreatLevel(71);
      await expect(coreLoop.executeCoreLoop())
        .to.be.revertedWithCustomError(coreLoop, 'SentinelCoreLoop__SecurityRiskDetected');
    });

    it('should revert executeCoreLoop if AI trust score is low', async function () {
      await mockModel.setTrustScore(299);
      await expect(coreLoop.executeCoreLoop())
        .to.be.revertedWithCustomError(coreLoop, 'SentinelCoreLoop__SecurityRiskDetected');
    });
    
    it('should succeed if threat is low and trust score is high', async function () {
      await mockOracle.setGlobalThreatLevel(50);
      await mockModel.setTrustScore(800);
      await coreLoop.executeCoreLoop();
    });
  });
});