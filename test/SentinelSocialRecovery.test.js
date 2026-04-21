// test/SentinelSocialRecovery.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

/**
 * Find an approvalProof value whose on-chain hash passes the 90%-gate:
 *   uint256(keccak256(abi.encodePacked(guardian, requestId, proof))) % 100 < 90
 */
function findValidProof(guardianAddr, requestId) {
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

  beforeEach(async function () {
    [owner, account, guardian1, guardian2, guardian3, newOwner, stranger] =
      await ethers.getSigners();

    // SentinelSocialRecovery requires a zkIdentityContract address (any non-zero is fine
    // because _isValidZKIdentity only checks account != address(0))
    const SentinelSocialRecovery = await ethers.getContractFactory(
      'SentinelSocialRecovery',
    );
    recovery = await SentinelSocialRecovery.deploy(
      owner.address, // zkIdentityContract (placeholder)
      owner.address,
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
      const SentinelSocialRecovery = await ethers.getContractFactory(
        'SentinelSocialRecovery',
      );
      await expect(
        SentinelSocialRecovery.deploy(owner.address, ethers.ZeroAddress),
      ).to.be.revertedWith('SR: zero owner');
    });
  });

  describe('constants', function () {
    it('MIN_GUARDIANS is 3', async function () {
      expect(await recovery.MIN_GUARDIANS()).to.equal(3n);
    });

    it('MAX_GUARDIANS is 10', async function () {
      expect(await recovery.MAX_GUARDIANS()).to.equal(10n);
    });

    it('MIN_RECOVERY_DELAY is 1 day', async function () {
      expect(await recovery.MIN_RECOVERY_DELAY()).to.equal(86400n);
    });
  });

  describe('configureRecovery', function () {
    const delay = 2 * 24 * 60 * 60; // 2 days

    it('configures recovery successfully with valid guardians', async function () {
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );

      const [guardianCount, threshold, recoveryDelay, isActive] =
        await recovery.getRecoveryConfig(account.address);
      expect(guardianCount).to.equal(3n);
      expect(threshold).to.equal(2n);
      expect(recoveryDelay).to.equal(BigInt(delay));
      expect(isActive).to.equal(true);
    });

    it('emits RecoveryConfigured event', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery(
            [guardian1.address, guardian2.address, guardian3.address],
            2,
            delay,
          ),
      )
        .to.emit(recovery, 'RecoveryConfigured')
        .withArgs(account.address, 3n, 2n);
    });

    it('reverts with too few guardians (< 3)', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery([guardian1.address, guardian2.address], 1, delay),
      ).to.be.revertedWith('Invalid guardian count');
    });

    it('reverts with threshold = 0', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery(
            [guardian1.address, guardian2.address, guardian3.address],
            0,
            delay,
          ),
      ).to.be.revertedWith('Invalid threshold');
    });

    it('reverts with threshold > guardian count', async function () {
      await expect(
        recovery
          .connect(account)
          .configureRecovery(
            [guardian1.address, guardian2.address, guardian3.address],
            4,
            delay,
          ),
      ).to.be.revertedWith('Invalid threshold');
    });

    it('reverts with recovery delay below minimum', async function () {
      await expect(
        recovery.connect(account).configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          3600, // less than 1 day
        ),
      ).to.be.revertedWith('Invalid recovery delay');
    });

    it('reverts if already configured', async function () {
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );
      await expect(
        recovery
          .connect(account)
          .configureRecovery(
            [guardian1.address, guardian2.address, guardian3.address],
            2,
            delay,
          ),
      ).to.be.revertedWith('Recovery already configured');
    });

    it('confirms configured guardians via isGuardian', async function () {
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );
      expect(
        await recovery.isGuardian(account.address, guardian1.address),
      ).to.equal(true);
      expect(
        await recovery.isGuardian(account.address, stranger.address),
      ).to.equal(false);
    });
  });

  describe('requestRecovery', function () {
    const delay = 2 * 24 * 60 * 60;

    beforeEach(async function () {
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );
    });

    it('creates a recovery request and returns a requestId', async function () {
      const tx = await recovery
        .connect(account)
        .requestRecovery(newOwner.address, '0x1234');
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === 'RecoveryRequested',
      );
      expect(event).to.not.be.undefined;
    });

    it('emits RecoveryRequested event', async function () {
      await expect(
        recovery.connect(account).requestRecovery(newOwner.address, '0x1234'),
      ).to.emit(recovery, 'RecoveryRequested');
    });

    it('reverts if recovery not configured', async function () {
      await expect(
        recovery.connect(stranger).requestRecovery(newOwner.address, '0x1234'),
      ).to.be.revertedWith('Recovery not configured');
    });

    it('reverts if newOwner is the zero address', async function () {
      await expect(
        recovery.connect(account).requestRecovery(ethers.ZeroAddress, '0x1234'),
      ).to.be.revertedWith('Invalid new owner');
    });

    it('reverts if newOwner is same as caller', async function () {
      await expect(
        recovery.connect(account).requestRecovery(account.address, '0x1234'),
      ).to.be.revertedWith('Invalid new owner');
    });
  });

  describe('cancelRecovery', function () {
    const delay = 2 * 24 * 60 * 60;

    it('account owner can cancel a pending request', async function () {
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );

      const tx = await recovery
        .connect(account)
        .requestRecovery(newOwner.address, '0x1234');
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === 'RecoveryRequested',
      );
      const requestId = event.args[0];

      // Cancel should not revert
      await expect(
        recovery.connect(account).cancelRecovery(requestId),
      ).to.not.revert(ethers);
    });

    it('reverts if caller is not the request owner', async function () {
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );

      const tx = await recovery
        .connect(account)
        .requestRecovery(newOwner.address, '0x1234');
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === 'RecoveryRequested',
      );
      const requestId = event.args[0];

      await expect(
        recovery.connect(stranger).cancelRecovery(requestId),
      ).to.be.revertedWith('Not request owner');
    });
  });

  describe('approveRecovery', function () {
    const delay = 2 * 24 * 60 * 60;
    let requestId;

    beforeEach(async function () {
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );

      const tx = await recovery
        .connect(account)
        .requestRecovery(newOwner.address, '0xdeadbeef');
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => l.fragment && l.fragment.name === 'RecoveryRequested',
      );
      requestId = event.args[0];
    });

    it('guardian can approve with a valid proof and emits RecoveryApproved', async function () {
      const proof = findValidProof(guardian1.address, requestId);
      await expect(
        recovery
          .connect(guardian1)
          .approveRecovery(account.address, requestId, proof),
      ).to.emit(recovery, 'RecoveryApproved');
    });

    it('reverts if caller is not a guardian', async function () {
      const proof = findValidProof(stranger.address, requestId);
      await expect(
        recovery
          .connect(stranger)
          .approveRecovery(account.address, requestId, proof),
      ).to.be.revertedWith('Not a guardian');
    });

    it('reverts on double approval by same guardian', async function () {
      const proof = findValidProof(guardian1.address, requestId);
      await recovery
        .connect(guardian1)
        .approveRecovery(account.address, requestId, proof);
      await expect(
        recovery
          .connect(guardian1)
          .approveRecovery(account.address, requestId, proof),
      ).to.be.revertedWith('Already approved');
    });
  });

  describe('addGuardian / removeGuardian (post-configure)', function () {
    const delay = 2 * 24 * 60 * 60;
    let extra;

    beforeEach(async function () {
      const signers = await ethers.getSigners();
      extra = signers[7];
      await recovery
        .connect(account)
        .configureRecovery(
          [guardian1.address, guardian2.address, guardian3.address],
          2,
          delay,
        );
    });

    it('account owner can add a new guardian', async function () {
      await recovery.connect(account).addGuardian(extra.address);
      expect(
        await recovery.isGuardian(account.address, extra.address),
      ).to.equal(true);
      const [guardianCount] = await recovery.getRecoveryConfig(account.address);
      expect(guardianCount).to.equal(4n);
    });

    it('reverts if not configured', async function () {
      await expect(
        recovery.connect(stranger).addGuardian(extra.address),
      ).to.be.revertedWith('Recovery not configured');
    });

    it('account owner can remove a guardian (stays above minimum)', async function () {
      await recovery.connect(account).addGuardian(extra.address); // now 4
      await recovery.connect(account).removeGuardian(guardian1.address);
      expect(
        await recovery.isGuardian(account.address, guardian1.address),
      ).to.equal(false);
    });

    it('reverts when removing would go below MIN_GUARDIANS', async function () {
      await expect(
        recovery.connect(account).removeGuardian(guardian1.address),
      ).to.be.revertedWith('Minimum guardians required');
    });
  });
});
