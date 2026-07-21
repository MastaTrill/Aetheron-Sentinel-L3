import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const address = '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB';

async function main() {
  console.log('Checking balance for', address, 'on Base Sepolia...');
  for (let i = 0; i < 60; i++) {
    const balance = await provider.getBalance(address);
    console.log(`Current Balance (Attempt ${i + 1}/60):`, ethers.formatEther(balance), 'ETH');
    if (balance > 0n) {
      console.log('🎉 ETH arrived on Base Sepolia!');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  console.log('Timed out waiting for deposit.');
}
main().catch(console.error);
