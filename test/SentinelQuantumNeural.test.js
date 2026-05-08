import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelQuantumNeural', function () {
  it('deploys successfully with explicit gas limit', async function () {
    const { ethers } = await network.getOrCreate();
    const [owner] = await ethers.getSigners();
    const SentinelQuantumNeural = await ethers.getContractFactory('SentinelQuantumNeural');

    const contract = await SentinelQuantumNeural.deploy(owner.address, {
      gasLimit: 16_000_000,
    });
    await contract.waitForDeployment();

    expect(await contract.owner()).to.equal(owner.address);
  });
});
