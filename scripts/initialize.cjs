require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const network = process.env.HARDHAT_NETWORK || process.env.npm_config_network || 'sepolia';
const rpcUrl = process.env[`${network.toUpperCase()}_RPC_URL`] || process.env.SEPOLIA_RPC_URL;
const ownerKey = (process.env.OWNER_PRIVATE_KEY || '').trim();

if (!rpcUrl) {
  console.error(`No RPC URL for network: ${network}`);
  process.exit(1);
}
if (!/^0x[0-9a-fA-F]{64}$/.test(ownerKey)) {
  console.error('OWNER_PRIVATE_KEY must be set as a 0x-prefixed 32-byte hex key.');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(ownerKey, provider);

const contractAddress = process.env.CONTRACT_ADDRESS || process.argv[4];
const initFunction = process.env.INIT_FUNCTION || process.argv[5];
const initArgs = process.env.INIT_ARGS ? process.env.INIT_ARGS.split(',') : (process.argv[6] ? process.argv[6].split(',') : []);

if (!contractAddress || !initFunction) {
  console.error('Usage: CONTRACT_ADDRESS=0x... INIT_FUNCTION=methodName INIT_ARGS=arg1,arg2 npx hardhat run scripts/initialize.cjs --network <network>');
  process.exit(1);
}

const abiPath = path.join(__dirname, '..', 'abis', `${initFunction.split('_')[0]}.json`);
let abi = [];
try {
  const abiFile = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  abi = abiFile.abi || abiFile;
} catch {
  console.warn(`Could not load ABI from ${abiPath}, using empty ABI.`);
}

const contract = new ethers.Contract(contractAddress, abi, wallet);

async function main() {
  console.log(`Calling ${initFunction}(${initArgs.join(', ')}) on ${contractAddress}...`);
  try {
    const tx = await contract[initFunction](...initArgs);
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}`);
  } catch (err) {
    console.error(`Initialization failed: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
