// test/SentinelVaultStrategy.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelVaultStrategy', function () {
  this.timeout(100000);
  let vault, token, owner, user, strategyAddr;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, user, strategyAddr] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    token = await ERC20Mock.deploy('MockToken', 'MTK', owner.address, ethers.parseEther('1000000'));
    await token.waitForDeployment();

    const Factory = await ethers.getContractFactory('SentinelVaultStrategy');
    vault = await Factory.deploy(await token.getAddress(), owner.address);
    await vault.waitForDeployment();

    // Fund user
    await token.transfer(user.address, ethers.parseEther('10000'));
    await token.connect(user).approve(await vault.getAddress(), ethers.parseEther('10000'));
  });

  it('deploys with correct initial state', async function () {
    expect(await vault.stakingToken()).to.equal(await token.getAddress());
    expect(await vault.totalVaultSupply()).to.equal(0n);
    expect(await vault.owner()).to.equal(owner.address);
  });

  it('allows user to deposit tokens and mint shares', async function () {
    const depositAmount = ethers.parseEther('1000');
    await vault.connect(user).deposit(depositAmount);

    expect(await vault.userShares(user.address)).to.equal(depositAmount);
    expect(await vault.totalVaultSupply()).to.equal(depositAmount);
    expect(await token.balanceOf(await vault.getAddress())).to.equal(depositAmount);
  });

  it('allows user to withdraw tokens by burning shares', async function () {
    const depositAmount = ethers.parseEther('1000');
    await vault.connect(user).deposit(depositAmount);

    await vault.connect(user).withdraw(depositAmount);

    expect(await vault.userShares(user.address)).to.equal(0n);
    expect(await vault.totalVaultSupply()).to.equal(0n);
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther('10000'));
  });

  it('allows owner to rebalance strategy allocation', async function () {
    await vault.rebalanceStrategy(0, strategyAddr.address, 5000); // 50%

    const strat = await vault.strategies(0);
    expect(strat.strategyAddress).to.equal(strategyAddr.address);
    expect(strat.allocationBps).to.equal(5000n);
    expect(strat.isActive).to.equal(true);
  });
});
