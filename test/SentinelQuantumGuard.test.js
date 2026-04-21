import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelQuantumGuard', function () {
  let guard;
  let owner;
  let oracleSigner;
  let other;

  beforeEach(async function () {
    [owner, oracleSigner, other] = await ethers.getSigners();
    const SentinelQuantumGuard = await ethers.getContractFactory(
      'SentinelQuantumGuard',
    );
    guard = await SentinelQuantumGuard.deploy(owner.address);
    await guard.waitForDeployment();
  });

  it('deploys with default security status', async function () {
    const [score, level] = await guard.getSecurityStatus();
    expect(await guard.owner()).to.equal(owner.address);
    expect(score).to.equal(800n);
    expect(level).to.equal(0n); // NORMAL
  });

  it('owner registers a security oracle', async function () {
    const pubKey = ethers.keccak256(ethers.toUtf8Bytes('oracle1'));
    await guard.registerSecurityOracle(oracleSigner.address, pubKey);

    const oracle = await guard.securityOracles(oracleSigner.address);
    expect(oracle.active).to.equal(true);
    expect(oracle.reputation).to.equal(100n);
  });

  it('rejects non-owner oracle registration', async function () {
    const pubKey = ethers.keccak256(ethers.toUtf8Bytes('oracle1'));
    await expect(
      guard.connect(other).registerSecurityOracle(oracleSigner.address, pubKey),
    ).to.revert(ethers);
  });

  it('submits quantum proofs and validates a transaction', async function () {
    const pubKey = ethers.keccak256(ethers.toUtf8Bytes('oracle1'));
    await guard.registerSecurityOracle(oracleSigner.address, pubKey);

    const proofIds = [
      ethers.keccak256(ethers.toUtf8Bytes('p1')),
      ethers.keccak256(ethers.toUtf8Bytes('p2')),
      ethers.keccak256(ethers.toUtf8Bytes('p3')),
    ];

    for (const proofId of proofIds) {
      const sig = await oracleSigner.signMessage(ethers.getBytes(proofId));
      await guard.submitQuantumProof(
        proofId,
        ethers.keccak256(ethers.toUtf8Bytes('commitment')),
        ethers.randomBytes(96),
        sig,
      );
    }

    const txHash = ethers.keccak256(ethers.toUtf8Bytes('tx-to-validate'));
    const ok = await guard.validateTransaction.staticCall(txHash, proofIds);
    await guard.validateTransaction(txHash, proofIds);

    expect(ok).to.equal(true);
    expect(await guard.validatedTransactions(txHash)).to.equal(true);
  });

  it('escalates to critical and pauses contract', async function () {
    await guard.escalateSecurityLevel(2, 'critical incident'); // CRITICAL
    expect(await guard.currentSecurityLevel()).to.equal(2n);
    expect(await guard.paused()).to.equal(true);
  });
});
