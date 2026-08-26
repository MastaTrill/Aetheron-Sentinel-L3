import { expect } from 'chai';
import { network } from 'hardhat';

describe('AetheronPresaleVault', function () {
  this.timeout(60_000);

  let ethers;
  let owner, treasury, liquidityReserve, buyer1, buyer2, attacker;
  let aethToken, usdcToken, presaleVault;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, treasury, liquidityReserve, buyer1, buyer2, attacker] = await ethers.getSigners();

    // Deploy Mock ERC-20 for AETH and USDC
    const MockERC20Factory = await ethers.getContractFactory(
      'contracts/SentinelToken.sol:SentinelToken'
    );
    aethToken = await MockERC20Factory.deploy(owner.address);
    await aethToken.waitForDeployment();

    // Deploy simple ERC-20 for USDC mock
    const UsdcFactory = await ethers.getContractFactory(
      'contracts/SentinelToken.sol:SentinelToken'
    );
    usdcToken = await UsdcFactory.deploy(owner.address);
    await usdcToken.waitForDeployment();

    // Fund buyers with mock USDC
    await usdcToken.connect(owner).transfer(buyer1.address, ethers.parseUnits('10000', 6));
    await usdcToken.connect(owner).transfer(buyer2.address, ethers.parseUnits('50000', 6));

    // Deploy AetheronPresaleVault
    const VaultFactory = await ethers.getContractFactory('AetheronPresaleVault');
    presaleVault = await VaultFactory.deploy(
      await aethToken.getAddress(),
      await usdcToken.getAddress(),
      treasury.address,
      liquidityReserve.address,
      owner.address
    );
    await presaleVault.waitForDeployment();

    // Deposit AETH tokens into presale vault for claims
    await aethToken.connect(owner).transfer(
      await presaleVault.getAddress(),
      ethers.parseEther('100000000') // 100M AETH
    );
  });

  describe('Deployment & Initial Configuration', function () {
    it('sets owner, tokens, and wallets correctly', async function () {
      expect(await presaleVault.owner()).to.equal(owner.address);
      expect(await presaleVault.aethToken()).to.equal(await aethToken.getAddress());
      expect(await presaleVault.usdcToken()).to.equal(await usdcToken.getAddress());
      expect(await presaleVault.treasury()).to.equal(treasury.address);
      expect(await presaleVault.liquidityReserve()).to.equal(liquidityReserve.address);
      expect(await presaleVault.state()).to.equal(0); // Active
    });

    it('initialises default rates and caps', async function () {
      expect(await presaleVault.rateAethPerEth()).to.equal(14000n);
      expect(await presaleVault.rateAethPerUsdc()).to.equal(5n);
      expect(await presaleVault.hardCapUsd()).to.equal(ethers.parseUnits('5000000', 6));
      expect(await presaleVault.minPurchaseUsd()).to.equal(ethers.parseUnits('50', 6));
      expect(await presaleVault.maxPurchaseUsd()).to.equal(ethers.parseUnits('50000', 6));
    });
  });

  describe('Purchasing with ETH (buyWithEth)', function () {
    it('allocates AETH tokens accurately for ETH purchases', async function () {
      const ethAmount = ethers.parseEther('1.0'); // 1 ETH ($2,800) -> 14,000 AETH
      const tx = await presaleVault.connect(buyer1).buyWithEth({ value: ethAmount });

      await expect(tx)
        .to.emit(presaleVault, 'TokensPurchased')
        .withArgs(buyer1.address, ethers.parseUnits('2800', 6), ethers.parseEther('14000'), true);

      const info = await presaleVault.buyers(buyer1.address);
      expect(info.totalPurchasedAeth).to.equal(ethers.parseEther('14000'));
      expect(info.ethContributed).to.equal(ethAmount);
      expect(info.totalContributedUsd).to.equal(ethers.parseUnits('2800', 6));

      expect(await presaleVault.totalEthRaised()).to.equal(ethAmount);
      expect(await presaleVault.totalRaisedUsd()).to.equal(ethers.parseUnits('2800', 6));
      expect(await presaleVault.getParticipantCount()).to.equal(1n);
    });

    it('reverts on zero ETH deposit', async function () {
      await expect(
        presaleVault.connect(buyer1).buyWithEth({ value: 0n })
      ).to.be.revertedWithCustomError(presaleVault, 'ZeroAmount');
    });

    it('reverts on deposit below minimum ($50)', async function () {
      const tinyEth = ethers.parseEther('0.005'); // ~$14 (< $50)
      await expect(
        presaleVault.connect(buyer1).buyWithEth({ value: tinyEth })
      ).to.be.revertedWithCustomError(presaleVault, 'BelowMinPurchase');
    });
  });

  describe('Purchasing with USDC (buyWithUsdc)', function () {
    it('allocates AETH tokens accurately for USDC purchases', async function () {
      const usdcAmount = ethers.parseUnits('1000', 6); // 1,000 USDC -> 5,000 AETH
      await usdcToken.connect(buyer1).approve(await presaleVault.getAddress(), usdcAmount);

      const tx = await presaleVault.connect(buyer1).buyWithUsdc(usdcAmount);

      await expect(tx)
        .to.emit(presaleVault, 'TokensPurchased')
        .withArgs(buyer1.address, usdcAmount, ethers.parseEther('5000'), false);

      const info = await presaleVault.buyers(buyer1.address);
      expect(info.totalPurchasedAeth).to.equal(ethers.parseEther('5000'));
      expect(info.usdcContributed).to.equal(usdcAmount);
      expect(await presaleVault.totalUsdcRaised()).to.equal(usdcAmount);
    });
  });

  describe('Finalization & 60/40 Liquidity Split', function () {
    it('splits raised funds: 60% liquidity reserve, 40% treasury', async function () {
      // Buyer 1 deposits 10 ETH
      await presaleVault.connect(buyer1).buyWithEth({ value: ethers.parseEther('10') });

      // Buyer 2 deposits 10,000 USDC
      const usdcAmt = ethers.parseUnits('10000', 6);
      await usdcToken.connect(buyer2).approve(await presaleVault.getAddress(), usdcAmt);
      await presaleVault.connect(buyer2).buyWithUsdc(usdcAmt);

      const initialLiqEth = await ethers.provider.getBalance(liquidityReserve.address);
      const initialTreasuryEth = await ethers.provider.getBalance(treasury.address);

      const listingTime = (await ethers.provider.getBlock('latest')).timestamp + 60;
      await presaleVault.connect(owner).finalize(listingTime);

      expect(await presaleVault.state()).to.equal(1); // Finalized

      // Verify ETH split (6 ETH to liquidityReserve, 4 ETH to treasury)
      const finalLiqEth = await ethers.provider.getBalance(liquidityReserve.address);
      const finalTreasuryEth = await ethers.provider.getBalance(treasury.address);
      expect(finalLiqEth - initialLiqEth).to.equal(ethers.parseEther('6'));
      expect(finalTreasuryEth - initialTreasuryEth).to.equal(ethers.parseEther('4'));

      // Verify USDC split (6,000 USDC to liquidityReserve, 4,000 USDC to treasury)
      expect(await usdcToken.balanceOf(liquidityReserve.address)).to.equal(
        ethers.parseUnits('6000', 6)
      );
      expect(await usdcToken.balanceOf(treasury.address)).to.equal(ethers.parseUnits('4000', 6));
    });
  });

  describe('Linear Vesting & Token Claims', function () {
    it('unlocks 20% immediately at listing and allows claim', async function () {
      await presaleVault.connect(buyer1).buyWithEth({ value: ethers.parseEther('1.0') }); // 14,000 AETH

      const listingTime = (await ethers.provider.getBlock('latest')).timestamp + 10;
      await presaleVault.connect(owner).finalize(listingTime);

      // Fast forward to listingTime
      await ethers.provider.send('evm_setNextBlockTimestamp', [listingTime + 1]);
      await ethers.provider.send('evm_mine', []);

      // 20% of 14,000 = 2,800 AETH
      const claimable = await presaleVault.getClaimableTokens(buyer1.address);
      expect(claimable).to.be.closeTo(ethers.parseEther('2800'), ethers.parseEther('1'));

      const initialAeth = await aethToken.balanceOf(buyer1.address);
      await presaleVault.connect(buyer1).claimTokens();
      const finalAeth = await aethToken.balanceOf(buyer1.address);

      expect(finalAeth - initialAeth).to.be.closeTo(
        ethers.parseEther('2800'),
        ethers.parseEther('1')
      );
    });
  });

  describe('Emergency Cancellation & Refunds', function () {
    it('allows buyers to claim 100% refund if cancelled', async function () {
      const ethAmount = ethers.parseEther('2.0');
      await presaleVault.connect(buyer1).buyWithEth({ value: ethAmount });

      await presaleVault.connect(owner).cancel();
      expect(await presaleVault.state()).to.equal(2); // Cancelled

      const initialEth = await ethers.provider.getBalance(buyer1.address);
      const tx = await presaleVault.connect(buyer1).claimRefund();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const finalEth = await ethers.provider.getBalance(buyer1.address);
      expect(finalEth + gasCost - initialEth).to.equal(ethAmount);
    });
  });
});
