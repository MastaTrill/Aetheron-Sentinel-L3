import { expect } from 'chai';
import { network } from 'hardhat';

describe('Sentinel L3 Threat Simulation', function () {
  let guard, coreLoop, owner, other;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, other] = await ethers.getSigners();

    const Guard = await ethers.getContractFactory('SentinelQuantumGuard');
    guard = await Guard.deploy(owner.address);
    await guard.waitForDeployment();

    const CoreLoop = await ethers.getContractFactory('SentinelCoreLoop');
    coreLoop = await CoreLoop.deploy(owner.address);
    await coreLoop.waitForDeployment();
  });

  it('deploys with default security status', async function () {
    const [score, level] = await guard.getSecurityStatus();
    expect(score).to.equal(800n);
    expect(level).to.equal(0n);
  });

  it('escalates to critical and pauses', async function () {
    await guard.escalateSecurityLevel(2, 'critical');
    expect(await guard.currentSecurityLevel()).to.equal(2n);
    expect(await guard.paused()).to.equal(true);
  });
});
