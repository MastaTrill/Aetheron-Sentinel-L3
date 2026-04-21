// test/SentinelTimelock.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelTimelock', function () {
  let timelock;
  let owner, proposer, executor, stranger;
  const MIN_DELAY = 100; // seconds

  beforeEach(async function () {
    [owner, proposer, executor, stranger] = await ethers.getSigners();

    const SentinelTimelock = await ethers.getContractFactory('SentinelTimelock');
    timelock = await SentinelTimelock.deploy(
      MIN_DELAY,
      [proposer.address],
      [executor.address],
      owner.address,
    );
    await timelock.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets the minimum delay', async function () {
      expect(await timelock.getMinDelay()).to.equal(BigInt(MIN_DELAY));
    });

    it('grants PROPOSER_ROLE to the proposer', async function () {
      const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
      expect(await timelock.hasRole(PROPOSER_ROLE, proposer.address)).to.be
        .true;
    });

    it('grants EXECUTOR_ROLE to the executor', async function () {
      const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
      expect(await timelock.hasRole(EXECUTOR_ROLE, executor.address)).to.be
        .true;
    });

    it('grants TIMELOCK_ADMIN_ROLE to the admin', async function () {
      const ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
      expect(await timelock.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it('does not grant PROPOSER_ROLE to a stranger', async function () {
      const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
      expect(await timelock.hasRole(PROPOSER_ROLE, stranger.address)).to.be
        .false;
    });
  });

  describe('scheduleCriticalOperation', function () {
    const target = ethers.ZeroAddress;
    const value = 0n;
    const data = '0x';
    const predecessor = ethers.ZeroHash;

    it('reverts when called by a non-proposer', async function () {
      await expect(
        timelock
          .connect(stranger)
          .scheduleCriticalOperation(
            target,
            value,
            data,
            predecessor,
            ethers.id('salt-1'),
            MIN_DELAY,
          ),
      ).to.be.revertedWith(/AccessControl/);
    });

    it('reverts when delay is below the minimum', async function () {
      await expect(
        timelock
          .connect(proposer)
          .scheduleCriticalOperation(
            target,
            value,
            data,
            predecessor,
            ethers.id('salt-2'),
            MIN_DELAY - 1,
          ),
      ).to.be.revertedWith('Delay too short');
    });

    it('schedules an operation when called by proposer with sufficient delay', async function () {
      const salt = ethers.id('salt-3');
      await timelock
        .connect(proposer)
        .scheduleCriticalOperation(
          target,
          value,
          data,
          predecessor,
          salt,
          MIN_DELAY,
        );

      const opId = await timelock.hashOperation(
        target,
        value,
        data,
        predecessor,
        salt,
      );
      expect(await timelock.isOperation(opId)).to.be.true;
    });

    it('scheduled operation is not yet ready immediately after scheduling', async function () {
      const salt = ethers.id('salt-4');
      await timelock
        .connect(proposer)
        .scheduleCriticalOperation(
          target,
          value,
          data,
          predecessor,
          salt,
          MIN_DELAY,
        );

      const opId = await timelock.hashOperation(
        target,
        value,
        data,
        predecessor,
        salt,
      );
      expect(await timelock.isOperationReady(opId)).to.be.false;
    });

    it('operation becomes ready after the delay elapses', async function () {
      const salt = ethers.id('salt-5');
      await timelock
        .connect(proposer)
        .scheduleCriticalOperation(
          target,
          value,
          data,
          predecessor,
          salt,
          MIN_DELAY,
        );

      await ethers.provider.send('evm_increaseTime', [MIN_DELAY + 1]);
      await ethers.provider.send('evm_mine', []);

      const opId = await timelock.hashOperation(
        target,
        value,
        data,
        predecessor,
        salt,
      );
      expect(await timelock.isOperationReady(opId)).to.be.true;
    });
  });
});
