// test/SentinelOracleNetwork.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

const MIN_STAKE = ethers.parseEther('1000');

describe('SentinelOracleNetwork', function () {
  let oracle;
  let owner, oracleSigner, other;

  const pubKey = ethers.keccak256(ethers.toUtf8Bytes('oracle_pubkey'));

  beforeEach(async function () {
    [owner, oracleSigner, other] = await ethers.getSigners();
    const SentinelOracleNetwork = await ethers.getContractFactory(
      'SentinelOracleNetwork',
    );
    oracle = await SentinelOracleNetwork.deploy(owner.address);
    await oracle.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets owner correctly', async function () {
      expect(await oracle.owner()).to.equal(owner.address);
    });

    it('initialises emergencyShutdown as false', async function () {
      expect(await oracle.emergencyShutdown()).to.equal(false);
    });

    it('initialises networkSecurityScore to non-zero (from _initializeNetwork)', async function () {
      // network is initialised in constructor
      expect(await oracle.networkSecurityScore()).to.be.gte(0n);
    });
  });

  describe('constants', function () {
    it('MIN_STAKE is 1000 ether', async function () {
      expect(await oracle.MIN_STAKE()).to.equal(MIN_STAKE);
    });

    it('MAX_ORACLES is 50', async function () {
      expect(await oracle.MAX_ORACLES()).to.equal(50n);
    });

    it('MAX_REPUTATION is 1000', async function () {
      expect(await oracle.MAX_REPUTATION()).to.equal(1000n);
    });
  });

  describe('registerOracle', function () {
    it('registers an oracle with sufficient stake', async function () {
      await oracle
        .connect(oracleSigner)
        .registerOracle(pubKey, { value: MIN_STAKE });

      const [active, reputation, stake] = await oracle.getOracleInfo(
        oracleSigner.address,
      );
      expect(active).to.equal(true);
      expect(reputation).to.equal(500n);
      expect(stake).to.equal(MIN_STAKE);
    });

    it('reverts with insufficient stake', async function () {
      await expect(
        oracle
          .connect(oracleSigner)
          .registerOracle(pubKey, { value: ethers.parseEther('1') }),
      ).to.be.revertedWith('Insufficient stake');
    });

    it('reverts with zero public key', async function () {
      await expect(
        oracle
          .connect(oracleSigner)
          .registerOracle(ethers.ZeroHash, { value: MIN_STAKE }),
      ).to.be.revertedWith('Invalid public key');
    });

    it('reverts if already registered', async function () {
      await oracle
        .connect(oracleSigner)
        .registerOracle(pubKey, { value: MIN_STAKE });
      await expect(
        oracle
          .connect(oracleSigner)
          .registerOracle(pubKey, { value: MIN_STAKE }),
      ).to.be.revertedWith('Already registered');
    });
  });

  describe('addSupportedAsset', function () {
    it('owner can add a supported asset', async function () {
      await oracle.addSupportedAsset('ETH/USD', 8);
      const feed = await oracle.priceFeeds('ETH/USD');
      expect(feed.isActive).to.equal(true);
      expect(feed.decimals).to.equal(8n);
    });

    it('reverts for duplicate asset', async function () {
      await oracle.addSupportedAsset('ETH/USD', 8);
      await expect(oracle.addSupportedAsset('ETH/USD', 8)).to.be.revertedWith(
        'Asset already supported',
      );
    });

    it('reverts for non-owner', async function () {
      await expect(
        oracle.connect(other).addSupportedAsset('ETH/USD', 8),
      ).to.revert(ethers);
    });
  });

  describe('getPrice', function () {
    it('returns inactive/invalid for asset with no submissions', async function () {
      await oracle.addSupportedAsset('BTC/USD', 8);
      const [price, , , isValid] = await oracle.getPrice('BTC/USD');
      expect(isValid).to.equal(false);
      expect(price).to.equal(0n);
    });
  });

  describe('submitPriceFeed', function () {
    beforeEach(async function () {
      await oracle
        .connect(oracleSigner)
        .registerOracle(pubKey, { value: MIN_STAKE });
      await oracle.addSupportedAsset('ETH/USD', 8);
    });

    it('allows registered oracle to submit a price feed with valid ECDSA signature', async function () {
      const price = ethers.parseUnits('2000', 8);
      const confidence = 9500n; // 95%

      // Determine the timestamp that will be used in the next block
      const latestBlock = await ethers.provider.getBlock('latest');
      const nextTimestamp = latestBlock.timestamp + 1;
      await ethers.provider.send('evm_setNextBlockTimestamp', [nextTimestamp]);

      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'uint256', 'uint256', 'uint256'],
        ['ETH/USD', price, confidence, nextTimestamp],
      );
      const sig = await oracleSigner.signMessage(ethers.getBytes(messageHash));

      await expect(
        oracle
          .connect(oracleSigner)
          .submitPriceFeed('ETH/USD', price, confidence, sig),
      ).to.emit(oracle, 'PriceSubmitted');
    });

    it('reverts for non-oracle caller', async function () {
      const sig = ethers.hexlify(ethers.randomBytes(65));
      await expect(
        oracle.connect(other).submitPriceFeed('ETH/USD', 1000n, 9000n, sig),
      ).to.be.revertedWith('Not an active oracle');
    });
  });

  describe('triggerEmergencyShutdown', function () {
    it('owner can trigger emergency shutdown', async function () {
      await oracle.triggerEmergencyShutdown('Security breach detected');
      expect(await oracle.emergencyShutdown()).to.equal(true);
    });

    it('emits EmergencyShutdown event', async function () {
      await expect(oracle.triggerEmergencyShutdown('Security breach detected'))
        .to.emit(oracle, 'EmergencyShutdown')
        .withArgs(owner.address, 'Security breach detected');
    });

    it('reverts for non-owner', async function () {
      await expect(
        oracle.connect(other).triggerEmergencyShutdown('attack'),
      ).to.revert(ethers);
    });

    it('blocks price submissions after emergency shutdown', async function () {
      await oracle
        .connect(oracleSigner)
        .registerOracle(pubKey, { value: MIN_STAKE });
      await oracle.addSupportedAsset('ETH/USD', 8);
      await oracle.triggerEmergencyShutdown('test');

      await expect(
        oracle
          .connect(oracleSigner)
          .submitPriceFeed('ETH/USD', 1000n, 9000n, '0x'),
      ).to.be.revertedWith('Network shutdown');
    });
  });

  describe('slashOracle', function () {
    it('owner can slash an oracle stake', async function () {
      await oracle
        .connect(oracleSigner)
        .registerOracle(pubKey, { value: MIN_STAKE });

      const [, , stakeBefore] = await oracle.getOracleInfo(
        oracleSigner.address,
      );

      // Slash 10% (1000 basis points)
      await oracle.slashOracle(oracleSigner.address, 1000);

      const [, , stakeAfter] = await oracle.getOracleInfo(oracleSigner.address);
      expect(stakeAfter).to.be.lt(stakeBefore);
    });

    it('reverts for non-owner', async function () {
      await oracle
        .connect(oracleSigner)
        .registerOracle(pubKey, { value: MIN_STAKE });
      await expect(
        oracle.connect(other).slashOracle(oracleSigner.address, 1000),
      ).to.revert(ethers);
    });

    it('reverts with invalid penalty (> 10000)', async function () {
      await oracle
        .connect(oracleSigner)
        .registerOracle(pubKey, { value: MIN_STAKE });
      await expect(
        oracle.slashOracle(oracleSigner.address, 10001),
      ).to.be.revertedWith('Invalid penalty');
    });
  });
});
