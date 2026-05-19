import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || '7aa0c27e2e2545d62e29f69612f6d2fa1a06fe9e9ad448dba69af4075f4aeb34';
  const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Wallet address:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance on Ethereum Sepolia:', ethers.formatEther(balance), 'ETH');

  if (balance < ethers.parseEther('0.85')) {
    console.error('Insufficient balance to bridge 0.8 ETH!');
    return;
  }

  // Base Sepolia L1StandardBridge address on Ethereum Sepolia
  const bridgeAddress = '0x3154Cf16ccdb4C6d922629664174b904d80F2C35';
  
  // Minimal ABI for bridgeETH
  const bridgeAbi = [
    'function bridgeETH(uint32 _minGasLimit, bytes _extraData) payable',
    'function depositETH(uint32 _minGasLimit, bytes _extraData) payable'
  ];

  const bridge = new ethers.Contract(bridgeAddress, bridgeAbi, wallet);

  const bridgeAmount = ethers.parseEther('0.8');
  const minGasLimit = 200000;
  const extraData = '0x';

  console.log('Initiating bridge of 0.8 ETH to Base Sepolia...');

  try {
    const tx = await bridge.bridgeETH(minGasLimit, extraData, {
      value: bridgeAmount,
      gasLimit: 300000
    });
    console.log('Transaction sent! Hash:', tx.hash);
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction confirmed! Bridge transaction complete. Receipt status:', receipt.status);
  } catch (error) {
    console.log('bridgeETH failed, trying depositETH...');
    const tx = await bridge.depositETH(minGasLimit, extraData, {
      value: bridgeAmount,
      gasLimit: 300000
    });
    console.log('Transaction sent (depositETH)! Hash:', tx.hash);
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction confirmed! Receipt status:', receipt.status);
  }
}

main().catch(console.error);
