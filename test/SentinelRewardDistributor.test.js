// test/SentinelRewardDistributor.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelRewardDistributor', function () {
  this.timeout(120000);
  let distributor, token, owner, staker1, staker2;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, staker1, staker2] = await ethers.getSigners();

    // MockERC20(name, symbol, initialSupply) — mints to msg.sender (owner)
    const TokenFactory = await ethers.getContractFactory('MockERC20');
    token = await TokenFactory.deploy('Sentinel', 'SENTINEL', ethers.parseEther('10000000'));
    await token.waitForDeployment();

    const Factory = await ethers.getContractFactory('SentinelRewardDistributor');
    distributor = await Factory.deploy(await token.getAddress(), owner.address);
    await distributor.waitForDeployment();

    // Fund stakers from owner
    await token.transfer(staker1.address, ethers.parseEther('1000000'));
    await token.transfer(staker2.address, ethers.parseEther('1000000'));
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe('deployment', function () {
    it('deploys with epoch 0 open and zero total staked', async function () {
      expect(await distributor.currentEpoch()).to.equal(0n);
      expect(await distributor.totalStaked()).to.equal(0n);
    });

    it('reverts if deployed with zero token address', async function () {
      const Factory = await ethers.getContractFactory('SentinelRewardDistributor');
      await expect(
        Factory.deploy(ethers.ZeroAddress, owner.address)
      ).to.be.revertedWith('Zero token address');
    });
  });

  // ─── Staking ─────────────────────────────────────────────────────────────────

  describe('stake', function () {
    it('allows a user to stake tokens', async function () {
      const amt = ethers.parseEther('500000');
      await token.connect(staker1).approve(await distributor.getAddress(), amt);
      await distributor.connect(staker1).stake(amt);

      expect(await distributor.userStake(staker1.address)).to.equal(amt);
      expect(await distributor.totalStaked()).to.equal(amt);
    });

    it('records userStakeAtEpoch for the current epoch', async function () {
      const amt = ethers.parseEther('300000');
      await token.connect(staker1).approve(await distributor.getAddress(), amt);
      await distributor.connect(staker1).stake(amt);

      expect(await distributor.userStakeAtEpoch(0, staker1.address)).to.equal(amt);
    });

    it('emits Staked event', async function () {
      const amt = ethers.parseEther('100000');
      await token.connect(staker1).approve(await distributor.getAddress(), amt);
      await expect(distributor.connect(staker1).stake(amt))
        .to.emit(distributor, 'Staked')
        .withArgs(staker1.address, amt, 0n);
    });

    it('reverts on zero stake amount', async function () {
      await expect(distributor.connect(staker1).stake(0)).to.be.revertedWith('Zero amount');
    });

    it('accumulates stake from multiple deposits', async function () {
      const amt = ethers.parseEther('200000');
      await token.connect(staker1).approve(await distributor.getAddress(), amt * 2n);
      await distributor.connect(staker1).stake(amt);
      await distributor.connect(staker1).stake(amt);

      expect(await distributor.userStake(staker1.address)).to.equal(amt * 2n);
    });
  });

  // ─── Unstaking ───────────────────────────────────────────────────────────────

  describe('unstake', function () {
    it('allows a user to unstake tokens', async function () {
      const amt = ethers.parseEther('200000');
      await token.connect(staker1).approve(await distributor.getAddress(), amt);
      await distributor.connect(staker1).stake(amt);
      await distributor.connect(staker1).unstake(amt);

      expect(await distributor.userStake(staker1.address)).to.equal(0n);
      expect(await distributor.totalStaked()).to.equal(0n);
    });

    it('emits Unstaked event', async function () {
      const amt = ethers.parseEther('100000');
      await token.connect(staker1).approve(await distributor.getAddress(), amt);
      await distributor.connect(staker1).stake(amt);
      await expect(distributor.connect(staker1).unstake(amt))
        .to.emit(distributor, 'Unstaked')
        .withArgs(staker1.address, amt);
    });

    it('reverts if unstaking more than staked', async function () {
      const amt = ethers.parseEther('100000');
      await token.connect(staker1).approve(await distributor.getAddress(), amt);
      await distributor.connect(staker1).stake(amt);

      await expect(
        distributor.connect(staker1).unstake(ethers.parseEther('200000'))
      ).to.be.revertedWith('Insufficient stake');
    });

    it('returns tokens to user on unstake', async function () {
      const amt = ethers.parseEther('100000');
      const before = await token.balanceOf(staker1.address);
      await token.connect(staker1).approve(await distributor.getAddress(), amt);
      await distributor.connect(staker1).stake(amt);
      await distributor.connect(staker1).unstake(amt);
      const after = await token.balanceOf(staker1.address);

      expect(after).to.equal(before);
    });
  });

  // ─── Epoch Finalization & Rewards ─────────────────────────────────────────

  describe('finalizeEpoch & claimReward', function () {
    it('finalizes epoch and allows proportional reward claim', async function () {
      const stake1 = ethers.parseEther('600000');
      const stake2 = ethers.parseEther('400000');
      const rewards = ethers.parseEther('100000');

      await token.connect(staker1).approve(await distributor.getAddress(), stake1);
      await token.connect(staker2).approve(await distributor.getAddress(), stake2);
      await distributor.connect(staker1).stake(stake1);
      await distributor.connect(staker2).stake(stake2);

      await token.approve(await distributor.getAddress(), rewards);
      await distributor.depositRewards(rewards);
      await distributor.finalizeEpoch();

      expect(await distributor.currentEpoch()).to.equal(1n);

      // staker1 = 60%, staker2 = 40%
      expect(await distributor.pendingReward(0, staker1.address)).to.equal(ethers.parseEther('60000'));
      expect(await distributor.pendingReward(0, staker2.address)).to.equal(ethers.parseEther('40000'));

      await distributor.connect(staker1).claimReward(0);
      expect(await distributor.claimed(0, staker1.address)).to.equal(true);
    });

    it('emits EpochFinalized event', async function () {
      const stake = ethers.parseEther('500000');
      const rewards = ethers.parseEther('50000');
      await token.connect(staker1).approve(await distributor.getAddress(), stake);
      await distributor.connect(staker1).stake(stake);
      await token.approve(await distributor.getAddress(), rewards);
      await distributor.depositRewards(rewards);

      await expect(distributor.finalizeEpoch())
        .to.emit(distributor, 'EpochFinalized')
        .withArgs(0n, rewards, stake);
    });

    it('emits RewardClaimed event', async function () {
      const stake = ethers.parseEther('500000');
      const rewards = ethers.parseEther('50000');
      await token.connect(staker1).approve(await distributor.getAddress(), stake);
      await distributor.connect(staker1).stake(stake);
      await token.approve(await distributor.getAddress(), rewards);
      await distributor.depositRewards(rewards);
      await distributor.finalizeEpoch();

      await expect(distributor.connect(staker1).claimReward(0))
        .to.emit(distributor, 'RewardClaimed')
        .withArgs(staker1.address, 0n, rewards);
    });

    it('prevents double claiming', async function () {
      const stake = ethers.parseEther('500000');
      const rewards = ethers.parseEther('50000');
      await token.connect(staker1).approve(await distributor.getAddress(), stake);
      await distributor.connect(staker1).stake(stake);
      await token.approve(await distributor.getAddress(), rewards);
      await distributor.depositRewards(rewards);
      await distributor.finalizeEpoch();

      await distributor.connect(staker1).claimReward(0);
      await expect(
        distributor.connect(staker1).claimReward(0)
      ).to.be.revertedWith('Already claimed');
    });

    it('reverts claimReward on unfinalized epoch', async function () {
      await expect(
        distributor.connect(staker1).claimReward(0)
      ).to.be.revertedWith('Epoch not finalized');
    });

    it('reverts claimReward if user has no stake in epoch', async function () {
      const stake = ethers.parseEther('500000');
      const rewards = ethers.parseEther('50000');
      await token.connect(staker1).approve(await distributor.getAddress(), stake);
      await distributor.connect(staker1).stake(stake);
      await token.approve(await distributor.getAddress(), rewards);
      await distributor.depositRewards(rewards);
      await distributor.finalizeEpoch();

      await expect(
        distributor.connect(staker2).claimReward(0)
      ).to.be.revertedWith('No stake in epoch');
    });

    it('reverts finalizeEpoch if already finalized', async function () {
      const stake = ethers.parseEther('500000');
      const rewards = ethers.parseEther('50000');
      await token.connect(staker1).approve(await distributor.getAddress(), stake);
      await distributor.connect(staker1).stake(stake);
      await token.approve(await distributor.getAddress(), rewards);
      await distributor.depositRewards(rewards);
      await distributor.finalizeEpoch();

      await expect(distributor.finalizeEpoch()).to.be.revertedWith('No rewards');
    });

    it('reverts finalizeEpoch if no rewards deposited', async function () {
      await expect(distributor.finalizeEpoch()).to.be.revertedWith('No rewards');
    });

    it('reverts finalizeEpoch if called by non-owner', async function () {
      await expect(
        distributor.connect(staker1).finalizeEpoch()
      ).to.be.revertedWithCustomError(distributor, 'OwnableUnauthorizedAccount');
    });

    it('pendingReward returns 0 for unfinalized epoch', async function () {
      expect(await distributor.pendingReward(0, staker1.address)).to.equal(0n);
    });

    it('correctly advances to next epoch after finalization', async function () {
      const stake = ethers.parseEther('500000');
      const rewards = ethers.parseEther('50000');
      await token.connect(staker1).approve(await distributor.getAddress(), stake);
      await distributor.connect(staker1).stake(stake);
      await token.approve(await distributor.getAddress(), rewards);
      await distributor.depositRewards(rewards);
      await distributor.finalizeEpoch();

      expect(await distributor.currentEpoch()).to.equal(1n);

      // New stake goes into epoch 1
      const amt2 = ethers.parseEther('100000');
      await token.connect(staker2).approve(await distributor.getAddress(), amt2);
      await distributor.connect(staker2).stake(amt2);
      expect(await distributor.userStakeAtEpoch(1, staker2.address)).to.equal(amt2);
    });
  });
});
