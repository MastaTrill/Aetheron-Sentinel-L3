import { expect } from 'chai';
import { network } from 'hardhat';

describe('SmokeTest', function () {
  it('deploys ERC20Mock and validates metadata', async function () {
    const { ethers } = await network.getOrCreate();
    const [owner] = await ethers.getSigners();
    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const token = await ERC20Mock.deploy(
      'Smoke Token',
      'SMK',
      owner.address,
      ethers.parseEther('1000')
    );
    await token.waitForDeployment();

    expect(await token.name()).to.equal('Smoke Token');
    expect(await token.symbol()).to.equal('SMK');
  });
});
