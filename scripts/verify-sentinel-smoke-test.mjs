#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Interface, JsonRpcProvider, getAddress } from 'ethers';
import { validateReplacementBounds, validateReplacementIdentity } from './lib/replacement-smoke-policy.mjs';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com';
const POOL_MANAGER = getAddress(process.env.SENTINEL_POOL_MANAGER ?? '0x498581fF718922c3f8e6A244956aF099B2652b2b');
const POOL_ID = (process.env.SENTINEL_REPLACEMENT_POOL_ID ?? '').toLowerCase();
const REPLACEMENT_TOKEN = process.env.SENTINEL_REPLACEMENT_TOKEN ?? '';
const OUTPUT_DIR = process.env.SENTINEL_SMOKE_OUTPUT_DIR ?? 'release-evidence/sentinel-mainnet/redeployment';
const RECEIPTS_PATH = path.join(OUTPUT_DIR, 'smoke-test-receipts.json');
const AUTHORIZATION_PATH = process.env.SENTINEL_SMOKE_AUTHORIZATION
  ?? path.join(OUTPUT_DIR, 'authorization.json');
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

  const directions = matching.map((parsed) => {
    const amount0 = parsed.args.amount0;
    const amount1 = parsed.args.amount1;
    if (amount0 > 0n && amount1 < 0n) return 'buy-sentinel-with-weth';
    if (amount0 < 0n && amount1 > 0n) return 'sell-sentinel-for-weth';
    return 'other';
  });
  if (!directions.includes(expectedDirection)) throw new Error(`${hash} does not contain expected direction ${expectedDirection}; found ${directions.join(', ')}`);

  let wethIn = 0n;
  let wethOut = 0n;
  let sentinelIn = 0n;
  let sentinelOut = 0n;
  for (const parsed of matching) {
    const amount0 = parsed.args.amount0;
    const amount1 = parsed.args.amount1;
    if (amount0 > 0n && amount1 < 0n) {
      wethIn += amount0;
      sentinelOut += -amount1;
    } else if (amount0 < 0n && amount1 > 0n) {
      wethOut += -amount0;
      sentinelIn += amount1;
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

  // Require externally anchored quote evidence. No quote means no certification.
  // A supplied JSON boolean is never sufficient proof of an independently verified quote.
  if (!authorization.independentQuoteEvidence?.buy || !authorization.independentQuoteEvidence?.sell) {
    throw new Error('Independent pretrade quote evidence missing; cannot certify slippage');
  }
  // Do not trust claimed verified=true from authorization JSON. A separate trusted
  // verifier must validate signatures, timestamp anchoring, and actual output.
  throw new Error('Independent quote signature/anchoring verifier not yet implemented: fail closed');

  const result = {
    schemaVersion: 1,
    verifiedAtUtc: new Date().toISOString(),
    chainId: 8453,
    poolManager: POOL_MANAGER,
    poolId: POOL_ID,
    expectedWallet: EXPECTED_WALLET,
    authorization: {
      authorizedBy: authorization.authorizedBy,
      authorizedAtUtc: authorization.authorizedAtUtc,
      maxWethPrincipalWei: String(authorization.maxWethPrincipalWei),
      maxTotalGasCostWei: String(authorization.maxTotalGasCostWei),
      maxSlippageBps: String(authorization.maxSlippageBps),
      approvedRoute: authorization.approvedRoute,
      buyAmountWethWei: String(authorization.buyAmountWethWei),
      sellAmountSentinelWei: String(authorization.sellAmountSentinelWei),
      buyTransactionHash: BUY_TX_HASH,
      sellTransactionHash: SELL_TX_HASH,
    },
    observedTotalGasCostWei: totalGasCost.toString(),
    buy,
    sell,
    notice: 'Receipt verification only. The verifier never signs or broadcasts transactions.',
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(RECEIPTS_PATH, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_DIR, 'README.md'), `# SENTINEL minimal buy/sell smoke-test evidence\n\n- Verified: ${result.verifiedAtUtc}\n- Buy transaction: \`${BUY_TX_HASH}\`\n- Sell transaction: \`${SELL_TX_HASH}\`\n- Pool ID: \`${POOL_ID}\`\n- Signer: \`${buy.signer}\`\n- Total gas cost (wei): \`${totalGasCost}\`\n\nBoth receipts succeeded, stayed within the recorded principal/gas authorization, and emitted canonical-pool Swap events in the expected directions. Slippage approval must be checked against the signed wallet quotes and independently reviewed.\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await provider.destroy();
}
