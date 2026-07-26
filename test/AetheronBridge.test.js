// test/AetheronBridge.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('AetheronBridge', function () {
  this.timeout(100000);
  let bridge, token;
  let owner, relayer, user, recipient;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, relayer, user, recipient] = await ethers.getSigners();

    // Deploy a minimal ERC-20 mock for bridging
    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    token = await ERC20Mock.deploy('MockToken', 'MTK', owner.address, ethers.parseEther('1000000'));
    await token.waitForDeployment();

    const AetheronBridge = await ethers.getContractFactory('AetheronBridge');
    bridge = await AetheronBridge.deploy(owner.address);
    await bridge.waitForDeployment();

    // Authorize relayer and add token support
    await bridge.setRelayer(relayer.address, true);
    await bridge.setTokenSupport(await token.getAddress(), true);

    // Fund user
    await token.transfer(user.address, ethers.parseEther('1000'));
    await token.connect(user).approve(await bridge.getAddress(), ethers.parseEther('1000'));
  });

  describe('Token support tracking', function () {
    it('increments supportedTokenCount when adding a new token', async function () {
      expect(await bridge.supportedTokenCount()).to.equal(1n);
    });

    it('does not double-count the same token added twice', async function () {
      await bridge.setTokenSupport(await token.getAddress(), true);
      expect(await bridge.supportedTokenCount()).to.equal(1n);
    });

    it('decrements supportedTokenCount when removing a token', async function () {
      await bridge.setTokenSupport(await token.getAddress(), false);
      expect(await bridge.supportedTokenCount()).to.equal(0n);
    });

    it('increments count via initializeBridge', async function () {
      const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
      const token2 = await ERC20Mock.deploy(
        'Token2',
        'TK2',
        owner.address,
        ethers.parseEther('1000')
      );
      await token2.waitForDeployment();
      await bridge.initializeBridge(await token2.getAddress(), ethers.parseEther('100'));
      expect(await bridge.supportedTokenCount()).to.equal(2n);
    });
  });

  describe('getBridgeStats', function () {
    it('returns live token count and zero TVL when no transfers', async function () {
      const [tvl, , tokenCount] = await bridge.getBridgeStats();
      expect(tvl).to.equal(0n);
      expect(tokenCount).to.equal(1n);
    });
  });

  describe('totalTransferCount', function () {
    it('starts at zero', async function () {
      expect(await bridge.totalTransferCount()).to.equal(0n);
    });

    it('increments after a successful bridgeTokens call', async function () {
      const chainId = 137;
      await bridge.setChainLimit(chainId, ethers.parseEther('1000000'));

      // Approve token spend from user to bridge
      await bridge
        .connect(user)
        .bridgeTokens(
          recipient.address,
          ethers.parseEther('100'),
          chainId,
          await token.getAddress(),
          {
            value: ethers.parseEther('0.001'), // bridge fee
          }
        );

      expect(await bridge.totalTransferCount()).to.equal(1n);
    });
  });

  describe('setChainLimit guardrails', function () {
    it('reverts when chainId is zero', async function () {
      await expect(bridge.setChainLimit(0, ethers.parseEther('1'))).to.be.revertedWith(
        'Invalid chain ID'
      );
    });

    it('reverts when setting limit for the current chain', async function () {
      const { chainId } = await ethers.provider.getNetwork();
      await expect(bridge.setChainLimit(chainId, ethers.parseEther('1'))).to.be.revertedWith(
        'Cannot set local chain limit'
      );
    });

    it('reverts when limit is zero', async function () {
      await expect(bridge.setChainLimit(137, 0)).to.be.revertedWith('Limit must be positive');
    });

    it('sets limit for a valid non-local chain ID', async function () {
      const validChainId = 137;
      const limit = ethers.parseEther('5000');
      await bridge.setChainLimit(validChainId, limit);
      expect(await bridge.chainLimits(validChainId)).to.equal(limit);
    });
  });

  describe('Security Oracle Integration', function () {
    let mockOracle;
    beforeEach(async function () {
      const MockOracle = await ethers.getContractFactory('MockCrossChainOracle');
      mockOracle = await MockOracle.deploy();
      await bridge.setSecurityOracle(await mockOracle.getAddress());

      const chainId = 137;
      await bridge.setChainLimit(chainId, ethers.parseEther('1000000'));
    });

    it('should revert bridgeTokens if global threat level is > 70', async function () {
      await mockOracle.setGlobalThreatLevel(75);
      await expect(
        bridge
          .connect(user)
          .bridgeTokens(
            recipient.address,
            ethers.parseEther('100'),
            137,
            await token.getAddress(),
            { value: ethers.parseEther('0.001') }
          )
      ).to.be.revertedWithCustomError(bridge, 'AetheronBridge__SecurityRiskDetected');
    });

    it('should allow bridgeTokens if global threat level is <= 70', async function () {
      await mockOracle.setGlobalThreatLevel(50);
      await bridge
        .connect(user)
        .bridgeTokens(recipient.address, ethers.parseEther('100'), 137, await token.getAddress(), {
          value: ethers.parseEther('0.001'),
        });
      expect(await bridge.totalTransferCount()).to.equal(1n);
    });
  });
});
