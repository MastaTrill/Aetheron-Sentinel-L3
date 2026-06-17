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

    // Initial liquidity funding
    await token.transfer(amm.target, ethers.parseEther('100000'));
    await token.transfer(attacker.address, ethers.parseEther('10000'));
    await token.transfer(yieldMaximizer.target, ethers.parseEther('1000'));
    await owner.sendTransaction({ to: amm.target, value: ethers.parseEther('100') });
  });

  it('should demonstrate a successful sandwich exploit on the yield rebalance', async function () {
    const initialAttackerBalance = await token.balanceOf(attacker.address);

    // 1. FRONT-RUN: Attacker skews the price
    const attackAmount = ethers.parseEther('5000');
    await token.connect(attacker).approve(amm.target, attackAmount);
    await amm.connect(attacker).swap(attackAmount, true); // Swapping AETH for ETH

    const skewedPrice = await amm.getETHPrice();
    console.log(`\tPrice after Front-run: ${ethers.formatUnits(skewedPrice, 6)} AETH/ETH`);

    // 2. THE VICTIM: Sentinel executes rebalance at the worst possible price
    await coreLoop.connect(keeper).executeCoreLoop();

    const yieldLoss = await yieldMaximizer.lastSlippage();
    console.log(`\tSentinel Rebalance Slippage: ${yieldLoss}%`);

    // 3. BACK-RUN: Attacker exits and pockets the rebalance slippage
    await amm.connect(attacker).swap(ethers.parseEther('2'), false); // Exiting with profit

    const finalAttackerBalance = await token.balanceOf(attacker.address);
    const profit = finalAttackerBalance - initialAttackerBalance;

    console.log(`\tAttacker Net Profit: ${ethers.formatEther(profit)} AETH`);
    expect(profit).to.be.gt(0n);
  });

  it('should prevent unauthorized users from triggering the loop', async function () {
    await expect(coreLoop.connect(attacker).executeCoreLoop())
      .to.be.revertedWithCustomError(coreLoop, 'SentinelCoreLoop__UnauthorizedKeeper');
  });
});