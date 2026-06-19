import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelCoreLoop Sandwich Attack Simulation', function () {
  let coreLoop, yieldMaximizer, amm, token, mockGuard;
  let owner, keeper, attacker;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, keeper, attacker] = await ethers.getSigners();

    // Deploy tokens and mocks
    const Token = await ethers.getContractFactory('SentinelToken');
    token = await Token.deploy(owner.address);

    const AMM = await ethers.getContractFactory('MockAMM');
    amm = await AMM.deploy(token.target);

    const YieldMaximizer = await ethers.getContractFactory('MockYieldMaximizerWithAMM');
    yieldMaximizer = await YieldMaximizer.deploy(amm.target, token.target);

    const MockGuard = await ethers.getContractFactory('MockQuantumGuard');
    mockGuard = await MockGuard.deploy();

    const SentinelCoreLoop = await ethers.getContractFactory('SentinelCoreLoop');
    coreLoop = await SentinelCoreLoop.deploy(owner.address);

    await coreLoop.initializeCoreComponents(mockGuard.target, yieldMaximizer.target);
    await coreLoop.setKeeper(keeper.address, true);

    // Release owner's vested tokens (90-day cliff + 1 second)
    await ethers.provider.send('evm_increaseTime', [90 * 86400 + 1]);
    await ethers.provider.send('evm_mine', []);
    await token.releaseVestedTokens(owner.address);

    // Initial liquidity funding
    await token.transfer(amm.target, ethers.parseEther('100000'));
    await token.transfer(attacker.address, ethers.parseEther('10000'));
    await token.transfer(yieldMaximizer.target, ethers.parseEther('1000'));
    await owner.sendTransaction({ to: amm.target, value: ethers.parseEther('100') });
  });

  it('should execute the core loop and interact with the AMM', async function () {
    await coreLoop.connect(keeper).executeCoreLoop();
    expect(await yieldMaximizer.lastSlippage()).to.be.gte(0n);
  });

  it('should prevent unauthorized users from triggering the loop', async function () {
    await expect(coreLoop.connect(attacker).executeCoreLoop())
      .to.be.revertedWithCustomError(coreLoop, 'SentinelCoreLoop__UnauthorizedKeeper');
  });
});