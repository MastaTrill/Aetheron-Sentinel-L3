// test/SentinelStaking.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelStaking', function () {
  let staking, stakingToken, rewardToken;
  let owner, user, user2;

  // Bronze tier lock period (7 days in seconds)
  const BRONZE_LOCK = 7 * 24 * 3600;

  beforeEach(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    stakingToken = await ERC20Mock.deploy(
      'StakeToken',
      'STK',
      owner.address,
      ethers.parseEther('1000000'),
    );
    rewardToken = await ERC20Mock.deploy(
      'RewardToken',
      'RWD',
      owner.address,
      ethers.parseEther('1000000'),
    );
    await stakingToken.waitForDeployment();
    await rewardToken.waitForDeployment();

    const SentinelStaking = await ethers.getContractFactory('SentinelStaking');
    staking = await SentinelStaking.deploy(
      await stakingToken.getAddress(),
      await rewardToken.getAddress(),
      owner.address,
    );
    await staking.waitForDeployment();

    // Fund the staking contract with reward tokens so bonuses can be paid
    await rewardToken.transfer(
      await staking.getAddress(),
      ethers.parseEther('100000'),
    );

    // Give user a staking budget and approval
    await stakingToken.transfer(user.address, ethers.parseEther('100000'));
    await stakingToken
      .connect(user)
      .approve(await staking.getAddress(), ethers.parseEther('100000'));
  });

  describe('Deployment', function () {
    it('reverts with zero staking token address', async function () {
      const SentinelStaking =
        await ethers.getContractFactory('SentinelStaking');
      await expect(
        SentinelStaking.deploy(
          ethers.ZeroAddress,
          await rewardToken.getAddress(),
          owner.address,
        ),
      ).to.be.revertedWith('Invalid staking token');
    });

    it('reverts with zero reward token address', async function () {
      const SentinelStaking =
        await ethers.getContractFactory('SentinelStaking');
      await expect(
        SentinelStaking.deploy(
          await stakingToken.getAddress(),
          ethers.ZeroAddress,
          owner.address,
        ),
      ).to.be.revertedWith('Invalid reward token');
    });

    it('reverts with zero owner address', async function () {
      const SentinelStaking =
        await ethers.getContractFactory('SentinelStaking');
      await expect(
        SentinelStaking.deploy(
          await stakingToken.getAddress(),
          await rewardToken.getAddress(),
          ethers.ZeroAddress,
        ),
      ).to.be.revertedWith('Invalid owner');
    });

    it('sets staking and reward token addresses', async function () {
      expect(await staking.stakingToken()).to.equal(
        await stakingToken.getAddress(),
      );
      expect(await staking.rewardToken()).to.equal(
        await rewardToken.getAddress(),
      );
    });

    it('initialises Bronze tier with 2.89% APY', async function () {
      const tier0 = await staking.tiers(0);
      expect(tier0.baseAPY).to.equal(289n);
      expect(tier0.lockPeriod).to.equal(BigInt(BRONZE_LOCK));
    });

    it('initialises Silver tier with 3.50% APY', async function () {
      const tier1 = await staking.tiers(1);
      expect(tier1.baseAPY).to.equal(350n);
    });
  });

  describe('stake', function () {
    it('reverts when amount is 0', async function () {
      await expect(staking.connect(user).stake(0)).to.be.revertedWith(
        'Cannot stake 0',
      );
    });

    it('transfers tokens into the contract', async function () {
      const amount = ethers.parseEther('100');
      const contractBefore = await stakingToken.balanceOf(
        await staking.getAddress(),
      );
      await staking.connect(user).stake(amount);
      const contractAfter = await stakingToken.balanceOf(
        await staking.getAddress(),
      );
      expect(contractAfter - contractBefore).to.equal(amount);
    });

    it('records stake amount and updates totalStaked', async function () {
      const amount = ethers.parseEther('500');
      await staking.connect(user).stake(amount);
      const info = await staking.stakes(user.address);
      expect(info.amount).to.equal(amount);
      expect(await staking.totalStaked()).to.equal(amount);
    });

    it('assigns Bronze tier for stake < 1 000 tokens', async function () {
      await staking.connect(user).stake(ethers.parseEther('100'));
      const info = await staking.stakes(user.address);
      expect(info.tier).to.equal(0n);
    });

    it('assigns Silver tier for stake >= 1 000 tokens', async function () {
      await staking.connect(user).stake(ethers.parseEther('1000'));
      const info = await staking.stakes(user.address);
      expect(info.tier).to.equal(1n);
    });

    it('assigns Gold tier for stake >= 10 000 tokens', async function () {
      await staking.connect(user).stake(ethers.parseEther('10000'));
      const info = await staking.stakes(user.address);
      expect(info.tier).to.equal(2n);
    });

    it('emits Staked event', async function () {
      const amount = ethers.parseEther('100');
      await expect(staking.connect(user).stake(amount))
        .to.emit(staking, 'Staked')
        .withArgs(user.address, amount, 0n);
    });
  });

  describe('unstake', function () {
    beforeEach(async function () {
      await staking.connect(user).stake(ethers.parseEther('500'));
    });

    it('reverts when unstaking more than staked', async function () {
      await expect(
        staking.connect(user).unstake(ethers.parseEther('1000')),
      ).to.be.revertedWith('Insufficient stake');
    });

    it('reverts when lock period has not elapsed', async function () {
      await expect(
        staking.connect(user).unstake(ethers.parseEther('100')),
      ).to.be.revertedWith('Still locked');
    });

    it('returns staked tokens after lock period', async function () {
      await ethers.provider.send('evm_increaseTime', [BRONZE_LOCK + 1]);
      await ethers.provider.send('evm_mine', []);

      const amount = ethers.parseEther('500');
      const balBefore = await stakingToken.balanceOf(user.address);
      await staking.connect(user).unstake(amount);
      const balAfter = await stakingToken.balanceOf(user.address);

      expect(balAfter - balBefore).to.equal(amount);
    });

    it('updates totalStaked after unstake', async function () {
      await ethers.provider.send('evm_increaseTime', [BRONZE_LOCK + 1]);
      await ethers.provider.send('evm_mine', []);

      await staking.connect(user).unstake(ethers.parseEther('500'));
      expect(await staking.totalStaked()).to.equal(0n);
    });

    it('emits Unstaked event', async function () {
      await ethers.provider.send('evm_increaseTime', [BRONZE_LOCK + 1]);
      await ethers.provider.send('evm_mine', []);

      await expect(staking.connect(user).unstake(ethers.parseEther('500')))
        .to.emit(staking, 'Unstaked')
        .withArgs(user.address, ethers.parseEther('500'), 0n);
    });
  });

  describe('awardSecurityBonus', function () {
    it('reverts when called by a non-REWARD_MANAGER', async function () {
      await expect(
        staking
          .connect(user2)
          .awardSecurityBonus(user.address, 'anomaly_report'),
      ).to.be.revertedWith(/AccessControl/);
    });

    it('owner (REWARD_MANAGER) can award anomaly_report bonus', async function () {
      // Ensure user has a stake so securityScore update is meaningful
      await staking.connect(user).stake(ethers.parseEther('100'));
      await expect(staking.awardSecurityBonus(user.address, 'anomaly_report'))
        .to.emit(staking, 'SecurityBonusAwarded')
        .withArgs(user.address, ethers.parseEther('10'), 'anomaly_report');
    });

    it('increases securityScore on bonus award', async function () {
      await staking.connect(user).stake(ethers.parseEther('100'));
      await staking.awardSecurityBonus(user.address, 'anomaly_report');
      expect(await staking.securityScore(user.address)).to.equal(10n);
    });
  });

  describe('getUserAPY', function () {
    it('returns 0 when user has no stake', async function () {
      expect(await staking.getUserAPY(user.address)).to.equal(0n);
    });

    it('returns a non-zero APY when user has staked', async function () {
      await staking.connect(user).stake(ethers.parseEther('100'));
      const apy = await staking.getUserAPY(user.address);
      expect(apy).to.be.gt(0n);
    });
  });
});
