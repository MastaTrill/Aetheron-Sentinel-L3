// test/SentinelGovernance.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelGovernance', function () {
  let governance;
  let votesToken;
  let owner, voter;

  // Deploy helpers
  async function deployTimelockController(admin) {
    const SentinelTimelock =
      await ethers.getContractFactory('SentinelTimelock');
    const timelock = await SentinelTimelock.deploy(
      1, // minDelay: 1 second
      [admin.address], // proposers
      [admin.address], // executors
      admin.address, // admin
    );
    await timelock.waitForDeployment();
    return timelock;
  }

  async function deployVotesToken(admin) {
    const ERC20VotesMock = await ethers.getContractFactory('ERC20VotesMock');
    const token = await ERC20VotesMock.deploy(
      'GovToken',
      'GOV',
      admin.address,
      ethers.parseEther('1000000'),
    );
    await token.waitForDeployment();
    return token;
  }

  beforeEach(async function () {
    [owner, voter] = await ethers.getSigners();
    votesToken = await deployVotesToken(owner);
  });

  describe('constants', function () {
    it('MIN_VOTING_DELAY is 1 day', async function () {
      const SentinelGovernance =
        await ethers.getContractFactory('SentinelGovernance');
      // We need valid IVotes + TimelockController to deploy.
      const timelock = await deployTimelockController(owner);
      governance = await SentinelGovernance.deploy(
        await votesToken.getAddress(),
        await timelock.getAddress(),
      );
      await governance.waitForDeployment();

      const oneDay = 24n * 60n * 60n;
      expect(await governance.MIN_VOTING_DELAY()).to.equal(oneDay);
    });

    it('MIN_VOTING_PERIOD is 3 days', async function () {
      const SentinelGovernance =
        await ethers.getContractFactory('SentinelGovernance');
      const timelock = await deployTimelockController(owner);
      governance = await SentinelGovernance.deploy(
        await votesToken.getAddress(),
        await timelock.getAddress(),
      );
      await governance.waitForDeployment();

      const threeDays = 3n * 24n * 60n * 60n;
      expect(await governance.MIN_VOTING_PERIOD()).to.equal(threeDays);
    });

    it('EMERGENCY_VOTING_PERIOD is 6 hours', async function () {
      const SentinelGovernance =
        await ethers.getContractFactory('SentinelGovernance');
      const timelock = await deployTimelockController(owner);
      governance = await SentinelGovernance.deploy(
        await votesToken.getAddress(),
        await timelock.getAddress(),
      );
      await governance.waitForDeployment();

      const sixHours = 6n * 60n * 60n;
      expect(await governance.EMERGENCY_VOTING_PERIOD()).to.equal(sixHours);
    });

    it('CRITICAL_VOTING_PERIOD is 1 hour', async function () {
      const SentinelGovernance =
        await ethers.getContractFactory('SentinelGovernance');
      const timelock = await deployTimelockController(owner);
      governance = await SentinelGovernance.deploy(
        await votesToken.getAddress(),
        await timelock.getAddress(),
      );
      await governance.waitForDeployment();

      const oneHour = 60n * 60n;
      expect(await governance.CRITICAL_VOTING_PERIOD()).to.equal(oneHour);
    });
  });

  describe('Deployment', function () {
    beforeEach(async function () {
      const SentinelGovernance =
        await ethers.getContractFactory('SentinelGovernance');
      const timelock = await deployTimelockController(owner);
      governance = await SentinelGovernance.deploy(
        await votesToken.getAddress(),
        await timelock.getAddress(),
      );
      await governance.waitForDeployment();
    });

    it('has the correct governor name', async function () {
      expect(await governance.name()).to.equal('SentinelGovernance');
    });

    it('initialises totalProposalsCreated to 0', async function () {
      expect(await governance.totalProposalsCreated()).to.equal(0n);
    });

    it('initialises totalProposalsExecuted to 0', async function () {
      expect(await governance.totalProposalsExecuted()).to.equal(0n);
    });

    it('initialises emergencyProposalsExecuted to 0', async function () {
      expect(await governance.emergencyProposalsExecuted()).to.equal(0n);
    });

    it('returns 0 governance reputation for any address', async function () {
      expect(await governance.governanceReputation(voter.address)).to.equal(0n);
    });

    it('EMERGENCY_QUORUM_PERCENTAGE is 10', async function () {
      expect(await governance.EMERGENCY_QUORUM_PERCENTAGE()).to.equal(10n);
    });

    it('CRITICAL_QUORUM_PERCENTAGE is 5', async function () {
      expect(await governance.CRITICAL_QUORUM_PERCENTAGE()).to.equal(5n);
    });

    it('EXECUTION_GRACE_PERIOD is 7 days', async function () {
      const sevenDays = 7n * 24n * 60n * 60n;
      expect(await governance.EXECUTION_GRACE_PERIOD()).to.equal(sevenDays);
    });
  });

  describe('proposeEmergency', function () {
    it('reverts when caller has insufficient governance reputation (< 100)', async function () {
      const SentinelGovernance =
        await ethers.getContractFactory('SentinelGovernance');
      const timelock = await deployTimelockController(owner);
      governance = await SentinelGovernance.deploy(
        await votesToken.getAddress(),
        await timelock.getAddress(),
      );
      await governance.waitForDeployment();

      await expect(
        governance
          .connect(voter)
          .proposeEmergency(
            [owner.address],
            [0],
            ['0x'],
            'Emergency: critical exploit detected',
          ),
      ).to.be.revertedWith('Insufficient reputation for emergency proposal');
    });
  });
});
