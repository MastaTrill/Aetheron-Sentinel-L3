import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelCrossChainSecurityOracle', function () {
  let oracle;
  let owner, reporter, other;
  let ethers;

  // Dummy LayerZero Endpoint Address
  const lzEndpointMock = '0x0000000000000000000000000000000000000001';

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, reporter, other] = await ethers.getSigners();

    const SentinelCrossChainSecurityOracle = await ethers.getContractFactory(
      'SentinelCrossChainSecurityOracle'
    );
    oracle = await SentinelCrossChainSecurityOracle.deploy(lzEndpointMock);
    await oracle.waitForDeployment();
  });

  describe('Configuration', function () {
    it('should allow owner to configure a chain oracle', async function () {
      await oracle.configureChainOracle(137, reporter.address, 90);
      const config = await oracle.chainConfigs(137);

      expect(config.chainId).to.equal(137n);
      expect(config.oracleAddress).to.equal(reporter.address);
      expect(config.isActive).to.be.true;
      expect(config.trustScore).to.equal(90n);
    });

    it('should reject invalid trust scores', async function () {
      await expect(oracle.configureChainOracle(137, reporter.address, 101)).to.be.revertedWith(
        'Invalid trust score'
      );
    });
  });

  describe('Reporting Security Data', function () {
    const chainId = 137;
    let dataHash;

    beforeEach(async function () {
      dataHash = ethers.id('test-data-hash');
      await oracle.configureChainOracle(chainId, reporter.address, 90);
    });

    it('should allow configured oracle to report data', async function () {
      await expect(
        oracle.connect(reporter).reportSecurityData(
          chainId,
          50, // threatLevel
          2, // anomalyCount
          1, // activeAlerts
          dataHash,
          '0x' // Empty signature skips signature check
        )
      )
        .to.emit(oracle, 'SecurityDataReported')
        .withArgs(chainId, dataHash, 50n);

      const data = await oracle.securityData(dataHash);
      expect(data.threatLevel).to.equal(50n);
      expect(data.reporter).to.equal(reporter.address);
    });

    it('should reject reports from unauthorized addresses', async function () {
      await expect(
        oracle.connect(other).reportSecurityData(chainId, 50, 2, 1, dataHash, '0x')
      ).to.be.revertedWith('Unauthorized reporter');
    });

    it('should reject reports for unconfigured chains', async function () {
      await expect(
        oracle.connect(reporter).reportSecurityData(
          999, // Unconfigured chain
          50,
          2,
          1,
          dataHash,
          '0x'
        )
      ).to.be.revertedWith('Chain not configured');
    });
  });
});
