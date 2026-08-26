import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelRegulatoryCompliance', function () {
  let complianceModule;
  let owner, officer, user1, user2;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, officer, user1, user2] = await ethers.getSigners();

    const SentinelRegulatoryCompliance = await ethers.getContractFactory(
      'SentinelRegulatoryCompliance'
    );
    complianceModule = await SentinelRegulatoryCompliance.deploy(owner.address);
    await complianceModule.waitForDeployment();

    const COMPLIANCE_OFFICER_ROLE = await complianceModule.COMPLIANCE_OFFICER_ROLE();
    await complianceModule.grantRole(COMPLIANCE_OFFICER_ROLE, officer.address);
  });

  describe('Sanctions', function () {
    it('should allow officer to add sanction', async function () {
      await complianceModule.connect(officer).addSanction(user1.address);
      expect(await complianceModule.isSanctioned(user1.address)).to.be.true;
    });

    it('should prevent non-officer from adding sanction', async function () {
      await expect(
        complianceModule.connect(user1).addSanction(user2.address)
      ).to.be.revertedWithCustomError(complianceModule, 'AccessControlUnauthorizedAccount');
    });

    it('should allow officer to remove sanction', async function () {
      await complianceModule.connect(officer).addSanction(user1.address);
      await complianceModule.connect(officer).removeSanction(user1.address);
      expect(await complianceModule.isSanctioned(user1.address)).to.be.false;
    });
  });

  describe('KYC Levels', function () {
    it('should default to NONE (0)', async function () {
      expect(await complianceModule.kycRegistry(user1.address)).to.equal(0);
    });

    it('should allow officer to update KYC level', async function () {
      await complianceModule.connect(officer).updateKycLevel(user1.address, 2); // INSTITUTIONAL
      expect(await complianceModule.kycRegistry(user1.address)).to.equal(2);
    });
  });

  describe('isCompliant check', function () {
    it('returns false if sanctioned regardless of KYC', async function () {
      await complianceModule.connect(officer).updateKycLevel(user1.address, 2);
      await complianceModule.connect(officer).addSanction(user1.address);
      expect(await complianceModule.isCompliant(user1.address, 0)).to.be.false;
      expect(await complianceModule.isCompliant(user1.address, 2)).to.be.false;
    });

    it('returns true if no KYC required and not sanctioned', async function () {
      expect(await complianceModule.isCompliant(user1.address, 0)).to.be.true;
    });

    it('returns false if KYC required but not met', async function () {
      expect(await complianceModule.isCompliant(user1.address, 2)).to.be.false;
    });

    it('returns true if KYC required and met', async function () {
      await complianceModule.connect(officer).updateKycLevel(user1.address, 2);
      expect(await complianceModule.isCompliant(user1.address, 1)).to.be.true;
      expect(await complianceModule.isCompliant(user1.address, 2)).to.be.true;
    });
  });
});
