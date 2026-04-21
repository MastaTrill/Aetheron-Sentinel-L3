// test/SentinelRewardAggregator.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelRewardAggregator', function () {
  let aggregator;
  let owner, user, other;
  const STAKING = '0x0000000000000000000000000000000000000001';
  const LIQUIDITY = '0x0000000000000000000000000000000000000002';
  const GOV = '0x0000000000000000000000000000000000000003';
  const REFERRAL = '0x0000000000000000000000000000000000000004';

  beforeEach(async function () {
    [owner, user, other] = await ethers.getSigners();
    const SentinelRewardAggregator = await ethers.getContractFactory(
      'SentinelRewardAggregator',
    );
    aggregator = await SentinelRewardAggregator.deploy(
      STAKING,
      LIQUIDITY,
      GOV,
      REFERRAL,
    );
    await aggregator.waitForDeployment();
  });

  describe('Deployment', function () {
    it('stores contract addresses', async function () {
      expect(await aggregator.stakingContract()).to.equal(STAKING);
      expect(await aggregator.liquidityMiningContract()).to.equal(LIQUIDITY);
      expect(await aggregator.governanceTokenContract()).to.equal(GOV);
      expect(await aggregator.referralSystemContract()).to.equal(REFERRAL);
    });

    it('initialises system APY on construction', async function () {
      const apy = await aggregator.getSystemAPY();
      expect(apy.stakingAPY).to.equal(350n);
      expect(apy.liquidityAPY).to.equal(400n);
      expect(apy.governanceAPY).to.equal(325n);
      expect(apy.referralAPY).to.equal(100n);
      expect(apy.securityAPY).to.equal(75n);
      expect(apy.totalAPY).to.be.gt(0n);
    });

    it('sets performanceMultiplier to 100', async function () {
      expect(await aggregator.performanceMultiplier()).to.equal(100n);
    });
  });

  describe('constants', function () {
    it('BASE_APY is 300', async function () {
      expect(await aggregator.BASE_APY()).to.equal(300n);
    });

    it('MAX_APY is 500', async function () {
      expect(await aggregator.MAX_APY()).to.equal(500n);
    });
  });

  describe('updateUserRewards', function () {
    it('populates reward fields for a user', async function () {
      await aggregator.updateUserRewards(user.address);
      const rewards = await aggregator.userRewards(user.address);
      expect(rewards.stakingRewards).to.equal(ethers.parseEther('100'));
      expect(rewards.liquidityRewards).to.equal(ethers.parseEther('150'));
      expect(rewards.governanceRewards).to.equal(ethers.parseEther('50'));
      expect(rewards.referralRewards).to.equal(ethers.parseEther('25'));
      expect(rewards.securityRewards).to.equal(ethers.parseEther('10'));
    });

    it('sets a non-zero lastUpdate timestamp', async function () {
      await aggregator.updateUserRewards(user.address);
      const rewards = await aggregator.userRewards(user.address);
      expect(rewards.lastUpdate).to.be.gt(0n);
    });

    it('emits RewardsUpdated event', async function () {
      await expect(aggregator.updateUserRewards(user.address)).to.emit(
        aggregator,
        'RewardsUpdated',
      );
    });
  });

  describe('getUserTotalAPY', function () {
    it('returns a non-zero APY for any address', async function () {
      const apy = await aggregator.getUserTotalAPY(user.address);
      expect(apy).to.be.gt(0n);
      expect(apy).to.be.lte(500n);
    });
  });

  describe('getUserRewardBreakdown', function () {
    it('returns non-zero APY components', async function () {
      const [staking, liquidity, governance, referral, security, total] =
        await aggregator.getUserRewardBreakdown(user.address);
      expect(staking).to.be.gt(0n);
      expect(liquidity).to.be.gt(0n);
      expect(governance).to.be.gt(0n);
      expect(referral).to.be.gt(0n);
      expect(security).to.be.gt(0n);
      expect(total).to.be.gt(0n);
    });
  });

  describe('claimAllRewards', function () {
    it('allows a user to claim their own rewards', async function () {
      await aggregator.updateUserRewards(user.address);
      await aggregator.connect(user).claimAllRewards(user.address);
    });

    it('allows owner to claim on behalf of a user', async function () {
      await aggregator.updateUserRewards(user.address);
      await aggregator.claimAllRewards(user.address);
    });

    it('resets rewards to zero after claim', async function () {
      await aggregator.updateUserRewards(user.address);
      await aggregator.connect(user).claimAllRewards(user.address);
      const rewards = await aggregator.userRewards(user.address);
      expect(rewards.stakingRewards).to.equal(0n);
      expect(rewards.liquidityRewards).to.equal(0n);
    });

    it('reverts when called by an unauthorised third party', async function () {
      await expect(
        aggregator.connect(other).claimAllRewards(user.address),
      ).to.be.revertedWith('Unauthorized');
    });
  });

  describe('updateSystemAPY', function () {
    it('is callable by owner and emits SystemAPYUpdated', async function () {
      await expect(aggregator.updateSystemAPY()).to.emit(
        aggregator,
        'SystemAPYUpdated',
      );
    });

    it('reverts for non-owner', async function () {
      await expect(aggregator.connect(user).updateSystemAPY()).to.revert(
        ethers,
      );
    });
  });

  describe('updatePerformanceMultiplier', function () {
    it('sets MAX_MULTIPLIER (150) for health score >= 95', async function () {
      await aggregator.updatePerformanceMultiplier(95);
      expect(await aggregator.performanceMultiplier()).to.equal(150n);
    });

    it('sets 125 for health score >= 90', async function () {
      await aggregator.updatePerformanceMultiplier(90);
      expect(await aggregator.performanceMultiplier()).to.equal(125n);
    });

    it('sets 110 for health score >= 80', async function () {
      await aggregator.updatePerformanceMultiplier(80);
      expect(await aggregator.performanceMultiplier()).to.equal(110n);
    });

    it('sets 100 (base) for low health score', async function () {
      await aggregator.updatePerformanceMultiplier(50);
      expect(await aggregator.performanceMultiplier()).to.equal(100n);
    });

    it('reverts for non-owner', async function () {
      await expect(
        aggregator.connect(user).updatePerformanceMultiplier(95),
      ).to.revert(ethers);
    });
  });
});
