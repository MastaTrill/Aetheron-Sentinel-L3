// test/SentinelSecurityTokenization.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelSecurityTokenization', function () {
  let securityTokenization;
  let owner, user, user2;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, user, user2] = await ethers.getSigners();

    // Deploy the security tokenization contract
    const SentinelSecurityTokenization = await ethers.getContractFactory(
      'SentinelSecurityTokenization'
    );
    securityTokenization = await SentinelSecurityTokenization.deploy();
    await securityTokenization.waitForDeployment();
  });

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      expect(await securityTokenization.owner()).to.equal(owner.address);
    });
  });

  describe('Security Token Creation', function () {
    it('should allow owner to create an audit report token', async function () {
      const name = 'Test Audit Report';
      const symbol = 'TAR';
      const initialSupply = ethers.parseEther('1000');

      // Send required platform fee (500 wei)
      const tx = await securityTokenization.connect(owner).createSecurityToken(
        name,
        symbol,
        initialSupply,
        0, // AUDIT_REPORT
        Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year expiry
        'ipfs://test-uri',
        { value: 500 }
      );

      await expect(tx)
        .to.emit(securityTokenization, 'SecurityTokenCreated')
        .withArgs(ethers.isAddress, name, 0);

      // Check that a token was created
      const activeTokens = await securityTokenization.getActiveTokens();
      expect(activeTokens.length).to.equal(1n);
    });
  });

  describe('Security NFT Transfers', function () {
    async function mintNFT(isTransferable = true) {
      await securityTokenization.connect(user).mintSecurityNFT(
        1, // COMPLIANCE_CERTIFICATE
        'Compliance Certificate',
        'Certificate issued after review',
        'ipfs://certificate',
        25_000,
        isTransferable,
        { value: 500 }
      );
      return 1n;
    }

    it('should move a transferable NFT to the recipient and emit the transfer', async function () {
      const tokenId = await mintNFT();

      await expect(
        securityTokenization.connect(user).transferSecurityNFT(tokenId, user2.address)
      )
        .to.emit(securityTokenization, 'SecurityNFTTransferred')
        .withArgs(tokenId, user.address, user2.address);

      const [holder] = await securityTokenization.getNFTDetails(tokenId);
      expect(holder).to.equal(user2.address);

      await expect(
        securityTokenization.connect(user).transferSecurityNFT(tokenId, owner.address)
      ).to.be.revertedWith('Not NFT owner');
    });

    it('should reject transfers of non-transferable NFTs', async function () {
      const tokenId = await mintNFT(false);

      await expect(
        securityTokenization.connect(user).transferSecurityNFT(tokenId, user2.address)
      ).to.be.revertedWith('NFT not transferable');
    });

    it('should reject the zero-address recipient', async function () {
      const tokenId = await mintNFT();

      await expect(
        securityTokenization.connect(user).transferSecurityNFT(tokenId, ethers.ZeroAddress)
      ).to.be.revertedWith('Invalid recipient');
    });
  });

  describe('Access Control', function () {
    it('should allow only owner to set platform fee', async function () {
      await expect(
        securityTokenization.connect(user).setPlatformFee(800)
      ).to.be.revertedWithCustomError(securityTokenization, 'OwnableUnauthorizedAccount');
    });

    it('should allow owner to update platform fee', async function () {
      await securityTokenization.connect(owner).setPlatformFee(800);
    });

    it('should revert if fee exceeds maximum', async function () {
      await expect(securityTokenization.connect(owner).setPlatformFee(1500)).to.be.revertedWith(
        'Fee cannot exceed 10%'
      );
    });
  });

  describe('Token Details', function () {
    it('should return empty token details for non-existent token', async function () {
      const details = await securityTokenization.getTokenDetails(user.address);
      expect(details.isActive).to.be.false;
    });
  });
});
