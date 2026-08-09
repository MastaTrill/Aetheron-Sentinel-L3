/**
 * test/adversarial/CircuitBreakerDOS.test.js
 *
 * Adversarial: DOS attempts on CircuitBreaker's pause/unpause lifecycle.
 */

import { expect } from 'chai';
import { network } from 'hardhat';

describe('Adversarial: CircuitBreaker DOS / State Manipulation', function () {
  this.timeout(60_000);

  let circuitBreaker;
  let ethers;
  let owner, operator, monitor, attacker;
  const CHAIN_ID = 8453n;
  const FAILURE_THRESHOLD = 5;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, operator, monitor, attacker] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('CircuitBreaker');
    circuitBreaker = await Factory.deploy(owner.address);
    await circuitBreaker.waitForDeployment();

    await circuitBreaker.connect(owner).grantRole(await circuitBreaker.OPERATOR_ROLE(), operator.address);
    await circuitBreaker.connect(owner).grantRole(await circuitBreaker.MONITOR_ROLE(), monitor.address);
  });

  it('rejects emergencyPause from non-admin', async function () {
    await expect(
      circuitBreaker.connect(attacker).emergencyPause()
    ).to.be.revertedWithCustomError(circuitBreaker, 'AccessControlUnauthorizedAccount');
  });

  it('rejects emergencyUnpause from non-admin', async function () {
    await circuitBreaker.connect(owner).emergencyPause();
    await expect(
      circuitBreaker.connect(attacker).emergencyUnpause()
    ).to.be.revertedWithCustomError(circuitBreaker, 'AccessControlUnauthorizedAccount');
  });

  it('rejects recordFailure from address without MONITOR_ROLE', async function () {
    await expect(
      circuitBreaker.connect(attacker).recordFailure(CHAIN_ID, 5)
    ).to.be.revertedWithCustomError(circuitBreaker, 'AccessControlUnauthorizedAccount');
  });

  it('opens circuit after FAILURE_THRESHOLD failures', async function () {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 5);
    }
    const [state] = await circuitBreaker.getCircuitStats(CHAIN_ID);
    expect(state).to.equal(1n); // OPEN = 1
  });

  it('opens circuit immediately on high-severity failure (>= 8)', async function () {
    await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 8);
    const [state] = await circuitBreaker.getCircuitStats(CHAIN_ID);
    expect(state).to.equal(1n); // OPEN = 1
  });

  it('transitions to HALF_OPEN after first success on an OPEN circuit', async function () {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 5);
    }
    // recordSuccess on OPEN → HALF_OPEN immediately.
    await circuitBreaker.connect(monitor).recordSuccess(CHAIN_ID);
    const [state] = await circuitBreaker.getCircuitStats(CHAIN_ID);
    expect(state).to.equal(2n); // HALF_OPEN = 2
  });

  it('closes circuit after RECOVERY_ATTEMPTS successes in HALF_OPEN', async function () {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 5);
    }
    // First success → HALF_OPEN (halfOpenSuccessCount reset to 0).
    await circuitBreaker.connect(monitor).recordSuccess(CHAIN_ID);
    // RECOVERY_ATTEMPTS = 3; each success in HALF_OPEN increments the counter.
    await circuitBreaker.connect(monitor).recordSuccess(CHAIN_ID); // count = 1
    await circuitBreaker.connect(monitor).recordSuccess(CHAIN_ID); // count = 2
    await circuitBreaker.connect(monitor).recordSuccess(CHAIN_ID); // count = 3 → CLOSED
    const [state] = await circuitBreaker.getCircuitStats(CHAIN_ID);
    expect(state).to.equal(0n); // CLOSED = 0
  });

  it('blocks recordFailure when globally paused', async function () {
    await circuitBreaker.connect(owner).emergencyPause();
    await expect(
      circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 5)
    ).to.be.revertedWithCustomError(circuitBreaker, 'EnforcedPause');
  });

  it('blocks recordSuccess when globally paused', async function () {
    await circuitBreaker.connect(owner).emergencyPause();
    await expect(
      circuitBreaker.connect(monitor).recordSuccess(CHAIN_ID)
    ).to.be.revertedWithCustomError(circuitBreaker, 'EnforcedPause');
  });

  it('rejects role escalation from monitor to admin', async function () {
    await expect(
      circuitBreaker.connect(monitor).grantRole(await circuitBreaker.OPERATOR_ROLE(), attacker.address)
    ).to.be.revertedWithCustomError(circuitBreaker, 'AccessControlUnauthorizedAccount');
  });
});
