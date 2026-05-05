import { ethers } from 'ethers';

const BASE_SEPOLIA_RPC = "https://base-sepolia.g.alchemy.com/v2/23VCFQHfNEoD1cd-muNVp";
const DEPLOYER_ADDR = "0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB";

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  
  const balance = await provider.getBalance(DEPLOYER_ADDR);
  const balanceEth = ethers.formatEther(balance);
  
  console.log(`Address: ${DEPLOYER_ADDR}`);
  console.log(`Balance: ${balanceEth} ETH`);
  console.log(`Balance (wei): ${balance.toString()}`);
  
  // Also check gas price
  const feeData = await provider.getFeeData();
  console.log(`\nGas Price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
  console.log(`Max Fee Per Gas: ${ethers.formatUnits(feeData.maxFeePerGas, 'gwei')} gwei`);
  console.log(`Max Priority Fee: ${ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} gwei`);
}

checkBalance().catch(console.error);
