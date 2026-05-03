// test/SentinelSecurityTokenization.test.js
import { expect } from 'chai';
import hardhat from 'hardhat';
const { ethers } = hardhat;

describe('SentinelSecurityTokenization', function () {
  let securityTokenization;
  let owner, user, user2;

  beforeEach(async function () {
    [owner, user, user2] = await ethers.getSigners();

    // Deploy the security tokenization contract
    const SentinelSecurityTokenization = await ethers.getContractFactory('SentinelSecurityTokenization');
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
      const tx = await securityTokenization.connect(user).createSecurityToken(
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
      expect(activeTokens.length).to.equal(1);
    });
  });

  describe('Access Control', function () {
    it('should allow only owner to set platform fee', async function () {
      await expect(
        securityTokenization.connect(user).setPlatformFee(800)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should allow owner to update platform fee', async function () {
      await expect(securityTokenization.connect(owner).setPlatformFee(800))
        .to.not.be.reverted;
    });

    it('should revert if fee exceeds maximum', async function () {
      await expect(
        securityTokenization.connect(owner).setPlatformFee(1500)
      ).to.be.revertedWith('Fee cannot exceed 10%');
    });
  });

  describe('Token Details', function () {
    it('should return empty token details for non-existent token', async function () {
      const details = await securityTokenization.getTokenDetails(user.address);
      expect(details.isActive).to.be.false;
    });
  });
});