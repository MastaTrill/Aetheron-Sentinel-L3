// test/SentinelToken.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelToken', function () {
  let token;
  let owner, user, user2;

  beforeEach(async function () {
    [owner, user, user2] = await ethers.getSigners();
    const SentinelToken = await ethers.getContractFactory('SentinelToken');
    token = await SentinelToken.deploy(owner.address);
    await token.waitForDeployment();
  });

  describe('Deployment', function () {
    it('has correct name and symbol', async function () {
      expect(await token.name()).to.equal('Aetheron Sentinel');
      expect(await token.symbol()).to.equal('SENT');
    });

    it('mints total supply to the contract itself', async function () {
      const supply = await token.TOTAL_SUPPLY();
      expect(await token.balanceOf(await token.getAddress())).to.equal(supply);
    });

    it('sets the owner correctly', async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it('creates a vesting schedule for the owner', async function () {
      const { totalAmount } = await token.getVestingSchedule(owner.address);
      expect(totalAmount).to.equal(await token.TEAM_ALLOCATION());
    });

    it('initialises reward pool remaining', async function () {
      const expected =
        (await token.STAKING_REWARDS()) +
        (await token.GOVERNANCE_REWARDS()) +
        (await token.SECURITY_REWARDS());
      expect(await token.rewardPoolRemaining()).to.equal(expected);
    });
  });

  // Helper: give `account` some tokens via a short-cliff vesting schedule.
  async function giveTokens(account, amount) {
    // cliff = 0, duration = 1 second → fully vested after the next block.
    await token.createVestingSchedule(account.address, amount, 1, 0);
    await ethers.provider.send('evm_increaseTime', [2]);
    await ethers.provider.send('evm_mine', []);
    await token.releaseVestedTokens(account.address);
  }

  describe('vesting', function () {
    it('owner can create a vesting schedule for a new beneficiary', async function () {
      await token.createVestingSchedule(
        user.address,
        ethers.parseEther('500'),
        30 * 86400,
        10 * 86400,
      );
      const { totalAmount } = await token.getVestingSchedule(user.address);
      expect(totalAmount).to.equal(ethers.parseEther('500'));
    });

    it('non-owner cannot create a vesting schedule', async function () {
      await expect(
        token
          .connect(user)
          .createVestingSchedule(
            user2.address,
            ethers.parseEther('100'),
            86400,
            0,
          ),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('returns 0 releasable before cliff', async function () {
      await token.createVestingSchedule(
        user.address,
        ethers.parseEther('100'),
        30 * 86400,
        10 * 86400,
      );
      const { releasable } = await token.getVestingSchedule(user.address);
      expect(releasable).to.equal(0n);
    });

    it('reverts releaseVestedTokens before cliff', async function () {
      await token.createVestingSchedule(
        user.address,
        ethers.parseEther('100'),
        30 * 86400,
        10 * 86400,
      );
      await expect(token.releaseVestedTokens(user.address)).to.be.revertedWith(
        'No tokens to release',
      );
    });

    it('releases the full amount after the vesting duration', async function () {
      const amount = ethers.parseEther('100');
      await giveTokens(user, amount);
      expect(await token.balanceOf(user.address)).to.equal(amount);
    });

    it('reverts when there is no vesting schedule', async function () {
      await expect(token.releaseVestedTokens(user2.address)).to.be.revertedWith(
        'No vesting schedule',
      );
    });
  });

  describe('staking', function () {
    beforeEach(async function () {
      await giveTokens(user, ethers.parseEther('1000'));
    });

    it('reverts when staking 0', async function () {
      await expect(token.connect(user).stake(0)).to.be.revertedWith(
        'Cannot stake 0',
      );
    });

    it('reverts with insufficient balance', async function () {
      // user2 has no tokens
      await expect(
        token.connect(user2).stake(ethers.parseEther('1')),
      ).to.be.revertedWith('Insufficient balance');
    });

    it('stakes tokens and tracks balance', async function () {
      const amount = ethers.parseEther('200');
      await token.connect(user).stake(amount);
      expect(await token.stakedBalances(user.address)).to.equal(amount);
      expect(await token.totalStaked()).to.equal(amount);
    });

    it('reduces wallet balance when staking', async function () {
      const amount = ethers.parseEther('200');
      const before = await token.balanceOf(user.address);
      await token.connect(user).stake(amount);
      expect(await token.balanceOf(user.address)).to.equal(before - amount);
    });

    it('unstaking returns tokens to the wallet', async function () {
      const amount = ethers.parseEther('200');
      await token.connect(user).stake(amount);
      const before = await token.balanceOf(user.address);
      await token.connect(user).unstake(amount);
      expect(await token.balanceOf(user.address)).to.be.gte(before + amount);
      expect(await token.stakedBalances(user.address)).to.equal(0n);
    });

    it('reverts when unstaking more than staked', async function () {
      await token.connect(user).stake(ethers.parseEther('100'));
      await expect(
        token.connect(user).unstake(ethers.parseEther('200')),
      ).to.be.revertedWith('Insufficient staked balance');
    });
  });

  describe('security reporter', function () {
    it('owner can grant and revoke security reporter', async function () {
      await token.setSecurityReporter(user.address, true);
      expect(await token.securityReporters(user.address)).to.be.true;
      await token.setSecurityReporter(user.address, false);
      expect(await token.securityReporters(user.address)).to.be.false;
    });

    it('non-owner cannot set security reporter', async function () {
      await expect(
        token.connect(user).setSecurityReporter(user2.address, true),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts on zero address', async function () {
      await expect(
        token.setSecurityReporter(ethers.ZeroAddress, true),
      ).to.be.revertedWith('Invalid address');
    });
  });

  describe('getUserAPY', function () {
    it('returns base staking APY for a user with no participation', async function () {
      const baseAPY = await token.BASE_STAKING_APY();
      expect(await token.getUserAPY(user.address)).to.equal(baseAPY);
    });
  });
});
