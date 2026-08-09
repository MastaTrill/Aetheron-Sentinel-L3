/**
 * test/adversarial/MEVAttack.test.js
 *
 * Adversarial: front-running / sandwich attack simulations against SentinelInterceptor.
 * Uses ethers.provider for JSON-RPC calls (Hardhat 3 pattern).
 */

import { expect } from 'chai';
import { network } from 'hardhat';

describe('Adversarial: MEV / Front-Running Attack (SentinelInterceptor)', function () {
  this.timeout(60_000);

  let interceptor;
  let ethers;
  let owner, attacker, monitor;
  const ANOMALY_THRESHOLD = 80n;
  const TVL_THRESHOLD_ETH = 1000n * 10n ** 18n;
  const MAX_ANOMALIES_PER_BLOCK = 5;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, attacker, monitor] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('SentinelInterceptor');
    interceptor = await Factory.deploy(
      ANOMALY_THRESHOLD,
      TVL_THRESHOLD_ETH,
      false, // autonomous mode off
      owner.address
    );
    await interceptor.waitForDeployment();

    await interceptor.connect(owner).grantRole(await interceptor.MONITOR_ROLE(), monitor.address);
    await interceptor.connect(owner).addReporter(monitor.address);
  });

  it('blocks an unregistered caller from reporting anomalies', async function () {
    await expect(
      interceptor.connect(attacker).detectAnomaly(1, 90)
    ).to.be.revertedWithCustomError(interceptor, 'AccessControlUnauthorizedAccount');
  });

  it('blocks a MONITOR_ROLE holder that is not an authorizedReporter', async function () {
    await interceptor.connect(owner).grantRole(await interceptor.MONITOR_ROLE(), attacker.address);
    await expect(
      interceptor.connect(attacker).detectAnomaly(1, 90)
    ).to.be.revertedWith('Unauthorized reporter');
  });

  it('tracks anomaly count correctly for an authorised monitor', async function () {
    // Mine past any existing cooldown by sending a detectAnomaly that succeeds.
    await interceptor.connect(monitor).detectAnomaly(1, 10);
    const stats = await interceptor.getAnomalyStats();
    expect(stats.totalCount).to.be.gte(1n);
  });

  it('triggers autonomous pause after threshold-severity anomaly', async function () {
    await interceptor.connect(owner).toggleAutonomousMode(true);
    // A single anomaly at or above the threshold triggers auto-pause.
    await interceptor.connect(monitor).detectAnomaly(1, Number(ANOMALY_THRESHOLD));
    expect(await interceptor.paused()).to.equal(true);
  });

  it('rejects detectAnomaly when contract is paused', async function () {
    await interceptor.connect(owner).toggleAutonomousMode(true);
    await interceptor.connect(monitor).detectAnomaly(1, Number(ANOMALY_THRESHOLD));
    expect(await interceptor.paused()).to.equal(true);

    await expect(
      interceptor.connect(monitor).detectAnomaly(1, 90)
    ).to.be.revertedWithCustomError(interceptor, 'EnforcedPause');
  });

  it('prevents non-admin from unpausing after autonomous pause', async function () {
    await interceptor.connect(owner).toggleAutonomousMode(true);
    await interceptor.connect(monitor).detectAnomaly(1, Number(ANOMALY_THRESHOLD));

    await expect(
      interceptor.connect(attacker).emergencyUnpause()
    ).to.be.revertedWithCustomError(interceptor, 'AccessControlUnauthorizedAccount');
  });
});
