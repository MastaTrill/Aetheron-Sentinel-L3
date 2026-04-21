// test/SentinelReferralSystem.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelReferralSystem', function () {
  let referral;
  let owner, user1, user2, user3;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    const SentinelReferralSystem = await ethers.getContractFactory(
      'SentinelReferralSystem',
    );
    referral = await SentinelReferralSystem.deploy(
      ethers.ZeroAddress, // reward token (simulated, no real transfer)
      owner.address,
    );
    await referral.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets owner correctly', async function () {
      expect(await referral.owner()).to.equal(owner.address);
    });

    it('initialises 4 referral tiers', async function () {
      const tier0 = await referral.tiers(0);
      const tier3 = await referral.tiers(3);
      expect(tier0.minReferrals).to.equal(0n);
      expect(tier3.minReferrals).to.equal(100n);
    });

    it('stores the reward token address', async function () {
      expect(await referral.rewardToken()).to.equal(ethers.ZeroAddress);
    });
  });

  describe('constants', function () {
    it('BASE_REFERRAL_REWARD is 50 ether', async function () {
      expect(await referral.BASE_REFERRAL_REWARD()).to.equal(
        ethers.parseEther('50'),
      );
    });

    it('MAX_REFERRAL_APY is 200', async function () {
      expect(await referral.MAX_REFERRAL_APY()).to.equal(200n);
    });
  });

  describe('register', function () {
    it('allows a user to register without a referrer', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      expect(await referral.isRegistered(user1.address)).to.equal(true);
    });

    it('emits UserRegistered event', async function () {
      await expect(
        referral.connect(user1).register(ethers.ZeroAddress),
      ).to.emit(referral, 'UserRegistered');
    });

    it('prevents duplicate registration', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      await expect(
        referral.connect(user1).register(ethers.ZeroAddress),
      ).to.be.revertedWith('Already registered');
    });

    it('records the referral relationship when referrer is valid', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      await referral.connect(user2).register(user1.address);

      const info = await referral.referrals(user1.address);
      expect(info.totalReferrals).to.equal(1n);

      const referred = await referral.getReferredUsers(user1.address);
      expect(referred).to.include(user2.address);
    });

    it('ignores referrer if referrer is not registered', async function () {
      await referral.connect(user2).register(user1.address); // user1 not registered
      const info = await referral.referrals(user2.address);
      expect(info.referrer).to.equal(ethers.ZeroAddress);
    });

    it('ignores self-referral', async function () {
      await referral.connect(user1).register(user1.address);
      const info = await referral.referrals(user1.address);
      expect(info.referrer).to.equal(ethers.ZeroAddress);
    });

    it('reverts when paused', async function () {
      await referral.emergencyPause();
      await expect(
        referral.connect(user1).register(ethers.ZeroAddress),
      ).to.revert(ethers);
    });
  });

  describe('getReferralAPY', function () {
    it('returns 0 for unregistered user', async function () {
      expect(await referral.getReferralAPY(user1.address)).to.equal(0n);
    });

    it('returns non-zero APY for registered user', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      const apy = await referral.getReferralAPY(user1.address);
      expect(apy).to.be.gt(0n);
      expect(apy).to.be.lte(200n);
    });
  });

  describe('getReferralStats', function () {
    it('returns correct stats for a registered user with a referral', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      await referral.connect(user2).register(user1.address);

      const [referrer, totalReferrals, , , currentTier, currentAPY] =
        await referral.getReferralStats(user1.address);
      expect(referrer).to.equal(ethers.ZeroAddress);
      expect(totalReferrals).to.equal(1n);
      expect(currentTier).to.equal(0n);
      expect(currentAPY).to.be.gt(0n);
    });
  });

  describe('recordActivity', function () {
    it('reverts if user not registered', async function () {
      await expect(
        referral.connect(user1).recordActivity('stake'),
      ).to.be.revertedWith('Not registered');
    });

    it('records activity and emits ActivityBonus for known activity types', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      await expect(referral.connect(user1).recordActivity('stake'))
        .to.emit(referral, 'ActivityBonus')
        .withArgs(user1.address, ethers.parseEther('5'), 'stake');
    });

    it('records activity without bonus for unknown type', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      // unknown type → bonus = 0, no ActivityBonus event
      await expect(
        referral.connect(user1).recordActivity('unknown'),
      ).to.not.emit(referral, 'ActivityBonus');
    });
  });

  describe('updateActiveReferrals', function () {
    it('allows owner to update active referral count', async function () {
      await referral.connect(user1).register(ethers.ZeroAddress);
      await referral.updateActiveReferrals(user1.address, 5);
      const info = await referral.referrals(user1.address);
      expect(info.activeReferrals).to.equal(5n);
    });

    it('reverts for non-owner', async function () {
      await expect(
        referral.connect(user1).updateActiveReferrals(user1.address, 5),
      ).to.revert(ethers);
    });
  });

  describe('emergencyPause / emergencyUnpause', function () {
    it('owner can pause and unpause', async function () {
      await referral.emergencyPause();
      await referral.emergencyUnpause();
      // register should work again after unpause
      await referral.connect(user1).register(ethers.ZeroAddress);
      expect(await referral.isRegistered(user1.address)).to.equal(true);
    });

    it('non-owner cannot pause', async function () {
      await expect(referral.connect(user1).emergencyPause()).to.revert(ethers);
    });
  });
});
