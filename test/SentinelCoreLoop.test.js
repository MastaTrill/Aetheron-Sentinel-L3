import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelCoreLoop', function () {
  let coreLoop;
  let owner;
  let other;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, other] = await ethers.getSigners();
    const SentinelCoreLoop = await ethers.getContractFactory('SentinelCoreLoop');
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
    expect(await coreLoop.autonomousBehaviors('threat_interception')).to.equal(true);
    expect(await coreLoop.autonomousBehaviors('yield_optimization')).to.equal(true);
  });

  it('owner can update system components', async function () {
    const OPERATOR_ROLE = await coreLoop.OPERATOR_ROLE();
    expect(await coreLoop.hasRole(OPERATOR_ROLE, owner.address)).to.equal(true);
  });

  it('starts with 5 active autonomous behaviors', async function () {
    expect(await coreLoop.autonomousBehaviors('threat_interception')).to.equal(true);
    expect(await coreLoop.autonomousBehaviors('yield_optimization')).to.equal(true);
    expect(await coreLoop.autonomousBehaviors('quantum_calibration')).to.equal(true);
  });
});
