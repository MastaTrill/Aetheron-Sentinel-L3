const hre = require('hardhat');

async function main() {
  const contractName = process.env.CONTRACT_NAME;
  // Parse constructor arguments from a space-separated string
  const constructorArgs = process.env.CONSTRUCTOR_ARGS
    ? process.env.CONSTRUCTOR_ARGS.split(' ').filter(arg => arg.length > 0)
    : [];

  if (!contractName) {
    console.error('Error: CONTRACT_NAME environment variable not set.');
    process.exit(1);
  }

  const Contract = await hre.ethers.getContractFactory(contractName);
  const contract = await Contract.deploy(...constructorArgs);

  await contract.waitForDeployment();

  // This is the critical line the shell script looks for
  console.log(`Deployed to: ${await contract.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
