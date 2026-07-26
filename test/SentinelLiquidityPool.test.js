// test/SentinelLiquidityPool.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelLiquidityPool', function () {
  this.timeout(100000);
  let pool, token, owner, lp, trader;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, lp, trader] = await ethers.getSigners();

    // Deploy MockERC20 as mintable SENTINEL stand-in
    const TokenFactory = await ethers.getContractFactory('MockERC20');
    token = await TokenFactory.deploy('Sentinel', 'SENTINEL', ethers.parseEther('10000000'));
    await token.waitForDeployment();

    const PoolFactory = await ethers.getContractFactory('SentinelLiquidityPool');
    pool = await PoolFactory.deploy(await token.getAddress(), owner.address);
    await pool.waitForDeployment();

    // Fund lp and trader
    await token.transfer(lp.address, ethers.parseEther('1000000'));
    await token.transfer(trader.address, ethers.parseEther('100000'));
  });

  it('deploys with zero reserves', async function () {
    const [s, e] = await pool.getReserves();
    expect(s).to.equal(0n);
    expect(e).to.equal(0n);
    expect(await pool.totalLPShares()).to.equal(0n);
  });

  it('allows LP to add liquidity and receive shares', async function () {
    const sentinelAmt = ethers.parseEther('500000');
    const ethAmt = ethers.parseEther('1');
    await token.connect(lp).approve(await pool.getAddress(), sentinelAmt);
    await pool.connect(lp).addLiquidity(sentinelAmt, { value: ethAmt });

    expect(await pool.lpShares(lp.address)).to.equal(sentinelAmt);
    expect(await pool.totalSentinelReserve()).to.equal(sentinelAmt);
    expect(await pool.totalEthReserve()).to.equal(ethAmt);
  });

  it('allows LP to remove liquidity and reclaim tokens', async function () {
    const sentinelAmt = ethers.parseEther('500000');
    const ethAmt = ethers.parseEther('1');
    await token.connect(lp).approve(await pool.getAddress(), sentinelAmt);
    await pool.connect(lp).addLiquidity(sentinelAmt, { value: ethAmt });

    const shares = await pool.lpShares(lp.address);
    await pool.connect(lp).removeLiquidity(shares);

    expect(await pool.lpShares(lp.address)).to.equal(0n);
    expect(await pool.totalLPShares()).to.equal(0n);
  });

  it('allows trader to swap ETH for SENTINEL with fee deducted', async function () {
    const sentinelAmt = ethers.parseEther('500000');
    const ethAmt = ethers.parseEther('10');
    await token.connect(lp).approve(await pool.getAddress(), sentinelAmt);
    await pool.connect(lp).addLiquidity(sentinelAmt, { value: ethAmt });

    const beforeBalance = await token.balanceOf(trader.address);
    await pool.connect(trader).swapEthForSentinel({ value: ethers.parseEther('1') });
    const afterBalance = await token.balanceOf(trader.address);

    expect(afterBalance).to.be.greaterThan(beforeBalance);
    expect(await pool.protocolFeesCollected()).to.be.greaterThan(0n);
  });
});
