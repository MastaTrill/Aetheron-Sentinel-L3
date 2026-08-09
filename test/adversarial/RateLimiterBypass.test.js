/**
 * test/adversarial/RateLimiterBypass.test.js
 *
 * Adversarial: attempts to bypass RateLimiter.
 * Uses only access-control and state assertions (no evm_mine needed).
 */

import { expect } from 'chai';
import { network } from 'hardhat';

describe('Adversarial: RateLimiter Bypass Attempts', function () {
  this.timeout(60_000);

  let rateLimiter;
  let ethers;
  let owner, operator, caller, attacker;
  const TEST_CHAIN_ID = 8453n;
  const LIMIT = 100n * 10n ** 18n; // 100 ETH in wei

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, operator, caller, attacker] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('RateLimiter');
    rateLimiter = await Factory.deploy(owner.address);
    await rateLimiter.waitForDeployment();

    await rateLimiter.connect(owner).grantRole(await rateLimiter.OPERATOR_ROLE(), operator.address);
    const callerRole = await rateLimiter.CALLER_ROLE();
    await rateLimiter.connect(owner).grantRole(callerRole, caller.address);
    await rateLimiter.connect(operator).updateRateLimit(TEST_CHAIN_ID, LIMIT);
  });

  it('rejects withdrawal from address without CALLER_ROLE', async function () {
    await expect(
      rateLimiter.connect(attacker).processWithdrawal(attacker.address, 1n, TEST_CHAIN_ID)
    ).to.be.revertedWithCustomError(rateLimiter, 'AccessControlUnauthorizedAccount');
  });

  it('rejects withdrawal that exceeds chain limit in a single call', async function () {
    await expect(
      rateLimiter.connect(caller).processWithdrawal(attacker.address, LIMIT + 1n, TEST_CHAIN_ID)
    ).to.be.revertedWith('Rate limit exceeded');
  });

  it('rejects additional withdrawal after limit is exhausted', async function () {
    // Use up the entire limit.
    await rateLimiter.connect(caller).processWithdrawal(attacker.address, LIMIT, TEST_CHAIN_ID);

    // Any further withdrawal within the same window should fail.
    await expect(
      rateLimiter.connect(caller).processWithdrawal(attacker.address, 1n, TEST_CHAIN_ID)
    ).to.be.revertedWith('Rate limit exceeded');
  });

  it('attacker cannot raise chain limit (lacks OPERATOR_ROLE)', async function () {
    await expect(
      rateLimiter.connect(attacker).updateRateLimit(TEST_CHAIN_ID, LIMIT * 2n)
    ).to.be.revertedWithCustomError(rateLimiter, 'AccessControlUnauthorizedAccount');
  });

  it('rejects role escalation from CALLER_ROLE to OPERATOR_ROLE', async function () {
    await expect(
      rateLimiter.connect(caller).grantRole(await rateLimiter.OPERATOR_ROLE(), caller.address)
    ).to.be.revertedWithCustomError(rateLimiter, 'AccessControlUnauthorizedAccount');
  });

  it('rejects withdrawal when contract is paused', async function () {
    await rateLimiter.connect(owner).emergencyPause();
    await expect(
      rateLimiter.connect(caller).processWithdrawal(attacker.address, 1n, TEST_CHAIN_ID)
    ).to.be.revertedWithCustomError(rateLimiter, 'EnforcedPause');
  });

  it('tracks currentUsage correctly after a partial withdrawal', async function () {
    const half = LIMIT / 2n;
    await rateLimiter.connect(caller).processWithdrawal(attacker.address, half, TEST_CHAIN_ID);
    const usage = await rateLimiter.currentUsage(TEST_CHAIN_ID);
    expect(usage).to.equal(half);
  });
});
