import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelSecurityAuditor', function () {
  let auditor;
  let owner;
  let user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const SentinelSecurityAuditor = await ethers.getContractFactory(
      'SentinelSecurityAuditor',
    );
    auditor = await SentinelSecurityAuditor.deploy(owner.address);
    await auditor.waitForDeployment();
  });

  it('deploys with baseline security defaults', async function () {
    expect(await auditor.owner()).to.equal(owner.address);
    expect(await auditor.threatLevel()).to.equal(10n);
    expect(await auditor.securityScore()).to.equal(850n);
    expect(await auditor.alertThreshold()).to.equal(5n);
    expect(await auditor.ruleCount()).to.equal(4n); // default rules
  });

  it('creates audit log and increments count', async function () {
    await auditor.createAuditLog(
      'transfer',
      user.address,
      5,
      'normal transfer',
    );
    expect(await auditor.logCount()).to.equal(1n);

    const [, , , , totalLogs] = await auditor.getSecurityDashboard();
    expect(totalLogs).to.equal(1n);
  });

  it('rejects invalid log severity', async function () {
    await expect(
      auditor.createAuditLog('x', user.address, 0, 'bad'),
    ).to.be.revertedWith('Invalid severity');
  });

  it('reports incidents and lowers security score', async function () {
    const before = await auditor.securityScore();
    await auditor
      .connect(user)
      .reportSecurityIncident(
        'oracle_attack',
        8,
        'price feed manipulation',
        ethers.toUtf8Bytes('evidence'),
      );
    const after = await auditor.securityScore();

    expect(await auditor.incidentCount()).to.equal(1n);
    expect(after).to.be.lt(before);
  });

  it('incident lifecycle: confirm then resolve', async function () {
    await auditor
      .connect(user)
      .reportSecurityIncident(
        'dos',
        7,
        'api saturation',
        ethers.toUtf8Bytes('evidence'),
      );

    await expect(auditor.resolveIncident(0)).to.be.revertedWith(
      'Not confirmed',
    );

    await auditor.confirmIncident(0);
    await auditor.resolveIncident(0);

    const incident = await auditor.securityIncidents(0);
    expect(incident.confirmed).to.equal(true);
    expect(incident.resolved).to.equal(true);
  });

  it('owner can add alert recipient and threshold', async function () {
    await auditor.addAlertRecipient(user.address);
    expect(await auditor.isAlertRecipient(user.address)).to.equal(true);

    await auditor.setAlertThreshold(7);
    expect(await auditor.alertThreshold()).to.equal(7n);
  });
});
