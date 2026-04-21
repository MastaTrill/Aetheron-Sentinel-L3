// test/SentinelCore.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelCore', function () {
  let core;
  let owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const SentinelCore = await ethers.getContractFactory('SentinelCore');
    core = await SentinelCore.deploy(owner.address);
    await core.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets owner correctly', async function () {
      expect(await core.owner()).to.equal(owner.address);
    });

    it('initialises with heartbeat inactive', async function () {
      expect(await core.heartbeatActive()).to.equal(false);
    });

    it('initialises targetYieldBps to BASELINE_YIELD_BPS', async function () {
      expect(await core.targetYieldBps()).to.equal(
        await core.BASELINE_YIELD_BPS(),
      );
    });

    it('stores a non-zero lastSyncTimestamp', async function () {
      expect(await core.lastSyncTimestamp()).to.be.gt(0n);
    });

    it('rejects zero address owner', async function () {
      const SentinelCore = await ethers.getContractFactory('SentinelCore');
      await expect(SentinelCore.deploy(ethers.ZeroAddress)).to.be.revertedWith(
        'SentinelCore: invalid owner',
      );
    });
  });

  describe('releaseHeartbeat', function () {
    it('activates heartbeat and sets targetYieldBps', async function () {
      await core.releaseHeartbeat(500);
      expect(await core.heartbeatActive()).to.equal(true);
      expect(await core.targetYieldBps()).to.equal(500n);
    });

    it('emits HeartbeatReleased and TelemetryReset events', async function () {
      await expect(core.releaseHeartbeat(500))
        .to.emit(core, 'HeartbeatReleased')
        .and.to.emit(core, 'TelemetryReset');
    });

    it('emits RebalanceHookFired via internal _fireDeFAIHooks', async function () {
      await expect(core.releaseHeartbeat(500)).to.emit(
        core,
        'RebalanceHookFired',
      );
    });

    it('reverts if heartbeat is already active', async function () {
      await core.releaseHeartbeat(500);
      await expect(core.releaseHeartbeat(600)).to.be.revertedWith(
        'SentinelCore: Heartbeat is already active',
      );
    });

    it('reverts if target does not exceed baseline (equal)', async function () {
      await expect(core.releaseHeartbeat(289)).to.be.revertedWith(
        'SentinelCore: Target must exceed baseline',
      );
    });

    it('reverts if target is below baseline', async function () {
      await expect(core.releaseHeartbeat(100)).to.be.revertedWith(
        'SentinelCore: Target must exceed baseline',
      );
    });

    it('reverts if called by non-owner', async function () {
      await expect(core.connect(other).releaseHeartbeat(500)).to.revert(ethers);
    });
  });

  describe('getHeartbeatState', function () {
    it('returns correct initial state', async function () {
      const [isActive, currentTarget, syncedAt] =
        await core.getHeartbeatState();
      expect(isActive).to.equal(false);
      expect(currentTarget).to.equal(289n);
      expect(syncedAt).to.be.gt(0n);
    });

    it('returns updated state after releaseHeartbeat', async function () {
      await core.releaseHeartbeat(500);
      const [isActive, currentTarget] = await core.getHeartbeatState();
      expect(isActive).to.equal(true);
      expect(currentTarget).to.equal(500n);
    });
  });

  describe('lockHeartbeat', function () {
    it('resets heartbeat to baseline after activation', async function () {
      await core.releaseHeartbeat(500);
      await core.lockHeartbeat();
      expect(await core.heartbeatActive()).to.equal(false);
      expect(await core.targetYieldBps()).to.equal(289n);
    });

    it('emits TelemetryReset on lock', async function () {
      await core.releaseHeartbeat(500);
      await expect(core.lockHeartbeat()).to.emit(core, 'TelemetryReset');
    });

    it('can be re-released after lock', async function () {
      await core.releaseHeartbeat(500);
      await core.lockHeartbeat();
      await core.releaseHeartbeat(450);
      expect(await core.heartbeatActive()).to.equal(true);
      expect(await core.targetYieldBps()).to.equal(450n);
    });

    it('reverts if called by non-owner', async function () {
      await core.releaseHeartbeat(500);
      await expect(core.connect(other).lockHeartbeat()).to.revert(ethers);
    });
  });
});
