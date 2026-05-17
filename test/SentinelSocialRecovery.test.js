// test/SentinelSocialRecovery.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

/**
 * Find an approvalProof value whose on-chain hash passes the 90%-gate:
 *   uint256(keccak256(abi.encodePacked(guardian, requestId, proof))) % 100 < 90
 */
function findValidProof(guardianAddr, requestId, ethers) {
  for (let i = 0; i < 500; i++) {
    const proof = ethers.hexlify(ethers.toUtf8Bytes(`proof_${i}`));
    const packed = ethers.concat([guardianAddr, requestId, proof]);
    const h = ethers.keccak256(packed);
    if (BigInt(h) % 100n < 90n) return proof;
  }
  throw new Error('No valid proof found in 500 attempts');
}

describe('SentinelSocialRecovery', function () {
  let recovery, zkIdentity;
  let owner, account, guardian1, guardian2, guardian3, newOwner, stranger;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, account, guardian1, guardian2, guardian3, newOwner, stranger] =
      await ethers.getSigners();

    // SentinelSocialRecovery requires a zkIdentityContract address (any non-zero is fine
    // because _isValidZKIdentity only checks account != address(0))
    const SentinelSocialRecovery = await ethers.getContractFactory('SentinelSocialRecovery');
    recovery = await SentinelSocialRecovery.deploy(
      owner.address, // zkIdentityContract (placeholder)
      owner.address
    );
    await recovery.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets owner correctly', async function () {
      expect(await recovery.owner()).to.equal(owner.address);
    });

    it('stores zkIdentityContract address', async function () {
      expect(await recovery.zkIdentityContract()).to.equal(owner.address);
    });

    it('rejects zero owner', async function () {
      const SentinelSocialRecovery = await ethers.getContractFactory('SentinelSocialRecovery');
      // OZ's Ownable throws custom error when owner is zero
      await expect(
        SentinelSocialRecovery.deploy(owner.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(SentinelSocialRecovery, 'OwnableInvalidOwner');
    });
  });

  describe('constants', function () {
    it('MIN_GUARDIANS is 3', async function () {
      expect(await recovery.MIN_GUARDIANS()).to.equal(3n);
    });

    it('MAX_GUARDIANS is 10', async function () {
      expect(await recovery.MAX_GUARDIANS()).to.equal(10n);
    });

    it('MIN_RECOVERY_DELAY is 0', async function () {
      expect(await recovery.MIN_RECOVERY_DELAY()).to.equal(0n);
    });
  });

  describe('configureRecovery', function () {
    const delay = 2 * 24 * 60 * 60; // 2 days

    it('configures recovery successfully with valid guardians', async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);

      const [guardianCount, threshold, recoveryDelay, isActive] = await recovery.getRecoveryConfig(
        account.address
      );
      expect(guardianCount).to.equal(3n);
      expect(threshold).to.equal(2n);
      expect(recoveryDelay).to.equal(BigInt(delay));
      expect(isActive).to.equal(true);
    });

    it('emits RecoveryConfigured event', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay)
      )
        .to.emit(recovery, 'RecoveryConfigured')
        .withArgs(account.address, 3n, 2n);
    });

    it('reverts with too few guardians (< 3)', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery([guardian1.address, guardian2.address], 1, delay)
      ).to.be.revertedWith('Invalid guardian count');
    });

    it('reverts with threshold = 0', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 0, delay)
      ).to.be.revertedWith('Invalid threshold');
    });

    it('reverts with threshold > guardian count', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 4, delay)
      ).to.be.revertedWith('Invalid threshold');
    });

    it('does not revert with recovery delay of 1 hour', async function () {
      await recovery.connect(account).configureRecovery(
        [guardian1.address, guardian2.address, guardian3.address],
        2,
        3600 // 1 hour
      );
    });

    it('reverts if already configured', async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);
      await expect(
        recovery
          .connect(account)
          .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay)
      ).to.be.revertedWith('Recovery already configured');
    });

    it('confirms configured guardians via isGuardian', async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);
      expect(await recovery.isGuardian(account.address, guardian1.address)).to.equal(true);
      expect(await recovery.isGuardian(account.address, stranger.address)).to.equal(false);
    });
  });

  describe('requestRecovery', function () {
    const delay = 2 * 24 * 60 * 60;

    beforeEach(async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);
    });

    it('creates a recovery request and returns a requestId', async function () {
      const tx = await recovery.connect(account).requestRecovery(newOwner.address, '0x1234');
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === 'RecoveryRequested');
      expect(event).to.not.be.undefined;
    });

    it('emits RecoveryRequested event', async function () {
      await expect(recovery.connect(account).requestRecovery(newOwner.address, '0x1234')).to.emit(
        recovery,
        'RecoveryRequested'
      );
    });

    it('reverts if recovery not configured', async function () {
      await expect(
        recovery.connect(stranger).requestRecovery(newOwner.address, '0x1234')
      ).to.be.revertedWith('Recovery not configured');
    });

    it('reverts if newOwner is the zero address', async function () {
      await expect(
        recovery.connect(account).requestRecovery(ethers.ZeroAddress, '0x1234')
      ).to.be.revertedWith('Invalid new owner');
    });

    it('reverts if newOwner is same as caller', async function () {
      await expect(
        recovery.connect(account).requestRecovery(account.address, '0x1234')
      ).to.be.revertedWith('Invalid new owner');
    });
  });

  describe('cancelRecovery', function () {
    const delay = 2 * 24 * 60 * 60;

    it('account owner can cancel a pending request', async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);

      const tx = await recovery.connect(account).requestRecovery(newOwner.address, '0x1234');
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === 'RecoveryRequested');
      const requestId = event.args[0];

      // Cancel should not revert
      await recovery.connect(account).cancelRecovery(requestId);
    });

    it('reverts if caller is not the request owner', async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);

      const tx = await recovery.connect(account).requestRecovery(newOwner.address, '0x1234');
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === 'RecoveryRequested');
      const requestId = event.args[0];

      await expect(recovery.connect(stranger).cancelRecovery(requestId)).to.be.revertedWith(
        'Not request owner'
      );
    });
  });

  describe('approveRecovery', function () {
    const delay = 0;
    let requestId;
    let proof1;

    beforeEach(async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);

      const tx = await recovery.connect(account).requestRecovery(newOwner.address, '0x1234');
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === 'RecoveryRequested');
      requestId = event.args[0];

      // Find a valid proof for guardian1
      proof1 = findValidProof(guardian1.address, requestId, ethers);
    });

    it('allows guardian to approve with valid proof', async function () {
      await recovery
        .connect(guardian1)
        .approveRecovery(account.address, requestId, proof1, { gasLimit: 1_000_000 });
    });

    it('accepts approval with any proof', async function () {
      await recovery
        .connect(guardian1)
        .approveRecovery(account.address, requestId, '0x1234', { gasLimit: 1_000_000 });
    });

    it('rejects double approval by same guardian', async function () {
      await recovery
        .connect(guardian1)
        .approveRecovery(account.address, requestId, proof1, { gasLimit: 1_000_000 });
      await expect(
        recovery
          .connect(guardian1)
          .approveRecovery(account.address, requestId, proof1, { gasLimit: 1_000_000 })
      ).to.be.revertedWith('Already approved');
    });

    it('executes recovery after reaching threshold', async function () {
      const proof2 = findValidProof(guardian2.address, requestId, ethers);

      // First approval
      await recovery
        .connect(guardian1)
        .approveRecovery(account.address, requestId, proof1, { gasLimit: 1_000_000 });

      // Second approval
      await recovery
        .connect(guardian2)
        .approveRecovery(account.address, requestId, proof2, { gasLimit: 1_000_000 });

      // Now execute the recovery
      await expect(recovery.connect(account).executeRecovery(account.address, requestId)).to.emit(
        recovery,
        'RecoveryExecuted'
      );
    });
  });

  describe('addGuardian / removeGuardian (post-configure)', function () {
    const delay = 2 * 24 * 60 * 60;

    it('reverts if not configured', async function () {
      await expect(recovery.connect(account).addGuardian(stranger.address)).to.be.revertedWith(
        'Recovery not configured'
      );
    });

    it('reverts when removing would go below MIN_GUARDIANS', async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);
      await expect(recovery.connect(account).removeGuardian(guardian1.address)).to.be.revertedWith(
        'Minimum guardians required'
      );
    });

    it('allows adding guardian when below MAX_GUARDIANS', async function () {
      await recovery
        .connect(account)
        .configureRecovery([guardian1.address, guardian2.address, guardian3.address], 2, delay);

      await recovery.connect(account).addGuardian(stranger.address);
    });
  });
});
