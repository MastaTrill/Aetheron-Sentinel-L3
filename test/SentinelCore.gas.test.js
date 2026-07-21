import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelCore Gas Usage Analysis', function () {
  let core;
  let owner;
  let ethers;

  // Threshold derived from HARDENING_CERTIFICATION.md and Keeper gas limits.
  // 1,000,000 provides a safe buffer for the 2,000,000 total loop limit.
  const MAX_GAS_RELEASE_HEARTBEAT = 1000000;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner] = await ethers.getSigners();

    // Transitioned from MockSentinelCore to production SentinelCore for finalized gas profiling.
    const SentinelCoreFactory = await ethers.getContractFactory('SentinelCore');
    core = await SentinelCoreFactory.deploy(owner.address);
    await core.waitForDeployment();
  });

  describe('releaseHeartbeat() Gas Performance', function () {
    it('should execute releaseHeartbeat within the 1.0M gas threshold (Average over 10 runs)', async function () {
      // Use the 5.00% Alpha target yield mentioned in recent logic fixes
      const targetYieldBps = 500;
      const RUNS = 10;
      let totalGasUsed = 0n;
      const gasResults = [];

      for (let i = 0; i < RUNS; i++) {
        // Reset state to ensure we measure a cold-to-warm or consistent transition
        await core.lockHeartbeat();

        const tx = await core.releaseHeartbeat(targetYieldBps);
        const receipt = await tx.wait();
        gasResults.push(receipt.gasUsed);
        totalGasUsed += receipt.gasUsed;
      }

      const averageGas = totalGasUsed / BigInt(RUNS);

      console.log(`\n      [Gas Report] releaseHeartbeat`);
      console.log(`      Average over ${RUNS} runs: ${averageGas.toString()} units`);

      // Variance Check: Ensure every run is within 5% of the average
      gasResults.forEach((runGas, index) => {
        const deviation = runGas > averageGas ? runGas - averageGas : averageGas - runGas;
        const percentDeviation = (Number(deviation) / Number(averageGas)) * 100;

        expect(percentDeviation).to.be.at.most(
          5,
          `Run ${index} gas (${runGas}) deviates from average by ${percentDeviation.toFixed(2)}%, exceeding 5% threshold`
        );
      });

      expect(averageGas).to.be.below(
        MAX_GAS_RELEASE_HEARTBEAT,
        `Critical: Average gas usage exceeds the allocated budget of ${MAX_GAS_RELEASE_HEARTBEAT}!`
      );
    });
  });
});
