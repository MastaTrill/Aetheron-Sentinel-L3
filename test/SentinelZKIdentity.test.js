// test/SentinelZKIdentity.test.js
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('SentinelZKIdentity', function () {
  let identity;
  let owner, user, user2;

  beforeEach(async function () {
    [owner, user, user2] = await ethers.getSigners();
    const SentinelZKIdentity =
      await ethers.getContractFactory('SentinelZKIdentity');
    identity = await SentinelZKIdentity.deploy(owner.address);
    await identity.waitForDeployment();
  });

  describe('Identity creation', function () {
    it('creates an identity and populates the reverse mapping', async function () {
      const publicKey = ethers.keccak256(ethers.toUtf8Bytes('user_public_key'));
      await identity.connect(user).createZKIdentity(publicKey);

      const [identityHash, reputation, trustScore, isVerified] =
        await identity.getZKIdentity(user.address);

      expect(identityHash).to.not.equal(ethers.ZeroHash);
      expect(reputation).to.equal(500);
      expect(trustScore).to.equal(600);
      expect(isVerified).to.equal(false);

      // Reverse mapping should point back to user
      expect(await identity.identityHashToOwner(identityHash)).to.equal(
        user.address,
      );
    });

    it('prevents duplicate identity creation', async function () {
      const publicKey = ethers.keccak256(ethers.toUtf8Bytes('key'));
      await identity.connect(user).createZKIdentity(publicKey);
      await expect(
        identity.connect(user).createZKIdentity(publicKey),
      ).to.be.revertedWith('Identity already exists');
    });
  });

  describe('Credential issuance', function () {
    let identityHash;

    beforeEach(async function () {
      const publicKey = ethers.keccak256(ethers.toUtf8Bytes('user_public_key'));
      const tx = await identity.connect(user).createZKIdentity(publicKey);
      const receipt = await tx.wait();
      // Extract identityHash from event
      const event = receipt.logs.find(
        (l) => identity.interface.parseLog(l)?.name === 'IdentityCreated',
      );
      identityHash = identity.interface.parseLog(event).args.identityHash;
    });

    it('issues a credential and populates credentialToOwner mapping', async function () {
      const attrHash = ethers.keccak256(ethers.toUtf8Bytes('attr_value'));
      const tx = await identity
        .connect(owner)
        .issueZKCredential(identityHash, 'KYC', [attrHash], 90 * 24 * 3600); // 90 days
      const receipt = await tx.wait();

      const event = receipt.logs.find(
        (l) => identity.interface.parseLog(l)?.name === 'CredentialIssued',
      );
      const credentialId = identity.interface.parseLog(event).args.credentialId;

      // Reverse mapping should resolve to the identity owner
      expect(await identity.credentialToOwner(credentialId)).to.equal(
        user.address,
      );
    });

    it('retrieves credential info correctly', async function () {
      const attrHash = ethers.keccak256(ethers.toUtf8Bytes('attr_value'));
      const tx = await identity
        .connect(owner)
        .issueZKCredential(identityHash, 'AML', [attrHash], 60 * 24 * 3600);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => identity.interface.parseLog(l)?.name === 'CredentialIssued',
      );
      const credentialId = identity.interface.parseLog(event).args.credentialId;

      const [credType, , , , isValid, isRevoked] =
        await identity.getZKCredential(credentialId);
      expect(credType).to.equal('AML');
      expect(isValid).to.equal(true);
      expect(isRevoked).to.equal(false);
    });

    it('revokes a credential', async function () {
      const attrHash = ethers.keccak256(ethers.toUtf8Bytes('attr'));
      const tx = await identity
        .connect(owner)
        .issueZKCredential(identityHash, 'KYC', [attrHash], 30 * 24 * 3600);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => identity.interface.parseLog(l)?.name === 'CredentialIssued',
      );
      const credentialId = identity.interface.parseLog(event).args.credentialId;

      await identity.connect(owner).revokeZKCredential(credentialId);

      const [, , , , , isRevoked] =
        await identity.getZKCredential(credentialId);
      expect(isRevoked).to.equal(true);
    });
  });
});
