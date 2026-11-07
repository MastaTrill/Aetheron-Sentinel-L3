import { getAddress, verifyTypedData } from 'ethers';

const TYPES = { PretradeQuote: [
  { name: 'poolId', type: 'bytes32' },
  { name: 'token', type: 'address' },
  { name: 'route', type: 'address' },
  { name: 'wallet', type: 'address' },
  { name: 'calldataHash', type: 'bytes32' },
  { name: 'direction', type: 'string' },
  { name: 'expectedOutputWei', type: 'uint256' },
  { name: 'quotedAt', type: 'uint256' },
  { name: 'expiresAt', type: 'uint256' },
] };
export function verifyIndependentQuote({ quote, trustedSigner, authorization, transaction, blockTimestamp, direction, actualOutputWei }) {
  if (!trustedSigner) throw new Error('Independent quote signer must be configured outside authorization');
  if (!quote || typeof quote !== 'object' || !quote.signature) throw new Error('Signed pretrade quote missing');
  const value = quote.value;
  if (!value || !/^[0-9]+$/.test(String(value.expectedOutputWei ?? '')) || BigInt(value.expectedOutputWei) <= 0n) throw new Error('Quote expected output invalid');
  if (BigInt(actualOutputWei) < 0n) throw new Error('Actual output invalid');
  if (BigInt(value.quotedAt) >= BigInt(blockTimestamp) || BigInt(value.expiresAt) < BigInt(blockTimestamp) ||
      BigInt(value.expiresAt) <= BigInt(value.quotedAt) || BigInt(value.expiresAt) - BigInt(value.quotedAt) > 300n) throw new Error('Quote is stale or not demonstrably pretrade');
  const domain = { name: 'SentinelIndependentQuote', version: '1', chainId: 8453 };
  const signer = verifyTypedData(domain, TYPES, value, quote.signature);
  if (getAddress(signer) !== getAddress(trustedSigner)) throw new Error('Quote signer not independently trusted');
  if (value.poolId.toLowerCase() !== authorization.poolId.toLowerCase() ||
      getAddress(value.token) !== getAddress(authorization.token) ||
      getAddress(value.route) !== getAddress(authorization.approvedRoute) ||
      getAddress(value.wallet) !== getAddress(authorization.testWallet) ||
      value.calldataHash.toLowerCase() !== transaction.calldataHash.toLowerCase() ||
      value.direction !== direction) throw new Error('Signed quote does not match transaction and authorization');
  return { verified: true, route: authorization.approvedRoute, token: authorization.token, poolId: authorization.poolId,
    expectedOutputWei: String(value.expectedOutputWei), actualOutputWei: String(actualOutputWei) };
}
