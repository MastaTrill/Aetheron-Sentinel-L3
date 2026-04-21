import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelHomomorphicEncryption', function () {
  let he;
  let owner;
  let user;
  let other;

  beforeEach(async function () {
    [owner, user, other] = await ethers.getSigners();
    const SentinelHomomorphicEncryption = await ethers.getContractFactory(
      'SentinelHomomorphicEncryption',
    );
    he = await SentinelHomomorphicEncryption.deploy(owner.address);
    await he.waitForDeployment();
  });

  it('deploys and initializes core parameters', async function () {
    expect(await he.owner()).to.equal(owner.address);
    expect(await he.SECURITY_LEVEL()).to.equal(128n);
    expect(await he.publicKey()).to.not.equal(ethers.ZeroHash);
  });

  it('encrypts and exposes ciphertext metadata', async function () {
    const randomness = 12345n;
    await he.connect(user).encryptValue(42, randomness);
    const ciphertextId = await he.activeCiphertexts(0);

    const [, , encryptor, timestamp, isExpired] =
      await he.getCiphertext(ciphertextId);
    expect(encryptor).to.equal(user.address);
    expect(timestamp).to.be.gt(0n);
    expect(isExpired).to.equal(false);
  });

  it('reverts encrypt when randomness is zero', async function () {
    await expect(he.encryptValue(42, 0)).to.be.revertedWith(
      'Randomness cannot be zero',
    );
  });

  it('performs homomorphic add and verifies result', async function () {
    await he.connect(user).encryptValue(10, 1001);
    await he.connect(other).encryptValue(20, 2002);
    const id1 = await he.activeCiphertexts(0);
    const id2 = await he.activeCiphertexts(1);

    await he.homomorphicAdd(id1, id2);
    const resultId = await he.computationResults(0);
    expect(await he.verifyHomomorphicResult(resultId)).to.equal(true);
  });

  it('decrypt allows encryptor with matching key and blocks others', async function () {
    const randomness = 778899n;
    await he.connect(user).encryptValue(123, randomness);
    const ciphertextId = await he.activeCiphertexts(0);

    const key = ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'string'],
        [randomness, 'decryption_key'],
      ),
    );

    await he.connect(user).decryptCiphertext(ciphertextId, key);

    await expect(
      he.connect(other).decryptCiphertext(ciphertextId, key),
    ).to.be.revertedWith('Unauthorized decryption');
  });
});
