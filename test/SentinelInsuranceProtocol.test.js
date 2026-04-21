// test/SentinelInsuranceProtocol.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

// InsuranceType enum: HACK_COVERAGE=0, ORACLE_FAILURE=1, ... PROTOCOL_EXPLOIT=7
const HACK_COVERAGE = 0;
const ORACLE_FAILURE = 1;

// PolicyStatus enum: ACTIVE=0, EXPIRED=1, CLAIMED=2, CANCELLED=3, DEFAULTED=4
const ACTIVE = 0n;

describe('SentinelInsuranceProtocol', function () {
  let insurance;
  let owner, policyHolder, other;

  const MIN_COVERAGE = ethers.parseEther('1');
  const COVERAGE_PERIOD_MIN = 30 * 24 * 60 * 60; // 30 days in seconds

  beforeEach(async function () {
    [owner, policyHolder, other] = await ethers.getSigners();
    const SentinelInsuranceProtocol = await ethers.getContractFactory(
      'SentinelInsuranceProtocol',
    );
    insurance = await SentinelInsuranceProtocol.deploy(
      ethers.ZeroAddress, // sentinelCore (not called in basic flows)
      ethers.ZeroAddress, // sentinelAuditor (not called in basic flows)
      owner.address,
    );
    await insurance.waitForDeployment();
  });

  describe('Deployment', function () {
    it('sets owner correctly', async function () {
      expect(await insurance.owner()).to.equal(owner.address);
    });

    it('initialises baseRiskScore to 500', async function () {
      expect(await insurance.baseRiskScore()).to.equal(500n);
    });

    it('initialises policyCount to 0', async function () {
      expect(await insurance.policyCount()).to.equal(0n);
    });

    it('initialises claimCount to 0', async function () {
      expect(await insurance.claimCount()).to.equal(0n);
    });

    it('rejects zero address owner', async function () {
      const SentinelInsuranceProtocol = await ethers.getContractFactory(
        'SentinelInsuranceProtocol',
      );
      await expect(
        SentinelInsuranceProtocol.deploy(
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
        ),
      ).to.be.revertedWith('Invalid owner');
    });
  });

  describe('constants', function () {
    it('MIN_COVERAGE is 1 ether', async function () {
      expect(await insurance.MIN_COVERAGE()).to.equal(ethers.parseEther('1'));
    });

    it('MAX_COVERAGE is 10000 ether', async function () {
      expect(await insurance.MAX_COVERAGE()).to.equal(
        ethers.parseEther('10000'),
      );
    });

    it('CLAIM_PROCESSING_TIME is 7 days', async function () {
      expect(await insurance.CLAIM_PROCESSING_TIME()).to.equal(
        7n * 24n * 60n * 60n,
      );
    });
  });

  describe('purchaseInsurance', function () {
    it('creates a policy with sufficient premium payment', async function () {
      const coverage = ethers.parseEther('10');
      const period = COVERAGE_PERIOD_MIN;

      // Send a large premium (5% of coverage) to be sure it's covered
      const premium = (coverage * 5n) / 100n;

      const tx = await insurance.connect(policyHolder).purchaseInsurance(
        other.address, // coveredContract (any non-zero address)
        coverage,
        HACK_COVERAGE,
        period,
        { value: premium },
      );
      await tx.wait();

      expect(await insurance.policyCount()).to.equal(1n);
      const policy = await insurance.policies(0);
      expect(policy.policyHolder).to.equal(policyHolder.address);
      expect(policy.coverageAmount).to.equal(coverage);
      expect(policy.status).to.equal(ACTIVE);
    });

    it('emits PolicyCreated event', async function () {
      const coverage = ethers.parseEther('10');
      const premium = (coverage * 5n) / 100n;

      await expect(
        insurance
          .connect(policyHolder)
          .purchaseInsurance(
            other.address,
            coverage,
            HACK_COVERAGE,
            COVERAGE_PERIOD_MIN,
            {
              value: premium,
            },
          ),
      ).to.emit(insurance, 'PolicyCreated');
    });

    it('reverts with coverage below minimum', async function () {
      await expect(
        insurance
          .connect(policyHolder)
          .purchaseInsurance(
            other.address,
            ethers.parseEther('0.5'),
            HACK_COVERAGE,
            COVERAGE_PERIOD_MIN,
            { value: ethers.parseEther('1') },
          ),
      ).to.be.revertedWith('Invalid coverage amount');
    });

    it('reverts with coverage above maximum', async function () {
      const tooLarge = ethers.parseEther('10001');
      await expect(
        insurance
          .connect(policyHolder)
          .purchaseInsurance(
            other.address,
            tooLarge,
            HACK_COVERAGE,
            COVERAGE_PERIOD_MIN,
            { value: ethers.parseEther('1000') },
          ),
      ).to.be.revertedWith('Invalid coverage amount');
    });

    it('reverts with coverage period below minimum', async function () {
      await expect(
        insurance.connect(policyHolder).purchaseInsurance(
          other.address,
          MIN_COVERAGE,
          HACK_COVERAGE,
          3600, // 1 hour — below 30 day minimum
          { value: ethers.parseEther('1') },
        ),
      ).to.be.revertedWith('Invalid coverage period');
    });

    it('tracks totalCoverageProvided', async function () {
      const coverage = ethers.parseEther('10');
      const premium = (coverage * 5n) / 100n;

      await insurance
        .connect(policyHolder)
        .purchaseInsurance(
          other.address,
          coverage,
          HACK_COVERAGE,
          COVERAGE_PERIOD_MIN,
          {
            value: premium,
          },
        );

      expect(await insurance.totalCoverageProvided()).to.equal(coverage);
    });

    it('tracks totalPremiumsCollected', async function () {
      const coverage = ethers.parseEther('10');
      const premium = (coverage * 5n) / 100n;

      await insurance
        .connect(policyHolder)
        .purchaseInsurance(
          other.address,
          coverage,
          HACK_COVERAGE,
          COVERAGE_PERIOD_MIN,
          {
            value: premium,
          },
        );

      expect(await insurance.totalPremiumsCollected()).to.be.gt(0n);
    });

    it('refunds excess premium payment', async function () {
      const coverage = ethers.parseEther('10');
      const hugePremium = ethers.parseEther('100'); // Way more than required

      const balBefore = await ethers.provider.getBalance(policyHolder.address);
      const tx = await insurance
        .connect(policyHolder)
        .purchaseInsurance(
          other.address,
          coverage,
          HACK_COVERAGE,
          COVERAGE_PERIOD_MIN,
          { value: hugePremium },
        );
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(policyHolder.address);

      // User should have been refunded most of the excess
      // Net ETH spent = actual premium + gas; should be much less than hugePremium
      const netSpent = balBefore - balAfter - gasUsed;
      expect(netSpent).to.be.lt(hugePremium);
    });
  });

  describe('submitClaim', function () {
    let policyId;

    beforeEach(async function () {
      const coverage = ethers.parseEther('10');
      const premium = (coverage * 5n) / 100n;

      await insurance
        .connect(policyHolder)
        .purchaseInsurance(
          other.address,
          coverage,
          HACK_COVERAGE,
          COVERAGE_PERIOD_MIN,
          {
            value: premium,
          },
        );
      policyId = 0;
    });

    it('reverts if caller is not the policy holder', async function () {
      await expect(
        insurance.connect(other).submitClaim(policyId, ethers.ZeroHash, '0x'),
      ).to.be.revertedWith('Not policy holder');
    });
  });
});
