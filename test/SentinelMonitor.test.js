// test/SentinelMonitor.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelMonitor', function () {
  let monitor;
  let owner, other;

  // Stub contract addresses (no real contracts needed for authorization tests)
  let stubSentinel, stubBridge, stubCircuit;

  beforeEach(async function () {
    [owner, other, stubSentinel, stubBridge, stubCircuit] =
      await ethers.getSigners();

    const SentinelMonitor = await ethers.getContractFactory('SentinelMonitor');
    monitor = await SentinelMonitor.deploy(owner.address);
    await monitor.waitForDeployment();
  });

  describe('Contract authorization', function () {
    it('authorizes a contract address', async function () {
      await monitor.authorizeContract(stubSentinel.address);
      expect(await monitor.authorizedContracts(stubSentinel.address)).to.equal(
        true,
      );
    });

    it('rejects zero address authorization', async function () {
      await expect(
        monitor.authorizeContract(ethers.ZeroAddress),
      ).to.be.revertedWith('Invalid contract address');
    });

    it('reverts updateHealth when contracts not authorized', async function () {
      await expect(
        monitor.updateHealth(
          stubSentinel.address,
          stubBridge.address,
          stubCircuit.address,
        ),
      ).to.be.revertedWith('Sentinel not authorized');
    });
  });

  describe('Alert conditions', function () {
    it('sets default alert conditions on deploy', async function () {
      const highAnomalies = await monitor.alertConditions('high_anomalies');
      expect(highAnomalies.active).to.equal(true);
      expect(highAnomalies.threshold).to.equal(10);
      expect(highAnomalies.severity).to.equal(8);
    });

    it('allows owner to update alert conditions', async function () {
      await monitor.setAlertCondition(
        'high_anomalies',
        20,
        9,
        'Updated threshold',
      );
      const condition = await monitor.alertConditions('high_anomalies');
      expect(condition.threshold).to.equal(20);
      expect(condition.severity).to.equal(9);
    });
  });

  describe('Chain tracking', function () {
    it('adds tracked chain IDs', async function () {
      await monitor.addTrackedChain(137);
      await monitor.addTrackedChain(1);
      expect(await monitor.trackedChainIds(0)).to.equal(137);
      expect(await monitor.trackedChainIds(1)).to.equal(1);
    });

    it('rejects chain ID of zero', async function () {
      await expect(monitor.addTrackedChain(0)).to.be.revertedWith(
        'Invalid chain ID',
      );
    });
  });

  describe('isCriticalState', function () {
    it('returns true on initial deploy (TVL is 0 which is below threshold)', async function () {
      // bridgeTVL starts at 0 which is < low_tvl threshold of 1000 ether
      expect(await monitor.isCriticalState()).to.equal(true);
    });
  });

  describe('Access control', function () {
    it('reverts updateHealth when called by non-owner', async function () {
      await expect(
        monitor
          .connect(other)
          .updateHealth(
            stubSentinel.address,
            stubBridge.address,
            stubCircuit.address,
          ),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts addTrackedChain when called by non-owner', async function () {
      await expect(
        monitor.connect(other).addTrackedChain(1),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
