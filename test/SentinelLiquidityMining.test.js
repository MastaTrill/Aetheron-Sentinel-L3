// test/SentinelLiquidityMining.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelLiquidityMining', function () {
  let mining, lpToken, rewardToken;
  let owner, user, other;

  const INITIAL_SUPPLY = ethers.parseEther('1000000');
  const REWARD_PER_SECOND = ethers.parseEther('1');

  beforeEach(async function () {
    [owner, user, other] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    lpToken = await ERC20Mock.deploy(
      'LP Token',
      'LP',
      owner.address,
      INITIAL_SUPPLY,
    );
    await lpToken.waitForDeployment();

    rewardToken = await ERC20Mock.deploy(
      'Reward Token',
      'RWD',
      owner.address,
      INITIAL_SUPPLY,
    );
    await rewardToken.waitForDeployment();

    const SentinelLiquidityMining = await ethers.getContractFactory(
      'SentinelLiquidityMining',
    );
    mining = await SentinelLiquidityMining.deploy(
      await lpToken.getAddress(),
      await rewardToken.getAddress(),
      REWARD_PER_SECOND,
      owner.address,
    );
    await mining.waitForDeployment();

    // Fund the mining contract with reward tokens
    await rewardToken.transfer(await mining.getAddress(), INITIAL_SUPPLY / 2n);

    // Fund user with LP tokens
    await lpToken.transfer(user.address, ethers.parseEther('10000'));
    await lpToken
      .connect(user)
      .approve(await mining.getAddress(), ethers.parseEther('10000'));
  });

  describe('Deployment', function () {
    it('stores lpToken and rewardToken', async function () {
      expect(await mining.lpToken()).to.equal(await lpToken.getAddress());
      expect(await mining.rewardToken()).to.equal(
        await rewardToken.getAddress(),
      );
    });

    it('creates 4 pools in the constructor', async function () {
      // Access each pool — will revert if index out of bounds
      const pool0 = await mining.pools(0);
      const pool3 = await mining.pools(3);
      expect(pool0.baseAPY).to.equal(300n); // 3.0%
      expect(pool3.baseAPY).to.equal(500n); // 5.0%
    });

    it('initialises totalAllocPoint as sum of all pool allocPoints', async function () {
      // pools: 1000 + 1500 + 2000 + 3000 = 7500
      expect(await mining.totalAllocPoint()).to.equal(7500n);
    });

    it('reverts with invalid LP token address', async function () {
      const SentinelLiquidityMining = await ethers.getContractFactory(
        'SentinelLiquidityMining',
      );
      await expect(
        SentinelLiquidityMining.deploy(
          ethers.ZeroAddress,
          await rewardToken.getAddress(),
          REWARD_PER_SECOND,
          owner.address,
        ),
      ).to.be.revertedWith('Invalid LP token');
    });

    it('reverts with invalid reward token address', async function () {
      const SentinelLiquidityMining = await ethers.getContractFactory(
        'SentinelLiquidityMining',
      );
      await expect(
        SentinelLiquidityMining.deploy(
          await lpToken.getAddress(),
          ethers.ZeroAddress,
          REWARD_PER_SECOND,
          owner.address,
        ),
      ).to.be.revertedWith('Invalid reward token');
    });
  });

  describe('constants', function () {
    it('MAX_APY is 500', async function () {
      expect(await mining.MAX_APY()).to.equal(500n);
    });

    it('BASE_APY is 300', async function () {
      expect(await mining.BASE_APY()).to.equal(300n);
    });

    it('GOLD_MULTIPLIER is 150', async function () {
      expect(await mining.GOLD_MULTIPLIER()).to.equal(150n);
    });
  });

  describe('deposit', function () {
    it('deposits LP tokens and updates pool totalStaked', async function () {
      const amount = ethers.parseEther('1000');
      await mining.connect(user).deposit(0, amount);

      const pool = await mining.pools(0);
      expect(pool.totalStaked).to.equal(amount);

      const position = await mining.positions(0, user.address);
      expect(position.amount).to.equal(amount);
    });

    it('emits Deposited event', async function () {
      const amount = ethers.parseEther('100');
      await expect(mining.connect(user).deposit(0, amount))
        .to.emit(mining, 'Deposited')
        .withArgs(user.address, 0n, amount);
    });

    it('reverts on zero amount', async function () {
      await expect(mining.connect(user).deposit(0, 0)).to.be.revertedWith(
        'Cannot deposit 0',
      );
    });

    it('reverts on invalid pool id', async function () {
      await expect(
        mining.connect(user).deposit(99, ethers.parseEther('1')),
      ).to.be.revertedWith('Invalid pool');
    });

    it('applies BRONZE multiplier for deposits >= 1000 LP tokens', async function () {
      const amount = ethers.parseEther('1000');
      await mining.connect(user).deposit(0, amount);
      const position = await mining.positions(0, user.address);
      // BRONZE_MULTIPLIER = 110 (≥1000 LP)
      expect(position.multiplier).to.equal(110n);
    });

    it('applies SILVER multiplier for deposits >= 10000 LP tokens', async function () {
      const amount = ethers.parseEther('10000');
      await mining.connect(user).deposit(0, amount);
      const position = await mining.positions(0, user.address);
      // SILVER_MULTIPLIER = 125 (≥10000 LP)
      expect(position.multiplier).to.equal(125n);
    });
  });

  describe('withdraw', function () {
    const depositAmount = ethers.parseEther('1000');

    beforeEach(async function () {
      await mining.connect(user).deposit(0, depositAmount);
    });

    it('withdraws LP tokens back to user', async function () {
      const balBefore = await lpToken.balanceOf(user.address);
      await mining.connect(user).withdraw(0, depositAmount);
      const balAfter = await lpToken.balanceOf(user.address);
      expect(balAfter - balBefore).to.equal(depositAmount);
    });

    it('emits Withdrawn event', async function () {
      await expect(mining.connect(user).withdraw(0, depositAmount))
        .to.emit(mining, 'Withdrawn')
        .withArgs(user.address, 0n, depositAmount);
    });

    it('decrements pool totalStaked', async function () {
      await mining.connect(user).withdraw(0, depositAmount);
      const pool = await mining.pools(0);
      expect(pool.totalStaked).to.equal(0n);
    });

    it('reverts when withdrawing more than deposited', async function () {
      await expect(
        mining.connect(user).withdraw(0, depositAmount + 1n),
      ).to.be.revertedWith('Insufficient balance');
    });
  });

  describe('emergencyWithdraw', function () {
    it('reverts when emergency withdraw is not enabled', async function () {
      await mining.connect(user).deposit(0, ethers.parseEther('100'));
      await expect(
        mining.connect(user).emergencyWithdraw(0),
      ).to.be.revertedWith('Emergency withdraw not enabled');
    });
  });

  describe('REWARD_DISTRIBUTOR_ROLE', function () {
    it('owner holds REWARD_DISTRIBUTOR_ROLE', async function () {
      const role = await mining.REWARD_DISTRIBUTOR_ROLE();
      expect(await mining.hasRole(role, owner.address)).to.equal(true);
    });

    it('stranger does not hold REWARD_DISTRIBUTOR_ROLE', async function () {
      const role = await mining.REWARD_DISTRIBUTOR_ROLE();
      expect(await mining.hasRole(role, other.address)).to.equal(false);
    });
  });
});
