/**
 * test/adversarial/FlashLoanGovernance.test.js
 *
 * Adversarial: flash-loan-boosted governance attack simulation against SentinelAgentPolicy.
 *
 * Core defense tested: the mandatory timelock delay between proposePolicy and executePolicy
 * makes it impossible to borrow governance power, propose, and execute atomically.
 * Tests validate all access-control and state-machine invariants without time manipulation
 * (which requires network.provider, unavailable in Hardhat 3's getOrCreate() mode).
 */

import { expect } from 'chai';
import { network } from 'hardhat';

const ONE_HOUR = 3600;
const FORTY_EIGHT_HOURS = 48 * ONE_HOUR;

describe('Adversarial: Flash-Loan Governance Attack (SentinelAgentPolicy)', function () {
  this.timeout(60_000);

  let policy;
  let ethers;
  let owner, attacker;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, attacker] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('SentinelAgentPolicy');
    policy = await Factory.deploy(owner.address, FORTY_EIGHT_HOURS);
    await policy.waitForDeployment();
  });

  it('rejects direct policy update from non-admin', async function () {
    await expect(
      policy.connect(attacker).setPolicy(1n, 0x3fn)
    ).to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
  });

  it('rejects direct policy update from OPERATOR_ROLE (insufficient privilege)', async function () {
    await policy.connect(owner).grantRole(await policy.OPERATOR_ROLE(), attacker.address);
    await expect(
      policy.connect(attacker).setPolicy(1n, 0x3fn)
    ).to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
  });

  it('flash-loan defense: policy proposed cannot be executed in the same block', async function () {
    await policy.connect(owner).proposePolicy(2n, 0x3fn);
    // Immediate execute must fail — timelock not expired.
    await expect(
      policy.connect(owner).executePolicy(2n)
    ).to.be.revertedWithCustomError(policy, 'TimelockNotExpired');
  });

  it('pending policy stored with correct executeAfter delay', async function () {
    await policy.connect(owner).proposePolicy(3n, 0x1n);
    const pending = await policy.getPendingPolicy(3n);
    expect(pending.exists).to.equal(true);
    // executeAfter must be at least FORTY_EIGHT_HOURS in the future.
    const now = BigInt(Math.floor(Date.now() / 1000));
    expect(pending.executeAfter).to.be.gte(now + BigInt(FORTY_EIGHT_HOURS) - 10n);
  });

  it('rejects ownership transfer by non-owner', async function () {
    await expect(
      policy.connect(attacker).transferOwnership(attacker.address)
    ).to.be.revertedWithCustomError(policy, 'OwnableUnauthorizedAccount');
  });

  it('rejects policy cancellation by non-admin', async function () {
    await policy.connect(owner).proposePolicy(4n, 0x1n);
    await expect(
      policy.connect(attacker).cancelPolicy(4n)
    ).to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
  });

  it('double-propose reverts (prevents proposal overwrite)', async function () {
    await policy.connect(owner).proposePolicy(6n, 0x1n);
    await expect(
      policy.connect(owner).proposePolicy(6n, 0x2n)
    ).to.be.revertedWithCustomError(policy, 'PolicyAlreadyPending');
  });

  it('cancelled policy cannot be executed (no pending entry)', async function () {
    await policy.connect(owner).proposePolicy(7n, 0x1n);
    await policy.connect(owner).cancelPolicy(7n);
    // Even without waiting for delay, cancelled policy gives NoPendingPolicy.
    await expect(
      policy.connect(owner).executePolicy(7n)
    ).to.be.revertedWithCustomError(policy, 'NoPendingPolicy');
  });

  it('contract has no payable fallback (no ETH-based attack surface)', async function () {
    // Sending ETH to the policy contract reverts.
    const policyAddress = await policy.getAddress();
    await expect(
      owner.sendTransaction({ to: policyAddress, value: 1n })
    ).to.be.revertedWithoutReason();
  });

  it('emergency pause blocks proposePolicy', async function () {
    await policy.connect(owner).emergencyPause();
    await expect(
      policy.connect(owner).proposePolicy(8n, 0x1n)
    ).to.be.revertedWithCustomError(policy, 'EnforcedPause');
  });
});
