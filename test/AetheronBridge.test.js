// test/AetheronBridge.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('AetheronBridge', function () {
  let bridge, token;
  let owner, relayer, user, recipient;

  beforeEach(async function () {
    [owner, relayer, user, recipient] = await ethers.getSigners();

    // Deploy a minimal ERC-20 mock for bridging
    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    token = await ERC20Mock.deploy(
      'MockToken',
      'MTK',
      owner.address,
      ethers.parseEther('1000000'),
    );
    await token.waitForDeployment();

    const AetheronBridge = await ethers.getContractFactory('AetheronBridge');
    bridge = await AetheronBridge.deploy(owner.address);
    await bridge.waitForDeployment();

    // Authorize relayer and add token support
    await bridge.setRelayer(relayer.address, true);
    await bridge.setTokenSupport(await token.getAddress(), true);

    // Fund user
    await token.transfer(user.address, ethers.parseEther('1000'));
    await token
      .connect(user)
      .approve(await bridge.getAddress(), ethers.parseEther('1000'));
  });

  describe('Token support tracking', function () {
    it('increments supportedTokenCount when adding a new token', async function () {
      expect(await bridge.supportedTokenCount()).to.equal(1);
    });

    it('does not double-count the same token added twice', async function () {
      await bridge.setTokenSupport(await token.getAddress(), true);
      expect(await bridge.supportedTokenCount()).to.equal(1);
    });

    it('decrements supportedTokenCount when removing a token', async function () {
      await bridge.setTokenSupport(await token.getAddress(), false);
      expect(await bridge.supportedTokenCount()).to.equal(0);
    });

    it('increments count via initializeBridge', async function () {
      const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
      const token2 = await ERC20Mock.deploy(
        'Token2',
        'TK2',
        owner.address,
        ethers.parseEther('1000'),
      );
      await token2.waitForDeployment();
      await bridge.initializeBridge(
        await token2.getAddress(),
        ethers.parseEther('100'),
      );
      expect(await bridge.supportedTokenCount()).to.equal(2);
    });
  });

  describe('getBridgeStats', function () {
    it('returns live token count and zero TVL when no transfers', async function () {
      const [tvl, , tokenCount] = await bridge.getBridgeStats();
      expect(tvl).to.equal(0);
      expect(tokenCount).to.equal(1);
    });
  });

  describe('totalTransferCount', function () {
    it('starts at zero', async function () {
      expect(await bridge.totalTransferCount()).to.equal(0);
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
          },
        );

      expect(await bridge.totalTransferCount()).to.equal(1);
    });
  });
});
