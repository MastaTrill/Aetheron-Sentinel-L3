// test/CircuitBreaker.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('CircuitBreaker', function () {
  let circuitBreaker;
  let owner, monitor, attacker;
  const CHAIN_ID = 137;

  beforeEach(async function () {
    [owner, monitor, attacker] = await ethers.getSigners();

    const CircuitBreaker = await ethers.getContractFactory('CircuitBreaker');
    circuitBreaker = await CircuitBreaker.deploy(owner.address);
    await circuitBreaker.waitForDeployment();

    const MONITOR_ROLE = await circuitBreaker.MONITOR_ROLE();
    await circuitBreaker.grantRole(MONITOR_ROLE, monitor.address);
  });

  describe('Initial state', function () {
    it('starts in CLOSED state for any chain', async function () {
      const [state] = await circuitBreaker.getCircuitStats(CHAIN_ID);
      expect(state).to.equal(0); // State.CLOSED = 0
    });
  });

  describe('recordFailure', function () {
    it('opens the circuit after reaching FAILURE_THRESHOLD', async function () {
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 3);
      }
      const [state] = await circuitBreaker.getCircuitStats(CHAIN_ID);
      expect(state).to.equal(1); // State.OPEN = 1
    });

    it('opens circuit immediately on high severity failure (>= 8)', async function () {
      await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 8);
      const [state] = await circuitBreaker.getCircuitStats(CHAIN_ID);
      expect(state).to.equal(1);
    });

    it('rejects invalid chain ID', async function () {
      await expect(
        circuitBreaker.connect(monitor).recordFailure(0, 3),
      ).to.be.revertedWith('Invalid chain ID');
    });

    it('rejects invalid severity', async function () {
      await expect(
        circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 11),
      ).to.be.revertedWith('Invalid severity');
    });

    it('rejects non-monitor callers', async function () {
      const monitorRole = await circuitBreaker.MONITOR_ROLE();
      await expect(
        circuitBreaker.connect(attacker).recordFailure(CHAIN_ID, 3),
      ).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${monitorRole}`,
      );
    });
  });

  describe('getCircuitStats', function () {
    it('returns correct failure count', async function () {
      await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 3);
      await circuitBreaker.connect(monitor).recordFailure(CHAIN_ID, 3);
      const [, failures] = await circuitBreaker.getCircuitStats(CHAIN_ID);
      expect(failures).to.equal(2);
    });
  });
});
