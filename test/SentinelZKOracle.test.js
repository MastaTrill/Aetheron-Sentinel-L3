import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

const MIN_STAKE = ethers.parseEther('1000');

function abiEncodeProof(proof) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  return coder.encode(
    ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[]'],
    [proof.a, proof.b, proof.c, proof.inputs],
  );
}

function makeProof(nonce) {
  return {
    a: [1n + BigInt(nonce), 2n + BigInt(nonce)],
    b: [
      [3n + BigInt(nonce), 4n + BigInt(nonce)],
      [5n + BigInt(nonce), 6n + BigInt(nonce)],
    ],
    c: [7n + BigInt(nonce), 8n + BigInt(nonce)],
    inputs: [BigInt(nonce), 42n],
  };
}

function findValidProof() {
  for (let i = 0; i < 500; i++) {
    const p = makeProof(i);
    const hash = ethers.keccak256(abiEncodeProof(p));
    if (BigInt(hash) % 100n < 95n) {
      return p;
    }
  }
  throw new Error('Could not find valid proof');
}

describe('SentinelZKOracle', function () {
  let zkOracle;
  let owner;
  let oracle1;

  beforeEach(async function () {
    [owner, oracle1] = await ethers.getSigners();
    const SentinelZKOracle =
      await ethers.getContractFactory('SentinelZKOracle');
    zkOracle = await SentinelZKOracle.deploy(owner.address);
    await zkOracle.waitForDeployment();
  });

  it('deploys with default feeds active', async function () {
    const [, , , isValid] = await zkOracle.getZKData('ETH/USD');
    expect(await zkOracle.owner()).to.equal(owner.address);
    expect(isValid).to.equal(false);
  });

  it('requires minimum stake for oracle registration', async function () {
    await expect(
      zkOracle
        .connect(oracle1)
        .registerZKOracle(ethers.keccak256(ethers.toUtf8Bytes('pk')), {
          value: ethers.parseEther('1'),
        }),
    ).to.be.revertedWith('Insufficient stake');
  });

  it('registers oracle with sufficient stake', async function () {
    await zkOracle
      .connect(oracle1)
      .registerZKOracle(ethers.keccak256(ethers.toUtf8Bytes('pk')), {
        value: MIN_STAKE,
      });

    expect(await zkOracle.oracleStakes(oracle1.address)).to.equal(MIN_STAKE);
  });

  it('rejects ZK submission from unstaked oracle', async function () {
    const proof = findValidProof();
    await expect(
      zkOracle
        .connect(oracle1)
        .submitZKProof(
          'ETH/USD',
          ethers.keccak256(ethers.toUtf8Bytes('d1')),
          1234,
          proof,
        ),
    ).to.be.revertedWith('Insufficient stake');
  });

  it('accepts valid ZK submission for active feed', async function () {
    const proof = findValidProof();
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes('eth-price-1'));

    await zkOracle
      .connect(oracle1)
      .registerZKOracle(ethers.keccak256(ethers.toUtf8Bytes('pk')), {
        value: MIN_STAKE,
      });

    await expect(
      zkOracle
        .connect(oracle1)
        .submitZKProof('ETH/USD', dataHash, 250000000000n, proof),
    ).to.emit(zkOracle, 'ZKProofSubmitted');
  });

  it('updates feed after consensus threshold (3 matching submissions)', async function () {
    const proof = findValidProof();
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes('eth-consensus'));
    const value = 210000000000n;

    await zkOracle
      .connect(oracle1)
      .registerZKOracle(ethers.keccak256(ethers.toUtf8Bytes('pk')), {
        value: MIN_STAKE,
      });

    await zkOracle
      .connect(oracle1)
      .submitZKProof('ETH/USD', dataHash, value, proof);
    await zkOracle
      .connect(oracle1)
      .submitZKProof('ETH/USD', dataHash, value, proof);
    await zkOracle
      .connect(oracle1)
      .submitZKProof('ETH/USD', dataHash, value, proof);

    const [feedValue, , confidence, isValid] =
      await zkOracle.getZKData('ETH/USD');
    expect(feedValue).to.equal(value);
    expect(confidence).to.be.gte(75n);
    expect(isValid).to.equal(true);
  });

  it('owner can create new feed and duplicate is rejected', async function () {
    await zkOracle.createDataFeed('SOL/USD');
    const [, , , isValid] = await zkOracle.getZKData('SOL/USD');
    expect(isValid).to.equal(false);

    await expect(zkOracle.createDataFeed('SOL/USD')).to.be.revertedWith(
      'Feed already exists',
    );
  });
});
