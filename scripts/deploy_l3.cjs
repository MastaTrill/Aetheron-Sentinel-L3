const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Starting L3 Genesis with account:', deployer.address);

  // 1. Deploy Timelock
  console.log('\nDeploying TimelockController...');
  const Timelock = await ethers.getContractFactory('TimelockController');
  const timelock = await Timelock.deploy(
    0,
    [deployer.address],
    [deployer.address],
    deployer.address
  );
  await timelock.waitForDeployment();
  const timelockAddr = await timelock.getAddress();
  console.log('Timelock deployed to:', timelockAddr);

  // 2. Deploy Mock Voting Token
  console.log('\nDeploying MockVotes Token...');
  const Token = await ethers.getContractFactory('MockVotes');
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log('MockVotes deployed to:', tokenAddr);

  // 3. Deploy SentinelGovernance with the REAL token address
  console.log('\nDeploying SentinelGovernance...');
  const Governance = await ethers.getContractFactory('SentinelGovernance');
  const governance = await Governance.deploy(tokenAddr, timelockAddr);
  await governance.waitForDeployment();
  console.log('SentinelGovernance deployed to:', await governance.getAddress());

  // 4. Deploy SentinelCoreLoop
  console.log('\nDeploying SentinelCoreLoop...');
  const CoreLoop = await ethers.getContractFactory('SentinelCoreLoop');
  const coreLoop = await CoreLoop.deploy();
  await coreLoop.waitForDeployment();
  console.log('SentinelCoreLoop deployed to:', await coreLoop.getAddress());

  console.log('\n--- L3 INFRASTRUCTURE ONLINE ---');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
