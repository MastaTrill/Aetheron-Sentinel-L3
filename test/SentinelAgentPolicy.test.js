/**
 * test/SentinelAgentPolicy.test.js
 *
 * Comprehensive test suite for SentinelAgentPolicy.sol
 */

import { expect } from 'chai';
import { network } from 'hardhat';

const ONE_HOUR = 3600;

describe('SentinelAgentPolicy', function () {
  this.timeout(60_000);

  let policy;
  let ethers;
  let owner, operator, attacker, newOwner;

  const ACTION_SWAP       = 1n << 0n;
  const ACTION_MULTI_SWAP = 1n << 1n;
  const ACTION_LIQUIDITY  = 1n << 2n;
  const ACTION_BRIDGE     = 1n << 3n;
  const ACTION_GOVERNANCE = 1n << 4n;
  const ACTION_EMERGENCY  = 1n << 5n;
  const VALID_MASK        = ACTION_SWAP | ACTION_MULTI_SWAP | ACTION_LIQUIDITY
    | ACTION_BRIDGE | ACTION_GOVERNANCE | ACTION_EMERGENCY;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, operator, attacker, newOwner] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('SentinelAgentPolicy');
    policy = await Factory.deploy(owner.address, ONE_HOUR);
    await policy.waitForDeployment();
  });

  // ── Construction ────────────────────────────────────────────────────────────

  describe('construction', function () {
    it('sets owner correctly', async function () {
      expect(await policy.owner()).to.equal(owner.address);
    });

    it('grants DEFAULT_ADMIN_ROLE to owner', async function () {
      expect(await policy.hasRole(ethers.ZeroHash, owner.address)).to.equal(true);
    });

    it('grants OPERATOR_ROLE to owner', async function () {
      const role = await policy.OPERATOR_ROLE();
      expect(await policy.hasRole(role, owner.address)).to.equal(true);
    });

    it('stores the configured minDelay', async function () {
      expect(await policy.minDelay()).to.equal(ONE_HOUR);
    });

    it('reverts construction with delay below minimum', async function () {
      const Factory = await ethers.getContractFactory('SentinelAgentPolicy');
      await expect(
        Factory.deploy(owner.address, ONE_HOUR - 1)
      ).to.be.revertedWithCustomError(policy, 'InvalidMinDelay');
    });
  });

  // ── Action mask constants ────────────────────────────────────────────────────

  describe('action mask constants', function () {
    it('ACTION_SWAP is bit 0', async function () {
      expect(await policy.ACTION_SWAP()).to.equal(ACTION_SWAP);
    });

    it('ACTION_MULTI_SWAP is bit 1', async function () {
      expect(await policy.ACTION_MULTI_SWAP()).to.equal(ACTION_MULTI_SWAP);
    });

    it('VALID_MASK matches expected combined bits', async function () {
      expect(await policy.VALID_MASK()).to.equal(VALID_MASK);
    });
  });

  // ── setPolicy (instant, admin-only) ─────────────────────────────────────────

  describe('setPolicy', function () {
    it('owner can set a valid policy instantly', async function () {
      await policy.connect(owner).setPolicy(1n, ACTION_SWAP);
      const p = await policy.getPolicy(1n);
      expect(p.actionMask).to.equal(ACTION_SWAP);
      expect(p.active).to.equal(true);
    });

    it('emits PolicyExecuted event', async function () {
      await expect(policy.connect(owner).setPolicy(1n, ACTION_SWAP))
        .to.emit(policy, 'PolicyExecuted');
    });

    it('reverts for zero mask', async function () {
      await expect(policy.connect(owner).setPolicy(1n, 0n))
        .to.be.revertedWithCustomError(policy, 'InvalidActionMask');
    });

    it('reverts for mask with reserved bits', async function () {
      const reserved = VALID_MASK + (1n << 8n);
      await expect(policy.connect(owner).setPolicy(1n, reserved))
        .to.be.revertedWithCustomError(policy, 'InvalidActionMask');
    });

    it('reverts for non-admin caller', async function () {
      await expect(policy.connect(attacker).setPolicy(1n, ACTION_SWAP))
        .to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── proposePolicy ───────────────────────────────────────────────────────────

  describe('proposePolicy', function () {
    it('queues a pending policy with correct executeAfter', async function () {
      await policy.connect(owner).proposePolicy(10n, ACTION_MULTI_SWAP);
      const pending = await policy.getPendingPolicy(10n);
      expect(pending.exists).to.equal(true);
      expect(pending.actionMask).to.equal(ACTION_MULTI_SWAP);
      expect(pending.executeAfter).to.be.gt(0n);
    });

    it('emits PolicyProposed', async function () {
      await expect(policy.connect(owner).proposePolicy(10n, ACTION_SWAP))
        .to.emit(policy, 'PolicyProposed');
    });

    it('reverts when a proposal is already pending for the same agentId', async function () {
      await policy.connect(owner).proposePolicy(11n, ACTION_SWAP);
      await expect(policy.connect(owner).proposePolicy(11n, ACTION_MULTI_SWAP))
        .to.be.revertedWithCustomError(policy, 'PolicyAlreadyPending');
    });

    it('reverts for non-admin', async function () {
      await expect(policy.connect(attacker).proposePolicy(10n, ACTION_SWAP))
        .to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── executePolicy ───────────────────────────────────────────────────────────

  describe('executePolicy', function () {
    beforeEach(async function () {
      await policy.connect(owner).proposePolicy(20n, ACTION_BRIDGE);
    });

    it('reverts before the delay has elapsed (same-block attack)', async function () {
      await expect(policy.connect(owner).executePolicy(20n))
        .to.be.revertedWithCustomError(policy, 'TimelockNotExpired');
    });

    it('reverts when no pending policy exists', async function () {
      await expect(policy.connect(owner).executePolicy(999n))
        .to.be.revertedWithCustomError(policy, 'NoPendingPolicy');
    });

    it('reverts for non-admin caller', async function () {
      await expect(policy.connect(attacker).executePolicy(20n))
        .to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── cancelPolicy ────────────────────────────────────────────────────────────

  describe('cancelPolicy', function () {
    it('allows admin to cancel a pending proposal', async function () {
      await policy.connect(owner).proposePolicy(30n, ACTION_GOVERNANCE);
      await expect(policy.connect(owner).cancelPolicy(30n))
        .to.emit(policy, 'PolicyCancelled')
        .withArgs(30n);
    });

    it('cancelled policy cannot be executed (NoPendingPolicy)', async function () {
      await policy.connect(owner).proposePolicy(31n, ACTION_GOVERNANCE);
      await policy.connect(owner).cancelPolicy(31n);
      // Cancelled = no pending entry, even if we tried to execute.
      await expect(policy.connect(owner).executePolicy(31n))
        .to.be.revertedWithCustomError(policy, 'NoPendingPolicy');
    });

    it('reverts for non-admin', async function () {
      await policy.connect(owner).proposePolicy(32n, ACTION_SWAP);
      await expect(policy.connect(attacker).cancelPolicy(32n))
        .to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── revokePolicy ────────────────────────────────────────────────────────────

  describe('revokePolicy', function () {
    it('deactivates an active policy', async function () {
      await policy.connect(owner).setPolicy(40n, ACTION_SWAP);
      await policy.connect(owner).revokePolicy(40n);
      const p = await policy.getPolicy(40n);
      expect(p.active).to.equal(false);
    });

    it('emits PolicyRevoked', async function () {
      await policy.connect(owner).setPolicy(41n, ACTION_SWAP);
      await expect(policy.connect(owner).revokePolicy(41n))
        .to.emit(policy, 'PolicyRevoked')
        .withArgs(41n);
    });
  });

  // ── isActionPermitted ────────────────────────────────────────────────────────

  describe('isActionPermitted', function () {
    it('returns true for a permitted action', async function () {
      await policy.connect(owner).setPolicy(50n, ACTION_SWAP | ACTION_MULTI_SWAP);
      expect(await policy.isActionPermitted(50n, ACTION_SWAP)).to.equal(true);
      expect(await policy.isActionPermitted(50n, ACTION_MULTI_SWAP)).to.equal(true);
    });

    it('returns false for a non-permitted action', async function () {
      await policy.connect(owner).setPolicy(51n, ACTION_SWAP);
      expect(await policy.isActionPermitted(51n, ACTION_BRIDGE)).to.equal(false);
    });

    it('returns false when policy is inactive', async function () {
      await policy.connect(owner).setPolicy(52n, ACTION_SWAP);
      await policy.connect(owner).revokePolicy(52n);
      expect(await policy.isActionPermitted(52n, ACTION_SWAP)).to.equal(false);
    });
  });

  // ── Emergency pause ──────────────────────────────────────────────────────────

  describe('emergency pause', function () {
    it('blocks proposePolicy when paused', async function () {
      await policy.connect(owner).emergencyPause();
      await expect(policy.connect(owner).proposePolicy(60n, ACTION_SWAP))
        .to.be.revertedWithCustomError(policy, 'EnforcedPause');
    });

    it('blocks setPolicy when paused', async function () {
      await policy.connect(owner).emergencyPause();
      await expect(policy.connect(owner).setPolicy(61n, ACTION_SWAP))
        .to.be.revertedWithCustomError(policy, 'EnforcedPause');
    });

    it('allows reads when paused', async function () {
      await policy.connect(owner).setPolicy(62n, ACTION_SWAP);
      await policy.connect(owner).emergencyPause();
      expect(await policy.isActionPermitted(62n, ACTION_SWAP)).to.equal(true);
    });
  });

  // ── Ownership transfer ────────────────────────────────────────────────────────

  describe('ownership transfer', function () {
    it('migrates DEFAULT_ADMIN_ROLE and OPERATOR_ROLE to new owner', async function () {
      await policy.connect(owner).transferOwnership(newOwner.address);
      const opRole = await policy.OPERATOR_ROLE();
      expect(await policy.hasRole(ethers.ZeroHash, newOwner.address)).to.equal(true);
      expect(await policy.hasRole(opRole, newOwner.address)).to.equal(true);
    });

    it('revokes roles from previous owner', async function () {
      await policy.connect(owner).transferOwnership(newOwner.address);
      const opRole = await policy.OPERATOR_ROLE();
      expect(await policy.hasRole(ethers.ZeroHash, owner.address)).to.equal(false);
      expect(await policy.hasRole(opRole, owner.address)).to.equal(false);
    });
  });
});
