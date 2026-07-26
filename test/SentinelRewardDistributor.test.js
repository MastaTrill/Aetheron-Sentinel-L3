// test/SentinelRewardDistributor.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelRewardDistributor', function () {
  this.timeout(100000);
  let distributor, token, owner, staker1, staker2;
  let ethers;
  const STAKE_AMT = ethers.parseEther ? undefined : undefined; // resolved in beforeEach

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, staker1, staker2] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory('MockERC20');
    token = await TokenFactory.deploy('Sentinel', 'SENTINEL', ethers.parseEther('10000000'));
    await token.waitForDeployment();

    const Factory = await ethers.getContractFactory('SentinelRewardDistributor');
    distributor = await Factory.deploy(await token.getAddress(), owner.address);
    await distributor.waitForDeployment();

    // Fund stakers
    await token.transfer(staker1.address, ethers.parseEther('1000000'));
    await token.transfer(staker2.address, ethers.parseEther('1000000'));
  });

  it('deploys with epoch 0 open', async function () {
    expect(await distributor.currentEpoch()).to.equal(0n);
    expect(await distributor.totalStaked()).to.equal(0n);
  });

  it('allows users to stake tokens', async function () {
    const amt = ethers.parseEther('500000');
    await token.connect(staker1).approve(await distributor.getAddress(), amt);
    await distributor.connect(staker1).stake(amt);
    expect(await distributor.userStake(staker1.address)).to.equal(amt);
    expect(await distributor.totalStaked()).to.equal(amt);
  });

  it('allows users to unstake tokens', async function () {
    const amt = ethers.parseEther('200000');
    await token.connect(staker1).approve(await distributor.getAddress(), amt);
    await distributor.connect(staker1).stake(amt);
    await distributor.connect(staker1).unstake(amt);
    expect(await distributor.userStake(staker1.address)).to.equal(0n);
  });

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

    const pending1 = await distributor.pendingReward(0, staker1.address);
    const pending2 = await distributor.pendingReward(0, staker2.address);

    // staker1 gets 60%, staker2 gets 40%
    expect(pending1).to.equal(ethers.parseEther('60000'));
    expect(pending2).to.equal(ethers.parseEther('40000'));

    await distributor.connect(staker1).claimReward(0);
    expect(await distributor.claimed(0, staker1.address)).to.equal(true);
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
    await expect(distributor.connect(staker1).claimReward(0)).to.be.revertedWith('Already claimed');
  });
});
