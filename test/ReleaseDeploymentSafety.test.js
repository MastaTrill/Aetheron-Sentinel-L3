import { expect } from 'chai';
import { network } from 'hardhat';

describe('sentinel-guardrails-v1 deployment safety', function () {
  this.timeout(120000);
  let ethers;
  let deployer;
  let safe;
  let monitor;
  let interceptor;
  let circuitBreaker;
  let rateLimiter;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [deployer, safe, monitor] = await ethers.getSigners();

    interceptor = await ethers.deployContract('SentinelInterceptor', [
      80,
      ethers.parseEther('1000'),
      false,
      deployer.address,
    ]);
    circuitBreaker = await ethers.deployContract('CircuitBreaker', [deployer.address]);
    rateLimiter = await ethers.deployContract('RateLimiter', [deployer.address]);

    await interceptor.grantRole(await interceptor.MONITOR_ROLE(), monitor.address);
    await interceptor.addReporter(monitor.address);
    await circuitBreaker.grantRole(await circuitBreaker.MONITOR_ROLE(), monitor.address);
    await rateLimiter.grantRole(await rateLimiter.MONITOR_ROLE(), monitor.address);

    for (const contract of [interceptor, circuitBreaker, rateLimiter]) {
      await contract.emergencyPause();
      await contract.transferOwnership(safe.address);
    }
  });

  it('hands every ownership and admin role to the final owner', async function () {
    for (const contract of [interceptor, circuitBreaker, rateLimiter]) {
      expect(await contract.owner()).to.equal(safe.address);
      expect(await contract.hasRole(ethers.ZeroHash, safe.address)).to.equal(true);
      expect(await contract.hasRole(ethers.ZeroHash, deployer.address)).to.equal(false);
    }
  });

  it('leaves every production contract paused after handoff', async function () {
    for (const contract of [interceptor, circuitBreaker, rateLimiter]) {
      expect(await contract.paused()).to.equal(true);
    }

    await expect(circuitBreaker.isCircuitClosed(8453)).to.be.revertedWithCustomError(
      circuitBreaker,
      'EnforcedPause'
    );
  });

  it('retains only the explicitly configured monitoring authority', async function () {
    expect(await interceptor.hasRole(await interceptor.MONITOR_ROLE(), monitor.address)).to.equal(
      true
    );
    expect(await interceptor.authorizedReporters(monitor.address)).to.equal(true);
    expect(
      await circuitBreaker.hasRole(await circuitBreaker.MONITOR_ROLE(), monitor.address)
    ).to.equal(true);
    expect(await rateLimiter.hasRole(await rateLimiter.MONITOR_ROLE(), monitor.address)).to.equal(
      true
    );

    expect(await interceptor.hasRole(await interceptor.MONITOR_ROLE(), deployer.address)).to.equal(
      false
    );
    expect(
      await circuitBreaker.hasRole(await circuitBreaker.MONITOR_ROLE(), deployer.address)
    ).to.equal(false);
    expect(await rateLimiter.hasRole(await rateLimiter.MONITOR_ROLE(), deployer.address)).to.equal(
      false
    );
  });
});
