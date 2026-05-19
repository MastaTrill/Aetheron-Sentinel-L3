import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const address = '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB';
await provider.getBalance(address).then(b => {
  console.log('L2 Base Sepolia balance for', address, ':', ethers.formatEther(b), 'ETH');
}).catch(console.error);
