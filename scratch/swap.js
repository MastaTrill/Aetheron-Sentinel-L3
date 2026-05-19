import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // or use native fetch if Node.js 18+

dotenv.config();

const API_KEY = process.env.UNISWAP_API_KEY || 'xadAqb0VcTfh_aQzBDlFUP7DPIfkRFYF5IU3YeVs1Dg';
const BASE_URL = 'https://trade-api.gateway.uniswap.org/v1';

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || '7aa0c27e2e2545d62e29f69612f6d2fa1a06fe9e9ad448dba69af4075f4aeb34';
  const provider = new ethers.JsonRpcProvider(process.env.BASE_TESTNET_RPC_URL || 'https://sepolia.base.org');
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Swapper wallet address:', wallet.address);

  // WETH address on Base Sepolia
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
  // Let's search or use a deployed SentinelToken address
  // We can dynamically find the last deployed SentinelToken from Hardhat artifacts or pass it as an argument
  // For safety, let's look up if there is a known SentinelToken address in DEPLOYED_ADDRESSES_simulation.json
  let tokenAddress = '0x212a45B7fDCc7E15469440620958dBd708892404'; // Default fallback, but we will try to resolve it!

  // Check if we have a deployment verification or deployed JSON
  try {
    const fs = await import('fs');
    if (fs.existsSync('DEPLOYED_ADDRESSES_simulation.json')) {
      const data = JSON.parse(fs.readFileSync('DEPLOYED_ADDRESSES_simulation.json', 'utf8'));
      if (data.SentinelToken) {
        tokenAddress = data.SentinelToken;
        console.log('Loaded deployed SentinelToken address from simulation JSON:', tokenAddress);
      }
    }
  } catch (e) {
    // Ignore and use fallback/environment
  }

  if (process.argv[2]) {
    tokenAddress = process.argv[2];
  }

  console.log(`Swapping WETH (${WETH_ADDRESS}) for SENT (${tokenAddress})...`);

  const amountIn = ethers.parseEther('0.01').toString(); // 0.01 WETH

  // Step 1: Check approval
  console.log('Checking approval status...');
  const approvalRes = await fetch(`${BASE_URL}/check_approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-universal-router-version': '2.0'
    },
    body: JSON.stringify({
      walletAddress: wallet.address,
      token: WETH_ADDRESS,
      amount: amountIn,
      chainId: 84532
    })
  });

  const approvalData = await approvalRes.json();
  if (approvalData.approval) {
    console.log('Token approval required. Sending approval transaction...');
    const txResponse = await wallet.sendTransaction({
      to: approvalData.approval.to,
      from: approvalData.approval.from,
      data: approvalData.approval.data,
      value: approvalData.approval.value
    });
    console.log('Approval transaction sent! Hash:', txResponse.hash);
    await txResponse.wait();
    console.log('Approval confirmed.');
  } else {
    console.log('Token already approved.');
  }

  // Step 2: Get executable quote
  console.log('Fetching quote...');
  const quoteRes = await fetch(`${BASE_URL}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-universal-router-version': '2.0'
    },
    body: JSON.stringify({
      swapper: wallet.address,
      tokenIn: WETH_ADDRESS,
      tokenOut: tokenAddress,
      tokenInChainId: '84532',
      tokenOutChainId: '84532',
      amount: amountIn,
      type: 'EXACT_INPUT',
      slippageTolerance: 0.5,
      routingPreference: 'BEST_PRICE'
    })
  });

  const quoteData = await quoteRes.json();
  if (!quoteRes.ok || quoteData.errorCode) {
    console.error('Failed to get quote:', quoteData);
    return;
  }

  console.log('Quote retrieved! Routing type:', quoteData.routing);

  // Step 3: Get transaction to sign and submit
  console.log('Requesting swap transaction payload...');
  const { permitData, permitTransaction, ...cleanQuote } = quoteData;
  const swapRequestBody = { ...cleanQuote };

  const isUniswapX = quoteData.routing === 'DUTCH_V2' || quoteData.routing === 'DUTCH_V3' || quoteData.routing === 'PRIORITY';
  
  if (isUniswapX) {
    console.log('UniswapX route detected. Signing the EIP-712 permit message...');
    // Sign permit message locally
    if (permitData) {
      const signature = await wallet.signTypedData(
        permitData.domain,
        permitData.types,
        permitData.values
      );
      swapRequestBody.signature = signature;
    }
  } else {
    // CLASSIC: If permitData is returned, sign it and pass both
    if (permitData && typeof permitData === 'object') {
      console.log('Permit2 EIP-712 signing required...');
      const signature = await wallet.signTypedData(
        permitData.domain,
        permitData.types,
        permitData.values
      );
      swapRequestBody.signature = signature;
      swapRequestBody.permitData = permitData;
    }
  }

  const swapResponse = await fetch(`${BASE_URL}/swap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-universal-router-version': '2.0'
    },
    body: JSON.stringify(swapRequestBody)
  });

  const swapData = await swapResponse.json();
  if (!swapResponse.ok || !swapData.swap) {
    console.error('Failed to get swap payload:', swapData);
    return;
  }

  console.log('Swap transaction payload prepared successfully.');

  // Validate transaction before broadcasting
  if (!swapData.swap.data || swapData.swap.data === '0x') {
    throw new Error('Swap transaction data is empty or invalid.');
  }

  console.log('Submitting swap transaction to the blockchain...');
  const tx = await wallet.sendTransaction({
    to: swapData.swap.to,
    from: swapData.swap.from,
    data: swapData.swap.data,
    value: swapData.swap.value,
    gasLimit: swapData.swap.gasLimit ? ethers.toBigInt(swapData.swap.gasLimit) : 500000n
  });

  console.log('Swap transaction sent! Hash:', tx.hash);
  console.log('Waiting for block confirmation...');
  const receipt = await tx.wait();
  console.log('Swap executed successfully! Receipt status:', receipt.status);
}

main().catch(console.error);
