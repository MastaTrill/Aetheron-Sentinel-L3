import { getAddress, verifyTypedData, TypedDataEncoder, Interface } from 'ethers';

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
  return { verified: true, quoteDigest: TypedDataEncoder.hash(domain, TYPES, value), route: authorization.approvedRoute, token: authorization.token, poolId: authorization.poolId,
    expectedOutputWei: String(value.expectedOutputWei), actualOutputWei: String(actualOutputWei) };
}

// The timestamp inside a signature is not independent proof of when it existed.
// A separate, previously mined transaction must commit to the signed quote digest.
export function verifyPretradeAnchor({ quoteDigest, anchorTransaction, anchorReceipt, swapBlockNumber, trustedAnchor, anchorContract }) {
  if (!trustedAnchor || !anchorContract) throw new Error('Independent anchor identity not configured');
  if (!anchorTransaction || !anchorReceipt || anchorReceipt.status !== 1) throw new Error('Confirmed quote anchor missing');
  if (!Number.isSafeInteger(swapBlockNumber) || anchorReceipt.blockNumber >= swapBlockNumber || anchorReceipt.blockNumber < 1) throw new Error('Quote anchor must precede swap block');
  if (getAddress(anchorTransaction.from) !== getAddress(trustedAnchor) || getAddress(anchorTransaction.to) !== getAddress(anchorContract)) throw new Error('Untrusted quote anchor sender or destination');
  // Require exact ABI call to reviewed commit(bytes32), not arbitrary calldata containing a digest.
  const anchorInterface = new Interface(['function commit(bytes32 digest)']);
  let decoded;
  try { decoded = anchorInterface.parseTransaction({ data: anchorTransaction.data, value: anchorTransaction.value ?? 0n }); } catch { throw new Error('Invalid anchor commitment calldata'); }
  if (!decoded || decoded.name !== 'commit' || decoded.args.digest.toLowerCase() !== quoteDigest.toLowerCase()) throw new Error('Quote digest not committed in anchor transaction');
  if (anchorTransaction.blockNumber !== anchorReceipt.blockNumber || anchorTransaction.hash?.toLowerCase() !== (anchorReceipt.hash ?? anchorReceipt.transactionHash)?.toLowerCase()) throw new Error('Anchor transaction and receipt mismatch');
  return true;
}
