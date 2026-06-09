const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('Sentinel L3 Threat Simulation', function () {
  let coreLoop, quantumGuard, owner, otherAccount;
  const INITIAL_HARDNESS = 1024;

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();

    // Mocking Coherence Feed - Assuming a mock is available or using a fake address for unit testing logic
    const QuantumGuard = await ethers.getContractFactory('SentinelQuantumGuard');
    quantumGuard = await QuantumGuard.deploy(INITIAL_HARDNESS, ethers.ZeroAddress);

    const CoreLoop = await ethers.getContractFactory('SentinelCoreLoop');
    coreLoop = await CoreLoop.deploy(owner.address);

    // Bootstrap the system
    await coreLoop.initializeCoreComponents(await quantumGuard.getAddress());
    await quantumGuard.setCoreLoop(await coreLoop.getAddress());
  });

  it('Should emit HighThreatCalibrationTriggered when anomaly threshold is reached', async function () {
    const threshold = await coreLoop.s_highThreatAnomalyThreshold();
    const threatId = ethers.id('BRG-001-VOLATILITY');

    // Execute N-1 responses (filling the buffer)
    for (let i = 0; i < Number(threshold) - 1; i++) {
      await coreLoop.executeThreatResponse(threatId);
    }

    // The Nth response triggers the logic because block.timestamp
    // difference between 1st and 10th is near zero (same or consecutive blocks)
    await expect(coreLoop.executeThreatResponse(threatId))
      .to.emit(coreLoop, 'HighThreatCalibrationTriggered')
      .withArgs(threshold);
  });

  it('Should increase hardness level in QuantumGuard after calibration', async function () {
    const threshold = await coreLoop.s_highThreatAnomalyThreshold();
    const threatId = ethers.id('BRG-002-QUANTUM-PRESSURE');

    const initialLevel = await quantumGuard.getHardnessLevel();

    // Trigger a high threat event
    for (let i = 0; i < Number(threshold); i++) {
      await coreLoop.executeThreatResponse(threatId);
    }

    const newLevel = await quantumGuard.getHardnessLevel();
    expect(newLevel).to.be.greaterThan(initialLevel);
    console.log(`Hardness scaled from ${initialLevel} to ${newLevel}`);
  });
});
