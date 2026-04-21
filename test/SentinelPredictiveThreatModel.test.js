import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers } = await network.create();

describe('SentinelPredictiveThreatModel', function () {
  let model;
  let owner;
  let user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const SentinelPredictiveThreatModel = await ethers.getContractFactory(
      'SentinelPredictiveThreatModel',
    );
    model = await SentinelPredictiveThreatModel.deploy(owner.address);
    await model.waitForDeployment();
  });

  it('deploys with default AI model metrics', async function () {
    const [threshold, horizon, accuracy] = await model.getAIModelMetrics();
    expect(threshold).to.equal(300n);
    expect(horizon).to.equal(24n);
    expect(accuracy).to.equal(85n);
  });

  it('analyzeBehavior creates profile and updates last activity', async function () {
    const score = await model.analyzeBehavior.staticCall(
      user.address,
      [120, 130, 150, 110],
      'transfer',
    );
    await model.analyzeBehavior(user.address, [120, 130, 150, 110], 'transfer');

    const [trustScore, riskLevel, , , lastActivity] =
      await model.getBehavioralProfile(user.address);
    expect(score).to.be.gte(0n);
    expect(trustScore).to.be.gte(0n);
    expect(riskLevel).to.be.gte(0n);
    expect(lastActivity).to.be.gt(0n);
  });

  it('owner can register threat pattern', async function () {
    await model.registerThreatPattern('oracle drift anomaly', 7, 4, []);
    const patternId = await model.activePatterns(0);

    const [description, severity, , category] =
      await model.getThreatPattern(patternId);
    expect(description).to.equal('oracle drift anomaly');
    expect(severity).to.equal(7n);
    expect(category).to.equal(4n);
  });

  it('rejects invalid severity when registering pattern', async function () {
    await expect(
      model.registerThreatPattern('bad', 0, 0, []),
    ).to.be.revertedWith('Invalid severity');
  });

  it('only owner can update AI model', async function () {
    await expect(model.connect(user).updateAIModel(250, 12, 300)).to.revert(
      ethers,
    );

    await model.updateAIModel(250, 12, 300);
    const [threshold, horizon] = await model.getAIModelMetrics();
    expect(threshold).to.equal(250n);
    expect(horizon).to.equal(12n);
  });

  it('predictThreatPatterns validates input constraints', async function () {
    await expect(model.predictThreatPatterns([1, 2, 3], 1)).to.be.revertedWith(
      'Insufficient historical data',
    );

    const data = Array.from({ length: 24 }, (_, i) => i + 1);
    const predictions = await model.predictThreatPatterns.staticCall(data, 12);
    expect(predictions.length).to.be.lte(5);
  });
});
