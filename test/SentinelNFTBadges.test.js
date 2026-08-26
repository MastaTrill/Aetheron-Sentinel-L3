// test/SentinelNFTBadges.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelNFTBadges', function () {
  this.timeout(100000);
  let badges, owner, contributor, attacker;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, contributor, attacker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('SentinelNFTBadges');
    badges = await Factory.deploy(owner.address);
    await badges.waitForDeployment();
  });

  it('deploys with zero badges issued', async function () {
    expect(await badges.totalBadgesIssued()).to.equal(0n);
    expect(await badges.holderBadgeCount(contributor.address)).to.equal(0n);
  });

  it('allows owner to issue a soulbound badge', async function () {
    await badges.issueBadge(contributor.address, 'Flash Loan Defender', 'GOLD', 'ipfs://QmBadge1');
    expect(await badges.totalBadgesIssued()).to.equal(1n);
    expect(await badges.holderBadgeCount(contributor.address)).to.equal(1n);

    const badge = await badges.holderBadges(contributor.address, 0);
    expect(badge.name).to.equal('Flash Loan Defender');
    expect(badge.tier).to.equal('GOLD');
    expect(badge.active).to.equal(true);
  });

  it('prevents non-owner from issuing badges', async function () {
    await expect(
      badges.connect(attacker).issueBadge(attacker.address, 'Fake Badge', 'BRONZE', 'ipfs://fake')
    ).to.be.revertedWithCustomError(badges, 'OwnableUnauthorizedAccount');
  });

  it('allows owner to revoke a badge', async function () {
    await badges.issueBadge(contributor.address, 'Reentrancy Hunter', 'SILVER', 'ipfs://QmBadge2');
    await badges.revokeBadge(contributor.address, 0);
    const badge = await badges.holderBadges(contributor.address, 0);
    expect(badge.active).to.equal(false);
  });

  it('reverts all transfer attempts (soulbound)', async function () {
    await expect(badges.transfer(attacker.address, 1)).to.be.revertedWith('SoulboundBadge: transfers disabled');
  });
});
