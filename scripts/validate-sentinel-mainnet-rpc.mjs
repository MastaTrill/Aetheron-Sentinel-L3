#!/usr/bin/env node
import { JsonRpcProvider } from 'ethers';

const rpcUrl = String(process.env.BASE_MAINNET_RPC_URL ?? '').trim();
if (!rpcUrl) {
  throw new Error('BASE_MAINNET_RPC_URL is not configured for the protected SENTINEL path');
}

const provider = new JsonRpcProvider(rpcUrl, 8453, {
  staticNetwork: false,
  batchMaxCount: 1,
});

try {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 8453) {
    throw new Error(`Expected Base Mainnet chainId 8453, received ${network.chainId}`);
  }
  console.log('Protected SENTINEL Base Mainnet RPC: PASS (chainId 8453)');
} finally {
  provider.destroy();
}
