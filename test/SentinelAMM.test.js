// test/SentinelAMM.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelAMM', function () {
  let amm;
  let owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const SentinelAMM = await ethers.getContractFactory('SentinelAMM');
    amm = await SentinelAMM.deploy(owner.address);
    await amm.waitForDeployment();
  });

  describe('Deployment', function () {
    it('initialises 2 pools in the constructor', async function () {
      expect(await amm.poolCount()).to.equal(2n);
    });

    it('sets the owner correctly', async function () {
      expect(await amm.owner()).to.equal(owner.address);
    });

    it('starts with zero total value locked', async function () {
      expect(await amm.totalValueLocked()).to.equal(0n);
    });

    it('starts with zero fees collected', async function () {
      expect(await amm.totalFeesCollected()).to.equal(0n);
    });
  });

  describe('getQuantumPoolStats', function () {
    it('returns the fee tier for pool 0 (0.05%)', async function () {
      const stats = await amm.getQuantumPoolStats(0);
      expect(stats.feeTier).to.equal(5n);
    });

    it('returns the fee tier for pool 1 (0.30%)', async function () {
      const stats = await amm.getQuantumPoolStats(1);
      expect(stats.feeTier).to.equal(30n);
    });

    it('returns zero reserves for newly created pools', async function () {
      const stats = await amm.getQuantumPoolStats(0);
      expect(stats.reserve0).to.equal(0n);
      expect(stats.reserve1).to.equal(0n);
      expect(stats.liquidity).to.equal(0n);
    });

    it('returns zeroed stats for an unmapped pool id (no bounds check in view)', async function () {
      // pools is a mapping; reading a missing key returns a zero-value struct
      const stats = await amm.getQuantumPoolStats(99);
      expect(stats.reserve0).to.equal(0n);
      expect(stats.feeTier).to.equal(0n);
    });
  });

  describe('addQuantumLiquidity', function () {
    it('reverts for an invalid pool id', async function () {
      await expect(
        amm.addQuantumLiquidity(
          99,
          ethers.parseEther('100'),
          ethers.parseEther('100'),
          1n,
          2n,
          false,
        ),
      ).to.be.revertedWith('Invalid pool');
    });

    it('reverts when minPrice >= maxPrice', async function () {
      // Price bounds are validated before any token transfer
      await expect(
        amm.addQuantumLiquidity(
          0,
          ethers.parseEther('100'),
          ethers.parseEther('100'),
          2n,
          1n,
          false,
        ),
      ).to.be.revertedWith('Invalid price bounds');
    });

    it('reverts when minPrice equals maxPrice', async function () {
      await expect(
        amm.addQuantumLiquidity(
          0,
          ethers.parseEther('100'),
          ethers.parseEther('100'),
          5n,
          5n,
          false,
        ),
      ).to.be.revertedWith('Invalid price bounds');
    });
  });

  describe('executeQuantumSwap', function () {
    it('reverts for an invalid pool id', async function () {
      const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
      const token = await ERC20Mock.deploy(
        'Token',
        'TK',
        owner.address,
        ethers.parseEther('1000'),
      );
      await token.waitForDeployment();

      await expect(
        amm.executeQuantumSwap(
          99,
          await token.getAddress(),
          ethers.parseEther('1'),
          0n,
        ),
      ).to.be.revertedWith('Invalid pool');
    });
  });

  describe('claimImpermanentLossProtection', function () {
    it('reverts for an out-of-range position index', async function () {
      // user has no positions at index 0
      await expect(
        amm.claimImpermanentLossProtection(user.address, 0),
      ).to.be.revertedWith('Invalid position');
    });
  });
});
