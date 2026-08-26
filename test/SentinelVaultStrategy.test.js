// test/SentinelVaultStrategy.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelVaultStrategy', function () {
  this.timeout(100000);
  let vault, token, owner, user, user2, strategyAddr;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, user, user2, strategyAddr] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    token = await ERC20Mock.deploy('MockToken', 'MTK', owner.address, ethers.parseEther('1000000'));
    await token.waitForDeployment();

    const Factory = await ethers.getContractFactory('SentinelVaultStrategy');
    vault = await Factory.deploy(await token.getAddress(), owner.address);
    await vault.waitForDeployment();

    // Fund users
    await token.transfer(user.address, ethers.parseEther('10000'));
    await token.connect(user).approve(await vault.getAddress(), ethers.parseEther('10000'));

    await token.transfer(user2.address, ethers.parseEther('10000'));
    await token.connect(user2).approve(await vault.getAddress(), ethers.parseEther('10000'));
  });

  // ─── Deployment ────────────────────────────────────────────────────────────

  describe('deployment', function () {
    it('deploys with correct initial state', async function () {
      expect(await vault.stakingToken()).to.equal(await token.getAddress());
      expect(await vault.totalVaultSupply()).to.equal(0n);
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.strategyCount()).to.equal(0n);
    });

    it('reverts if deployed with zero token address', async function () {
      const Factory = await ethers.getContractFactory('SentinelVaultStrategy');
      await expect(
        Factory.deploy(ethers.ZeroAddress, owner.address)
      ).to.be.revertedWith('Zero token address');
    });
  });

  // ─── Deposit ───────────────────────────────────────────────────────────────

  describe('deposit', function () {
    it('allows user to deposit tokens and mint shares 1:1 on first deposit', async function () {
      const depositAmount = ethers.parseEther('1000');
      await vault.connect(user).deposit(depositAmount);

      expect(await vault.userShares(user.address)).to.equal(depositAmount);
      expect(await vault.totalVaultSupply()).to.equal(depositAmount);
      expect(await token.balanceOf(await vault.getAddress())).to.equal(depositAmount);
    });

    it('emits Deposited event with correct args', async function () {
      const depositAmount = ethers.parseEther('500');
      await expect(vault.connect(user).deposit(depositAmount))
        .to.emit(vault, 'Deposited')
        .withArgs(user.address, depositAmount, depositAmount);
    });

    it('reverts on zero deposit amount', async function () {
      await expect(vault.connect(user).deposit(0)).to.be.revertedWith('Zero deposit amount');
    });

    it('mints proportional shares for second depositor when pool has grown', async function () {
      // user1 deposits 1000
      const amount1 = ethers.parseEther('1000');
      await vault.connect(user).deposit(amount1);

      // Simulate yield: owner sends 1000 extra tokens directly to vault (pool doubles)
      await token.transfer(await vault.getAddress(), ethers.parseEther('1000'));

      // user2 deposits 1000 — pool is 2000, supply is 1000 → should get 500 shares
      const amount2 = ethers.parseEther('1000');
      await vault.connect(user2).deposit(amount2);

      expect(await vault.userShares(user2.address)).to.equal(ethers.parseEther('500'));
      expect(await vault.totalVaultSupply()).to.equal(ethers.parseEther('1500'));
    });

    it('two users with same deposit get equal shares on empty vault', async function () {
      const amount = ethers.parseEther('1000');
      await vault.connect(user).deposit(amount);
      await vault.connect(user2).deposit(amount);

      expect(await vault.userShares(user.address)).to.equal(await vault.userShares(user2.address));
    });
  });

  // ─── Withdraw ──────────────────────────────────────────────────────────────

  describe('withdraw', function () {
    it('allows user to withdraw tokens by burning shares', async function () {
      const depositAmount = ethers.parseEther('1000');
      await vault.connect(user).deposit(depositAmount);
      await vault.connect(user).withdraw(depositAmount);

      expect(await vault.userShares(user.address)).to.equal(0n);
      expect(await vault.totalVaultSupply()).to.equal(0n);
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther('10000'));
    });

    it('emits Withdrawn event with correct args', async function () {
      const depositAmount = ethers.parseEther('1000');
      await vault.connect(user).deposit(depositAmount);

      await expect(vault.connect(user).withdraw(depositAmount))
        .to.emit(vault, 'Withdrawn')
        .withArgs(user.address, depositAmount, depositAmount);
    });

    it('reverts on zero withdraw shares', async function () {
      await expect(vault.connect(user).withdraw(0)).to.be.revertedWith('Zero withdraw shares');
    });

    it('reverts if user has insufficient share balance', async function () {
      const depositAmount = ethers.parseEther('1000');
      await vault.connect(user).deposit(depositAmount);

      await expect(
        vault.connect(user).withdraw(ethers.parseEther('2000'))
      ).to.be.revertedWith('Insufficient share balance');
    });

    it('reverts if non-depositor tries to withdraw', async function () {
      await expect(
        vault.connect(user2).withdraw(ethers.parseEther('1'))
      ).to.be.revertedWith('Insufficient share balance');
    });

    it('user receives proportional yield on withdrawal after pool grows', async function () {
      // user1 deposits 1000 → gets 1000 shares
      await vault.connect(user).deposit(ethers.parseEther('1000'));

      // Simulate 100% yield: send 1000 more tokens to vault
      await token.transfer(await vault.getAddress(), ethers.parseEther('1000'));

      // user1 withdraws all 1000 shares → should get 2000 tokens back
      await vault.connect(user).withdraw(ethers.parseEther('1000'));

      // user had 10000, deposited 1000, now gets back 2000 → balance = 11000
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther('11000'));
    });

    it('partial withdrawal returns correct token amount', async function () {
      const depositAmount = ethers.parseEther('1000');
      await vault.connect(user).deposit(depositAmount);

      // Withdraw half
      await vault.connect(user).withdraw(ethers.parseEther('500'));

      expect(await vault.userShares(user.address)).to.equal(ethers.parseEther('500'));
      expect(await vault.totalVaultSupply()).to.equal(ethers.parseEther('500'));
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther('9500'));
    });
  });

  // ─── Strategy Rebalancing ──────────────────────────────────────────────────

  describe('rebalanceStrategy', function () {
    it('allows owner to set a strategy allocation', async function () {
      await vault.rebalanceStrategy(0, strategyAddr.address, 5000); // 50%

      const strat = await vault.strategies(0);
      expect(strat.strategyAddress).to.equal(strategyAddr.address);
      expect(strat.allocationBps).to.equal(5000n);
      expect(strat.isActive).to.equal(true);
    });

    it('emits StrategyRebalanced event', async function () {
      await expect(vault.rebalanceStrategy(0, strategyAddr.address, 5000))
        .to.emit(vault, 'StrategyRebalanced')
        .withArgs(0, strategyAddr.address, 5000);
    });

    it('increments strategyCount when adding a new strategyId', async function () {
      await vault.rebalanceStrategy(0, strategyAddr.address, 3000);
      expect(await vault.strategyCount()).to.equal(1n);

      await vault.rebalanceStrategy(1, strategyAddr.address, 2000);
      expect(await vault.strategyCount()).to.equal(2n);
    });

    it('does not increment strategyCount when updating existing strategyId', async function () {
      await vault.rebalanceStrategy(0, strategyAddr.address, 3000);
      await vault.rebalanceStrategy(0, strategyAddr.address, 7000); // update same slot
      expect(await vault.strategyCount()).to.equal(1n);
    });

    it('allows 100% allocation (10000 bps)', async function () {
      // just await directly — if it reverts the test throws and fails
      await vault.rebalanceStrategy(0, strategyAddr.address, 10000);
      const strat = await vault.strategies(0);
      expect(strat.allocationBps).to.equal(10000n);
    });

    it('reverts if allocation exceeds 10000 bps', async function () {
      await expect(
        vault.rebalanceStrategy(0, strategyAddr.address, 10001)
      ).to.be.revertedWith('Allocation exceeds 100%');
    });

    it('reverts if strategy address is zero', async function () {
      await expect(
        vault.rebalanceStrategy(0, ethers.ZeroAddress, 5000)
      ).to.be.revertedWith('Zero strategy address');
    });

    it('reverts if called by non-owner', async function () {
      await expect(
        vault.connect(user).rebalanceStrategy(0, strategyAddr.address, 5000)
      ).to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
    });
  });

  // ─── Multi-user Scenarios ─────────────────────────────────────────────────

  describe('multi-user deposit & withdraw', function () {
    it('two users can independently deposit and withdraw', async function () {
      await vault.connect(user).deposit(ethers.parseEther('1000'));
      await vault.connect(user2).deposit(ethers.parseEther('2000'));

      expect(await vault.totalVaultSupply()).to.equal(ethers.parseEther('3000'));

      await vault.connect(user).withdraw(ethers.parseEther('1000'));
      await vault.connect(user2).withdraw(ethers.parseEther('2000'));

      expect(await vault.totalVaultSupply()).to.equal(0n);
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther('10000'));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther('10000'));
    });
  });
});
