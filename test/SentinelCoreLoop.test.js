import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelCoreLoop', function () {
  let coreLoop;
  let owner;
  let other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const SentinelCoreLoop =
      await ethers.getContractFactory('SentinelCoreLoop');
    coreLoop = await SentinelCoreLoop.deploy(owner.address);
    await coreLoop.waitForDeployment();
  });

  it('deploys with owner and initializing status', async function () {
    expect(await coreLoop.owner()).to.equal(owner.address);
    expect(await coreLoop.currentStatus()).to.equal(0n); // INITIALIZING
  });

  it('assigns core roles to owner', async function () {
    const operatorRole = await coreLoop.OPERATOR_ROLE();
    const governorRole = await coreLoop.GOVERNOR_ROLE();
    expect(await coreLoop.hasRole(operatorRole, owner.address)).to.equal(true);
    expect(await coreLoop.hasRole(governorRole, owner.address)).to.equal(true);
  });

  it('activates autonomous behaviors by default', async function () {
    expect(await coreLoop.autonomousBehaviors('threat_interception')).to.equal(
      true,
    );
    expect(await coreLoop.autonomousBehaviors('yield_optimization')).to.equal(
      true,
    );
  });

  it('rejects emergency shutdown for unauthorized account', async function () {
    await expect(
      coreLoop.connect(other).emergencyShutdown(),
    ).to.be.revertedWith('Unauthorized emergency shutdown');
  });

  it('owner can trigger emergency shutdown', async function () {
    await coreLoop.emergencyShutdown();
    expect(await coreLoop.currentStatus()).to.equal(4n); // QUANTUM_LOCKDOWN
    expect(await coreLoop.paused()).to.equal(true);
  });

  it('governor can recover from lockdown', async function () {
    await coreLoop.emergencyShutdown();
    await coreLoop.emergencyRecovery();

    expect(await coreLoop.currentStatus()).to.equal(1n); // ACTIVE
    expect(await coreLoop.paused()).to.equal(false);
  });

  it('emergencySystemReset requires governor role', async function () {
    await expect(
      coreLoop.connect(other).emergencySystemReset(),
    ).to.be.revertedWith('Requires governor role');
  });
});
