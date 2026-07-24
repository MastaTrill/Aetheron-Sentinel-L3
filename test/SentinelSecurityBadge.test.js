// test/SentinelSecurityBadge.test.js
import { expect } from 'chai';
import { network } from 'hardhat';

describe('SentinelSecurityBadge', function () {
  let badge, owner, protocol, attacker;
  let ethers;

  beforeEach(async function () {
    ({ ethers } = await network.getOrCreate());
    [owner, protocol, attacker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('SentinelSecurityBadge');
    badge = await Factory.deploy(owner.address);
    await badge.waitForDeployment();
  });

  it('deploys with correct metadata', async function () {
    expect(await badge.name()).to.equal('Sentinel L3 Security Badge');
    expect(await badge.symbol()).to.equal('SL3BADGE');
    expect(await badge.owner()).to.equal(owner.address);
  });

  it('allows owner to mint a soulbound badge', async function () {
    const tx = await badge.mintBadge(
      protocol.address,
      'AetheronSwap Protocol',
      98,
      'ipfs://Qmbadge123'
    );
    await tx.wait();

    expect(await badge.balanceOf(protocol.address)).to.equal(1n);
    expect(await badge.tokenURI(1)).to.equal('ipfs://Qmbadge123');

    const info = await badge.badges(1);
    expect(info.protocolName).to.equal('AetheronSwap Protocol');
    expect(info.securityScore).to.equal(98n);
    expect(info.isActive).to.equal(true);
  });

  it('prevents non-owner from minting', async function () {
    await expect(
      badge
        .connect(attacker)
        .mintBadge(protocol.address, 'Fake Protocol', 50, 'ipfs://fake')
    ).to.be.revertedWithCustomError(badge, 'OwnableUnauthorizedAccount');
  });

  it('enforces soulbound property (rejects transfers)', async function () {
    await badge.mintBadge(protocol.address, 'VaultProtocol', 95, 'ipfs://vault');

    await expect(
      badge.connect(protocol).transferFrom(protocol.address, attacker.address, 1)
    ).to.be.revertedWith('SentinelSecurityBadge: Token is soulbound and non-transferable');
  });

  it('allows owner to update security score and revoke badge', async function () {
    await badge.mintBadge(protocol.address, 'ProtocolX', 80, 'ipfs://x');

    await badge.updateScore(1, 95);
    const updated = await badge.badges(1);
    expect(updated.securityScore).to.equal(95n);

    await badge.revokeBadge(1);
    const revoked = await badge.badges(1);
    expect(revoked.isActive).to.equal(false);
  });
});
