// test/SentinelMultiSigTimelock.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelMultiSigTimelock', function () {
  this.timeout(100000);
  let timelock, owner, g1, g2, g3, nonGuardian;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, g1, g2, g3, nonGuardian] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('SentinelMultiSigTimelock');
    timelock = await Factory.deploy(owner.address, [g1.address, g2.address, g3.address], 2);
    await timelock.waitForDeployment();
  });

  it('deploys with correct guardian count and required signatures', async function () {
    expect(await timelock.getGuardianCount()).to.equal(3n);
    expect(await timelock.requiredSignatures()).to.equal(2n);
    expect(await timelock.isGuardian(g1.address)).to.equal(true);
    expect(await timelock.isGuardian(nonGuardian.address)).to.equal(false);
  });

  it('allows owner to queue a proposal', async function () {
    const delay = 2 * 24 * 60 * 60; // 2 days
    const tx = await timelock.queueProposal(g1.address, '0x', 0, delay);
    await tx.wait();
    expect(await timelock.proposalCount()).to.equal(1n);
  });

  it('allows guardians to sign proposals', async function () {
    const delay = 2 * 24 * 60 * 60;
    const tx = await timelock.queueProposal(g1.address, '0x', 0, delay);
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].topics[1];

    await timelock.connect(g1).signProposal(proposalId);
    await timelock.connect(g2).signProposal(proposalId);

    const p = await timelock.proposals(proposalId);
    expect(p.signatureCount).to.equal(2n);
  });

  it('prevents non-guardians from signing proposals', async function () {
    const delay = 2 * 24 * 60 * 60;
    const tx = await timelock.queueProposal(g1.address, '0x', 0, delay);
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].topics[1];

    await expect(
      timelock.connect(nonGuardian).signProposal(proposalId)
    ).to.be.revertedWith('Not a guardian');
  });

  it('prevents duplicate signing by same guardian', async function () {
    const delay = 2 * 24 * 60 * 60;
    const tx = await timelock.queueProposal(g1.address, '0x', 0, delay);
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].topics[1];

    await timelock.connect(g1).signProposal(proposalId);
    await expect(timelock.connect(g1).signProposal(proposalId)).to.be.revertedWith('Already signed');
  });
});
