// test/SentinelInterceptor.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelInterceptor', function () {
  let interceptor;
  let owner, monitorUser;

  beforeEach(async function () {
    [owner, monitorUser] = await ethers.getSigners();

    const SentinelInterceptor = await ethers.getContractFactory(
      'SentinelInterceptor',
    );
    interceptor = await SentinelInterceptor.deploy(
      10,
      ethers.parseEther('1000'),
      true,
      owner.address,
    );
    await interceptor.waitForDeployment();

    const MONITOR_ROLE = await interceptor.MONITOR_ROLE();
    await interceptor.grantRole(MONITOR_ROLE, monitorUser.address);

    // Authorize the monitor as a reporter
    await interceptor.addReporter(monitorUser.address);
  });

  describe('getAnomalyStats', function () {
    it('returns zeroed stats initially', async function () {
      const [total, lastBlock, consecutive, freq] =
        await interceptor.getAnomalyStats();
      expect(total).to.equal(0);
      expect(consecutive).to.equal(0);
    });
  });

  describe('detectAnomaly', function () {
    it('increments anomaly count', async function () {
      for (let i = 0; i < 10; i++) {
        await ethers.provider.send('evm_mine', []);
      }
      await interceptor.connect(monitorUser).detectAnomaly(1, 30);
      const [total] = await interceptor.getAnomalyStats();
      expect(total).to.equal(1);
    });

    it('rejects invalid anomaly type', async function () {
      await expect(
        interceptor.connect(monitorUser).detectAnomaly(0, 30),
      ).to.be.revertedWith('Invalid anomaly type');
      await expect(
        interceptor.connect(monitorUser).detectAnomaly(11, 30),
      ).to.be.revertedWith('Invalid anomaly type');
    });

    it('rejects severity above 100', async function () {
      await expect(
        interceptor.connect(monitorUser).detectAnomaly(1, 101),
      ).to.be.revertedWith('Invalid severity');
    });
  });
});
