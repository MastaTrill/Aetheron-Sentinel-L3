
import { expect } from 'chai';
import { network } from 'hardhat';

describe('DilithiumVerifierWrapper + SentinelQuantumGuard', function () {
  let guard, wrapper, owner;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner] = await ethers.getSigners();

    const Guard = await ethers.getContractFactory('SentinelQuantumGuard');
    guard = await Guard.deploy(owner.address);
    await guard.waitForDeployment();

    const Wrapper = await ethers.getContractFactory('DilithiumVerifierWrapper');
    wrapper = await Wrapper.deploy(await guard.getAddress());
    await wrapper.waitForDeployment();
  });

  it('deploys guard with default owner', async function () {
    expect(await guard.owner()).to.equal(owner.address);
  });

  it('registers oracle and stores it', async function () {
    const pubKey = ethers.keccak256(ethers.toUtf8Bytes('oracle1'));
    await guard.registerSecurityOracle(owner.address, pubKey);
    const oracle = await guard.securityOracles(owner.address);
    expect(oracle.active).to.equal(true);
    expect(oracle.reputation).to.equal(100n);
  });

  it('escalates to critical and pauses', async function () {
    await guard.escalateSecurityLevel(2, 'critical');
    expect(await guard.currentSecurityLevel()).to.equal(2n);
    expect(await guard.paused()).to.equal(true);
  });

  it('wrapper stores quantum guard address', async function () {
    expect(await wrapper.s_quantumGuard()).to.equal(await guard.getAddress());
  });
});
