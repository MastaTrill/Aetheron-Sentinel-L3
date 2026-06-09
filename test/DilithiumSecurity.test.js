const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('DilithiumVerifierWrapper Security Rejection', function () {
  let quantumGuard, verifierWrapper, coreLoop, owner;
  const INITIAL_HARDNESS = 1024;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const QuantumGuard = await ethers.getContractFactory('SentinelQuantumGuard');
    quantumGuard = await QuantumGuard.deploy(INITIAL_HARDNESS, ethers.ZeroAddress);

    const CoreLoop = await ethers.getContractFactory('SentinelCoreLoop');
    coreLoop = await CoreLoop.deploy(owner.address);

    const VerifierWrapper = await ethers.getContractFactory('DilithiumVerifierWrapper');
    verifierWrapper = await VerifierWrapper.deploy(await quantumGuard.getAddress());

    // Bootstrap system
    await coreLoop.initializeCoreComponents(await quantumGuard.getAddress());

    // To test the verifier's logic, we must authorize it to read hardness
    // SentinelQuantumGuard restricts getHardnessLevel to s_coreLoop
    await quantumGuard.setCoreLoop(await verifierWrapper.getAddress());
  });

  it('Should reject verification when hardness exceeds 2048 and precompile fails', async function () {
    // 1. Manually increase hardness via the owner (owner is authorized in calibrateLatticeParameters)
    // We need to bypass the s_coreLoop restriction for calibration
    await quantumGuard.setCoreLoop(owner.address);

    // Force hardness up to 2048+
    // Base hardness is 1024. calibrateLatticeParameters adds 10 minimum.
    // For speed in test, we repeat until threshold is met.
    for (let i = 0; i < 110; i++) {
      await quantumGuard.calibrateLatticeParameters();
    }

    const currentHardness = await quantumGuard.getHardnessLevel();
    expect(currentHardness).to.be.at.least(2048);

    // 2. Set the wrapper back as the coreLoop so it can call getHardnessLevel
    await quantumGuard.setCoreLoop(await verifierWrapper.getAddress());

    // 3. Attempt to verify a "Dilithium 2" message.
    // Since hardness >= 2048, the wrapper will attempt to call 0x105 (Dilithium 5).
    // In the local Hardhat environment, there is no code at 0x105,
    // so the staticcall will fail, resulting in an InvalidSignature revert.
    const pubKey = ethers.randomBytes(32);
    const msgHash = ethers.id('test message');
    const sig = ethers.randomBytes(64);

    await expect(
      verifierWrapper.verifySystemSignature(pubKey, msgHash, sig)
    ).to.be.revertedWithCustomError(verifierWrapper, 'InvalidSignature');

    console.log(`Verified: Hardness ${currentHardness} forced routing away from Dilithium 2.`);
  });
});
