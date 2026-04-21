// test/SentinelYieldMaximizer.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelYieldMaximizer', function () {
  let yieldMaximizer, token;
  let owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    token = await ERC20Mock.deploy(
      'YieldToken',
      'YLD',
      owner.address,
      ethers.parseEther('1000000'),
    );
    await token.waitForDeployment();

    const SentinelYieldMaximizer = await ethers.getContractFactory(
      'SentinelYieldMaximizer',
    );
    yieldMaximizer = await SentinelYieldMaximizer.deploy(owner.address);
    await yieldMaximizer.waitForDeployment();

    // Fund user and approve
    await token.transfer(user.address, ethers.parseEther('1000'));
    await token
      .connect(user)
      .approve(await yieldMaximizer.getAddress(), ethers.parseEther('1000'));
  });

  describe('setYieldToken', function () {
    it('sets the yield token and rejects zero address', async function () {
      await expect(
        yieldMaximizer.setYieldToken(ethers.ZeroAddress),
      ).to.be.revertedWith('Invalid token address');
      await yieldMaximizer.setYieldToken(await token.getAddress());
      expect(await yieldMaximizer.yieldToken()).to.equal(
        await token.getAddress(),
      );
    });

    it('is only callable by owner', async function () {
      await expect(
        yieldMaximizer.connect(user).setYieldToken(await token.getAddress()),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('deposit', function () {
    it('reverts if yield token not configured', async function () {
      await expect(
        yieldMaximizer.connect(user).deposit(ethers.parseEther('100')),
      ).to.be.revertedWith('Yield token not configured');
    });

    it('reverts on zero amount', async function () {
      await yieldMaximizer.setYieldToken(await token.getAddress());
      await expect(yieldMaximizer.connect(user).deposit(0)).to.be.revertedWith(
        'Cannot deposit 0',
      );
    });

    it('transfers tokens from user to contract on deposit', async function () {
      await yieldMaximizer.setYieldToken(await token.getAddress());
      const amount = ethers.parseEther('100');
      const contractBefore = await token.balanceOf(
        await yieldMaximizer.getAddress(),
      );

      await yieldMaximizer.connect(user).deposit(amount);

      const contractAfter = await token.balanceOf(
        await yieldMaximizer.getAddress(),
      );
      expect(contractAfter - contractBefore).to.equal(amount);
    });

    it('updates TVL on deposit', async function () {
      await yieldMaximizer.setYieldToken(await token.getAddress());
      const amount = ethers.parseEther('200');
      await yieldMaximizer.connect(user).deposit(amount);
      expect(await yieldMaximizer.totalValueLocked()).to.equal(amount);
    });

    it('tracks user as known for rebalancing', async function () {
      await yieldMaximizer.setYieldToken(await token.getAddress());
      await yieldMaximizer.connect(user).deposit(ethers.parseEther('50'));

      // Second deposit should not double-push to user list (no revert = success)
      await token
        .connect(user)
        .approve(await yieldMaximizer.getAddress(), ethers.parseEther('50'));
      const tx = await yieldMaximizer
        .connect(user)
        .deposit(ethers.parseEther('50'));
      await tx.wait();
    });
  });

  describe('withdraw', function () {
    beforeEach(async function () {
      await yieldMaximizer.setYieldToken(await token.getAddress());
      await yieldMaximizer.connect(user).deposit(ethers.parseEther('100'));
    });

    it('reverts when withdrawing more than deposited', async function () {
      await expect(
        yieldMaximizer.connect(user).withdraw(ethers.parseEther('200')),
      ).to.be.revertedWith('Insufficient balance');
    });

    it('transfers tokens back to user on withdraw', async function () {
      const userBefore = await token.balanceOf(user.address);
      await yieldMaximizer.connect(user).withdraw(ethers.parseEther('50'));
      const userAfter = await token.balanceOf(user.address);
      expect(userAfter).to.be.gt(userBefore); // includes any accrued yield
    });

    it('decrements TVL on withdraw', async function () {
      await yieldMaximizer.connect(user).withdraw(ethers.parseEther('50'));
      expect(await yieldMaximizer.totalValueLocked()).to.equal(
        ethers.parseEther('50'),
      );
    });
  });

  describe('strategies', function () {
    it('initialises 3 strategies as inactive (no protocol set)', async function () {
      for (let i = 0; i < 3; i++) {
        const strategy = await yieldMaximizer.yieldStrategies(i);
        expect(strategy.active).to.equal(false);
        expect(strategy.protocol).to.equal(ethers.ZeroAddress);
      }
    });

    it('allows owner to add an active strategy with a real protocol address', async function () {
      const fakeProtocol = ethers.Wallet.createRandom().address;
      await yieldMaximizer.addYieldStrategy(fakeProtocol, 1000, 3, '0x');
      const strategy = await yieldMaximizer.yieldStrategies(3);
      expect(strategy.protocol).to.equal(fakeProtocol);
      expect(strategy.active).to.equal(true);
    });
  });
});
