#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Interface, JsonRpcProvider, getAddress, keccak256 } from 'ethers';
import { verifyIndependentQuote, verifyPretradeAnchor } from './lib/independent-quote-verifier.mjs';
import { validateReplacementBounds, validateReplacementIdentity, validateCanonicalPoolKey, classifyReplacementSwap } from './lib/replacement-smoke-policy.mjs';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com';
const POOL_MANAGER = getAddress(process.env.SENTINEL_POOL_MANAGER ?? '0x498581fF718922c3f8e6A244956aF099B2652b2b');
const POOL_ID = (process.env.SENTINEL_REPLACEMENT_POOL_ID ?? '').toLowerCase();
const REPLACEMENT_TOKEN = process.env.SENTINEL_REPLACEMENT_TOKEN ?? '';
const AUTHORIZATION_PATH = process.env.SENTINEL_SMOKE_AUTHORIZATION
  ?? path.join('release-evidence/sentinel-mainnet/redeployment', 'authorization.json');
const TX_HASH_PATTERN = /^0x[0-9a-f]{64}$/i;

const authorization = JSON.parse(await readFile(AUTHORIZATION_PATH, 'utf8'));
const authorizationFailures = [];

if (authorization.schemaVersion !== 1) authorizationFailures.push('authorization schemaVersion must be 1');
if (authorization.status !== 'authorized') authorizationFailures.push(`authorization status must be authorized, found ${authorization.status ?? 'missing'}`);
if (authorization.chainId !== 8453) authorizationFailures.push('authorization chainId must be 8453');
try { validateReplacementIdentity({token: authorization.token, poolId: authorization.poolId, expectedToken: REPLACEMENT_TOKEN, expectedPoolId: POOL_ID}); } catch (error) { authorizationFailures.push(error.message); }


for (const field of ['authorizedBy', 'authorizedAtUtc', 'testWallet', 'maxWethPrincipalWei', 'maxTotalGasCostWei', 'maxSlippageBps', 'approvedRoute', 'buyAmountWethWei', 'sellAmountSentinelWei', 'buyTransactionHash', 'sellTransactionHash']) {
  if (authorization[field] === null || authorization[field] === undefined || authorization[field] === '') {
    authorizationFailures.push(`authorization field ${field} is missing`);
  }
}
if (!TX_HASH_PATTERN.test(authorization.buyTransactionHash ?? '')) authorizationFailures.push('authorization buyTransactionHash is malformed');
if (!TX_HASH_PATTERN.test(authorization.sellTransactionHash ?? '')) authorizationFailures.push('authorization sellTransactionHash is malformed');

if (authorizationFailures.length) {
  console.error('Smoke-test authorization is incomplete or invalid:\n- ' + authorizationFailures.join('\n- '));
  process.exit(1);
}

// Require exact canonical PoolKey evidence before interpreting currency-indexed Swap deltas.
const WETH_IS_CURRENCY0 = validateCanonicalPoolKey({
  poolKey: authorization.poolKey, token: REPLACEMENT_TOKEN, poolId: POOL_ID,
});

const BUY_TX_HASH = authorization.buyTransactionHash;
const SELL_TX_HASH = authorization.sellTransactionHash;
const EXPECTED_WALLET = getAddress(authorization.testWallet);

if (process.env.SENTINEL_BUY_TX_HASH && process.env.SENTINEL_BUY_TX_HASH.toLowerCase() !== BUY_TX_HASH.toLowerCase()) {
  throw new Error('SENTINEL_BUY_TX_HASH differs from authorization.buyTransactionHash');
}
if (process.env.SENTINEL_SELL_TX_HASH && process.env.SENTINEL_SELL_TX_HASH.toLowerCase() !== SELL_TX_HASH.toLowerCase()) {
  throw new Error('SENTINEL_SELL_TX_HASH differs from authorization.sellTransactionHash');
}
if (process.env.SENTINEL_SMOKE_TEST_WALLET && getAddress(process.env.SENTINEL_SMOKE_TEST_WALLET) !== EXPECTED_WALLET) {
  throw new Error('SENTINEL_SMOKE_TEST_WALLET differs from authorization.testWallet');
}

const provider = new JsonRpcProvider(RPC_URL, 8453, { staticNetwork: true });
const iface = new Interface([
  'event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)',
]);

async function verify(hash, expectedDirection) {
  const [tx, receipt] = await Promise.all([provider.getTransaction(hash), provider.getTransactionReceipt(hash)]);
  if (!tx || !receipt) throw new Error(`Transaction not found: ${hash}`);
  if (receipt.status !== 1) throw new Error(`Transaction reverted: ${hash}`);
  if (getAddress(tx.from) !== EXPECTED_WALLET) throw new Error(`Unexpected signer for ${hash}: ${tx.from}`);

  const matching = receipt.logs
    .filter((log) => log.address.toLowerCase() === POOL_MANAGER.toLowerCase())
    .map((log) => {
      try { return iface.parseLog(log); } catch { return null; }
    })
    .filter((parsed) => parsed && parsed.args.id.toLowerCase() === POOL_ID);
  if (matching.length === 0) throw new Error(`No canonical PoolManager Swap event in ${hash}`);

  const swaps = matching.map((parsed) =>
    classifyReplacementSwap(parsed.args.amount0, parsed.args.amount1, WETH_IS_CURRENCY0));
  const directions = swaps.map((swap) => swap.direction);
  if (directions.some((direction) => direction !== expectedDirection)) {
    throw new Error(`${hash} contains unsupported or wrong-direction Swap events: ${directions.join(', ')}`);
  }

  let wethIn = 0n;
  let wethOut = 0n;
  let sentinelIn = 0n;
  let sentinelOut = 0n;
  for (const swap of swaps) {
    if (swap.direction === 'buy-sentinel-with-weth') {
      wethIn += swap.weth;
      sentinelOut += -swap.sentinel;
    } else if (swap.direction === 'sell-sentinel-for-weth') {
      wethOut += -swap.weth;
      sentinelIn += swap.sentinel;
    }
  }

  const gasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice ?? tx.gasPrice;
  if (gasPrice === null || gasPrice === undefined) throw new Error(`Cannot determine authoritative gas price for ${hash}`);
  const gasCost = receipt.gasUsed * gasPrice;
  if (tx.to?.toLowerCase() !== authorization.approvedRoute?.toLowerCase()) throw new Error('Transaction entrypoint differs from approved route');

  return {
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
    signer: getAddress(tx.from),
    entrypoint: tx.to ? getAddress(tx.to) : null,
    inputSelector: tx.data.slice(0, 10),
    calldataHash: keccak256(tx.data),
    blockTimestamp: (await provider.getBlock(receipt.blockNumber)).timestamp,
    gasUsed: receipt.gasUsed.toString(),
    gasPriceWei: gasPrice.toString(),
    gasCostWei: gasCost.toString(),
    directions,
    canonicalPoolAmounts: {
      wethInWei: wethIn.toString(),
      wethOutWei: wethOut.toString(),
      sentinelInWei: sentinelIn.toString(),
      sentinelOutWei: sentinelOut.toString(),
    },
  };
}

try {
  const buy = await verify(BUY_TX_HASH, 'buy-sentinel-with-weth');
  const sell = await verify(SELL_TX_HASH, 'sell-sentinel-for-weth');

  const actualBuyWeth = BigInt(buy.canonicalPoolAmounts.wethInWei);
  const actualSellSentinel = BigInt(sell.canonicalPoolAmounts.sentinelInWei);
  const totalGasCost = BigInt(buy.gasCostWei) + BigInt(sell.gasCostWei);

  if (actualBuyWeth > BigInt(authorization.buyAmountWethWei)) throw new Error('Actual buy WETH exceeds authorized buyAmountWethWei');
  if (actualBuyWeth > BigInt(authorization.maxWethPrincipalWei)) throw new Error('Actual buy WETH exceeds maxWethPrincipalWei');
  if (actualSellSentinel > BigInt(authorization.sellAmountSentinelWei)) throw new Error('Actual sell SENTINEL exceeds sellAmountSentinelWei');
  if (totalGasCost > BigInt(authorization.maxTotalGasCostWei)) throw new Error('Actual total gas cost exceeds maxTotalGasCostWei');

  // Require an independently reviewed runtime code hash, not merely a caller-supplied address.
  const anchorContract = process.env.SENTINEL_INDEPENDENT_ANCHOR_CONTRACT;
  const approvedCodeHash = process.env.SENTINEL_INDEPENDENT_ANCHOR_CODE_HASH;
  if (!anchorContract || !/^0x[0-9a-f]{64}$/i.test(approvedCodeHash ?? '')) {
    throw new Error('Independent reviewed anchor contract and runtime code hash are required');
  }
  const anchorCode = await provider.getCode(getAddress(anchorContract));
  if (anchorCode === '0x' || keccak256(anchorCode).toLowerCase() !== approvedCodeHash.toLowerCase()) {
    throw new Error('Anchor contract bytecode does not match independently approved code hash');
  }
  const trustedSigner = process.env.SENTINEL_INDEPENDENT_QUOTE_SIGNER;
  const quotes = {};
  for (const [leg, receipt, direction, actualOutputWei] of [
    ['buy', buy, 'buy-sentinel-with-weth', buy.canonicalPoolAmounts.sentinelOutWei],
    ['sell', sell, 'sell-sentinel-for-weth', sell.canonicalPoolAmounts.wethOutWei],
  ]) {
    quotes[leg] = verifyIndependentQuote({
      quote: authorization.independentQuoteEvidence?.[leg], trustedSigner, authorization,
      transaction: receipt, blockTimestamp: receipt.blockTimestamp, direction, actualOutputWei,
    });
    const anchorHash = authorization.independentQuoteEvidence?.[leg]?.anchorTransactionHash;
    if (!TX_HASH_PATTERN.test(anchorHash ?? '')) throw new Error(leg + ' quote anchor transaction hash missing');
    const [anchorTransaction, anchorReceipt] = await Promise.all([provider.getTransaction(anchorHash), provider.getTransactionReceipt(anchorHash)]);
    verifyPretradeAnchor({ quoteDigest: quotes[leg].quoteDigest, anchorTransaction, anchorReceipt,
      swapBlockNumber: (leg === 'buy' ? buy : sell).blockNumber,
      trustedAnchor: process.env.SENTINEL_INDEPENDENT_ANCHOR_SIGNER,
      anchorContract: process.env.SENTINEL_INDEPENDENT_ANCHOR_CONTRACT });
  }
  validateReplacementBounds(authorization, {
    token: REPLACEMENT_TOKEN, poolId: POOL_ID, buyWethWei: actualBuyWeth.toString(),
    sellSentinelWei: actualSellSentinel.toString(), totalGasCostWei: totalGasCost.toString(), quotes,
  });
  console.log('Smoke-test receipts and independently signed quote bounds verified; no transaction submitted.');


} finally {
  await provider.destroy();
}
