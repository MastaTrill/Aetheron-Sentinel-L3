import { expect } from 'chai';
import { network } from 'hardhat';

describe('AuditAnchor', function () {
  this.timeout(60_000);

  let ethers;
  let owner;
  let operator;
  let attacker;
  let auditAnchor;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, operator, attacker] = await ethers.getSigners();

    const AuditAnchorFactory = await ethers.getContractFactory(
      'contracts/sentinel/AuditAnchor.sol:AuditAnchor'
    );
    auditAnchor = await AuditAnchorFactory.deploy(owner.address);
    await auditAnchor.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets initial owner correctly', async function () {
      expect(await auditAnchor.owner()).to.equal(owner.address);
    });

    it('initialises with 0 total anchors', async function () {
      expect(await auditAnchor.getTotalAnchors()).to.equal(0n);
    });

    it('initialises unpaused', async function () {
      expect(await auditAnchor.paused()).to.be.false;
    });
  });

  describe('Single Hash Anchoring (recordHash)', function () {
    it('records a valid envelope hash and emits event', async function () {
      const envelopeHash = ethers.keccak256(ethers.toUtf8Bytes('tee-attestation-envelope-1'));

      await expect(auditAnchor.connect(operator).recordHash(envelopeHash))
        .to.emit(auditAnchor, 'AnchorRecorded')
        .withArgs(
          envelopeHash,
          operator.address,
          val => val > 0n,
          val => val > 0n
        );

      expect(await auditAnchor.isHashAnchored(envelopeHash)).to.be.true;
      expect(await auditAnchor.getTotalAnchors()).to.equal(1n);

      const record = await auditAnchor.getAnchor(envelopeHash);
      expect(record.envelopeHash).to.equal(envelopeHash);
      expect(record.submitter).to.equal(operator.address);
      expect(record.exists).to.be.true;
    });

    it('reverts on zero hash', async function () {
      await expect(
        auditAnchor.connect(operator).recordHash(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(auditAnchor, 'InvalidEnvelopeHash');
    });

    it('reverts on duplicate hash submission', async function () {
      const envelopeHash = ethers.keccak256(ethers.toUtf8Bytes('duplicate-envelope-1'));
      await auditAnchor.connect(operator).recordHash(envelopeHash);

      await expect(auditAnchor.connect(operator).recordHash(envelopeHash))
        .to.be.revertedWithCustomError(auditAnchor, 'DuplicateEnvelopeHash')
        .withArgs(envelopeHash);
    });
  });

  describe('Batch Hash Anchoring (recordHashBatch)', function () {
    it('records multiple hashes in a single call and emits events', async function () {
      const h1 = ethers.keccak256(ethers.toUtf8Bytes('batch-envelope-1'));
      const h2 = ethers.keccak256(ethers.toUtf8Bytes('batch-envelope-2'));
      const h3 = ethers.keccak256(ethers.toUtf8Bytes('batch-envelope-3'));

      const tx = await auditAnchor.connect(operator).recordHashBatch([h1, h2, h3]);
      await expect(tx)
        .to.emit(auditAnchor, 'AnchorRecorded')
        .withArgs(
          h1,
          operator.address,
          v => v > 0n,
          v => v > 0n
        );
      await expect(tx)
        .to.emit(auditAnchor, 'AnchorRecorded')
        .withArgs(
          h2,
          operator.address,
          v => v > 0n,
          v => v > 0n
        );
      await expect(tx)
        .to.emit(auditAnchor, 'AnchorRecorded')
        .withArgs(
          h3,
          operator.address,
          v => v > 0n,
          v => v > 0n
        );
      await expect(tx).to.emit(auditAnchor, 'AnchorBatchRecorded');

      expect(await auditAnchor.getTotalAnchors()).to.equal(3n);
      expect(await auditAnchor.isHashAnchored(h1)).to.be.true;
      expect(await auditAnchor.isHashAnchored(h2)).to.be.true;
      expect(await auditAnchor.isHashAnchored(h3)).to.be.true;
    });

    it('reverts on empty batch', async function () {
      await expect(auditAnchor.connect(operator).recordHashBatch([])).to.be.revertedWithCustomError(
        auditAnchor,
        'EmptyBatch'
      );
    });

    it('reverts on duplicate within same batch', async function () {
      const h1 = ethers.keccak256(ethers.toUtf8Bytes('batch-dup-1'));
      await expect(auditAnchor.connect(operator).recordHashBatch([h1, h1]))
        .to.be.revertedWithCustomError(auditAnchor, 'DuplicateEnvelopeHash')
        .withArgs(h1);
    });

    it('reverts on batch exceeding MAX_BATCH_SIZE (100)', async function () {
      const largeBatch = Array.from({ length: 101 }, (_, i) =>
        ethers.keccak256(ethers.toUtf8Bytes(`large-batch-${i}`))
      );
      await expect(auditAnchor.connect(operator).recordHashBatch(largeBatch))
        .to.be.revertedWithCustomError(auditAnchor, 'BatchTooLarge')
        .withArgs(101, 100);
    });
  });

  describe('Pagination & Retrieval', function () {
    it('returns paginated slices of anchored hashes', async function () {
      const hashes = Array.from({ length: 5 }, (_, i) =>
        ethers.keccak256(ethers.toUtf8Bytes(`page-envelope-${i}`))
      );
      await auditAnchor.connect(operator).recordHashBatch(hashes);

      const slice1 = await auditAnchor.getAnchoredHashes(0, 2);
      expect(slice1.length).to.equal(2);
      expect(slice1[0]).to.equal(hashes[0]);
      expect(slice1[1]).to.equal(hashes[1]);

      const slice2 = await auditAnchor.getAnchoredHashes(2, 2);
      expect(slice2.length).to.equal(2);
      expect(slice2[0]).to.equal(hashes[2]);
      expect(slice2[1]).to.equal(hashes[3]);

      const slice3 = await auditAnchor.getAnchoredHashes(4, 10);
      expect(slice3.length).to.equal(1);
      expect(slice3[0]).to.equal(hashes[4]);

      const emptySlice = await auditAnchor.getAnchoredHashes(10, 5);
      expect(emptySlice.length).to.equal(0);
    });
  });

  describe('Emergency Pause Controls', function () {
    it('allows owner to pause and blocks new anchors', async function () {
      await auditAnchor.connect(owner).pause();
      expect(await auditAnchor.paused()).to.be.true;

      const h = ethers.keccak256(ethers.toUtf8Bytes('paused-envelope'));
      await expect(auditAnchor.connect(operator).recordHash(h)).to.be.revertedWithCustomError(
        auditAnchor,
        'EnforcedPause'
      );

      await expect(
        auditAnchor.connect(operator).recordHashBatch([h])
      ).to.be.revertedWithCustomError(auditAnchor, 'EnforcedPause');
    });

    it('rejects non-owner pause attempts', async function () {
      await expect(auditAnchor.connect(attacker).pause())
        .to.be.revertedWithCustomError(auditAnchor, 'OwnableUnauthorizedAccount')
        .withArgs(attacker.address);
    });

    it('allows owner to unpause and resume anchoring', async function () {
      await auditAnchor.connect(owner).pause();
      await auditAnchor.connect(owner).unpause();
      expect(await auditAnchor.paused()).to.be.false;

      const h = ethers.keccak256(ethers.toUtf8Bytes('unpaused-envelope'));
      const tx = await auditAnchor.connect(operator).recordHash(h);
      await expect(tx).to.emit(auditAnchor, 'AnchorRecorded');
      expect(await auditAnchor.isHashAnchored(h)).to.be.true;
    });
  });
});
