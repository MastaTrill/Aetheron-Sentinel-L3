import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelQuantumNeural', function () {
  it('deployment exceeds local hardhat transaction gas cap', async function () {
    const [owner] = await ethers.getSigners();
    const SentinelQuantumNeural = await ethers.getContractFactory(
      'SentinelQuantumNeural',
    );

    let failed = false;
    try {
      const contract = await SentinelQuantumNeural.deploy(owner.address, {
        gasLimit: 16_000_000,
      });
      await contract.waitForDeployment();
    } catch {
      failed = true;
    }

    expect(failed).to.equal(true);
  });
});
