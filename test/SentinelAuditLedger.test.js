// test/SentinelAuditLedger.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelAuditLedger', function () {
  this.timeout(100000);
  let ledger, owner, attacker;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, attacker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('SentinelAuditLedger');
    ledger = await Factory.deploy(owner.address);
    await ledger.waitForDeployment();
  });

  it('deploys with zero proofs', async function () {
    expect(await ledger.getProofCount()).to.equal(0n);
    expect(await ledger.totalValueSavedEth()).to.equal(0n);
  });

  it('allows owner to record an incident proof', async function () {
    const incidentId = ethers.id('INC-2026-001');
    const proofHash = ethers.id('SHA256_HASH_123');
    const valueSaved = ethers.parseEther('4.25');

    const tx = await ledger.recordProof(
      incidentId,
      proofHash,
      valueSaved,
      'ipfs://QmProof123'
    );
    await tx.wait();

    expect(await ledger.getProofCount()).to.equal(1n);
    expect(await ledger.totalValueSavedEth()).to.equal(valueSaved);

    const record = await ledger.proofs(incidentId);
    expect(record.proofHash).to.equal(proofHash);
    expect(record.valueSavedEth).to.equal(valueSaved);
    expect(record.exists).to.equal(true);
  });

  it('prevents non-owner from recording proof', async function () {
    const incidentId = ethers.id('INC-2026-FAKE');
    const proofHash = ethers.id('HASH');

    await expect(
      ledger
        .connect(attacker)
        .recordProof(incidentId, proofHash, 0, 'ipfs://fake')
    ).to.be.revertedWithCustomError(ledger, 'OwnableUnauthorizedAccount');
  });

  it('rejects duplicate proof recording for the same incident ID', async function () {
    const incidentId = ethers.id('INC-DUP');
    const proofHash = ethers.id('HASH');

    await ledger.recordProof(incidentId, proofHash, 0, 'ipfs://dup');

    await expect(
      ledger.recordProof(incidentId, proofHash, 0, 'ipfs://dup2')
    ).to.be.revertedWith('Proof already recorded for this incident');
  });
});
