import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelQuantumKeyDistribution', function () {
  let qkd;
  let owner;
  let user;
  let responder;

  beforeEach(async function () {
    [owner, user, responder] = await ethers.getSigners();
    const SentinelQuantumKeyDistribution = await ethers.getContractFactory(
      'SentinelQuantumKeyDistribution',
    );
    qkd = await SentinelQuantumKeyDistribution.deploy(owner.address);
    await qkd.waitForDeployment();
  });

  it('deploys with default quantum network parameters', async function () {
    expect(await qkd.owner()).to.equal(owner.address);
    expect(await qkd.entanglementEntropy()).to.equal(85n);
    expect(await qkd.quantumBitErrorRate()).to.equal(2n);
    expect(await qkd.keyDistributionSuccessRate()).to.equal(95n);
  });

  it('only owner can generate keys', async function () {
    await expect(
      qkd.connect(user).generateQuantumKey(user.address, 256),
    ).to.revert(ethers);
  });

  it('generates and activates a key', async function () {
    await qkd.generateQuantumKey(user.address, 256);
    const keyId = await qkd.userKeys(user.address, 0);

    let [, keyLength, , , active, state] = await qkd.getQuantumKey(keyId);
    expect(keyLength).to.equal(256n);
    expect(active).to.equal(true);
    expect(state).to.equal(1n); // DISTRIBUTED

    await qkd
      .connect(user)
      .activateQuantumKey(keyId, ethers.toUtf8Bytes('proof'));
    [, , , , , state] = await qkd.getQuantumKey(keyId);
    expect(state).to.equal(2n); // ACTIVE
  });

  it('creates and completes a key exchange session', async function () {
    await qkd.generateQuantumKey(user.address, 256);
    const keyId = await qkd.userKeys(user.address, 0);
    await qkd
      .connect(user)
      .activateQuantumKey(keyId, ethers.toUtf8Bytes('proof'));

    const tx = await qkd
      .connect(user)
      .initiateKeyExchange(responder.address, keyId);
    const receipt = await tx.wait();
    let sessionId;
    for (const log of receipt.logs) {
      try {
        const parsed = qkd.interface.parseLog(log);
        if (parsed && parsed.name === 'QuantumKeyExchangeInitiated') {
          sessionId = parsed.args.sessionId;
        }
      } catch {
        // Ignore unrelated logs
      }
    }

    await qkd
      .connect(responder)
      .completeKeyExchange(
        sessionId,
        ethers.keccak256(ethers.toUtf8Bytes('shared')),
        ethers.keccak256(ethers.toUtf8Bytes('session-key')),
      );

    const [, , sessionState, establishedTime] =
      await qkd.getKeySession(sessionId);
    expect(sessionState).to.equal(2n); // ACTIVE
    expect(establishedTime).to.be.gt(0n);
  });

  it('rotates key after expiry', async function () {
    await qkd.generateQuantumKey(user.address, 256);
    const keyId = await qkd.userKeys(user.address, 0);

    await ethers.provider.send('evm_increaseTime', [8 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);

    await expect(qkd.connect(user).rotateQuantumKey(keyId)).to.emit(
      qkd,
      'QuantumKeyRotated',
    );
  });
});
