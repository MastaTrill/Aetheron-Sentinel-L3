#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Interface, JsonRpcProvider, getAddress } from 'ethers';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com';
const POOL_MANAGER = getAddress(process.env.SENTINEL_POOL_MANAGER ?? '0x498581fF718922c3f8e6A244956aF099B2652b2b');
const POOL_ID = (process.env.SENTINEL_POOL_ID ?? '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d').toLowerCase();
const OUTPUT_DIR = process.env.SENTINEL_SMOKE_OUTPUT_DIR ?? 'release-evidence/sentinel-mainnet/smoke-test';
const RECEIPTS_PATH = path.join(OUTPUT_DIR, 'smoke-test-receipts.json');
const AUTHORIZATION_PATH = process.env.SENTINEL_SMOKE_AUTHORIZATION
  ?? path.join(OUTPUT_DIR, 'authorization.json');

const authorization = JSON.parse(await readFile(AUTHORIZATION_PATH, 'utf8'));
const authorizationFailures = [];

if (authorization.schemaVersion !== 1) authorizationFailures.push('authorization schemaVersion must be 1');
if (authorization.status !== 'authorized') authorizationFailures.push(`authorization status must be authorized, found ${authorization.status ?? 'missing'}`);
if (authorization.chainId !== 8453) authorizationFailures.push('authorization chainId must be 8453');
if (authorization.token?.toLowerCase() !== '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3') authorizationFailures.push('authorization token mismatch');
if (authorization.poolId?.toLowerCase() !== POOL_ID) authorizationFailures.push('authorization poolId mismatch');

for (const field of ['authorizedBy', 'authorizedAtUtc', 'testWallet', 'maxWethPrincipalWei', 'maxTotalGasCostWei', 'maxSlippageBps', 'approvedRoute', 'buyAmountWethWei', 'sellAmountSentinelWei']) {
  if (authorization[field] === null || authorization[field] === undefined || authorization[field] === '') {
    authorizationFailures.push(`authorization field ${field} is missing`);
  }
}

if (authorizationFailures.length) {
  console.error('Smoke-test authorization is incomplete or invalid:\n- ' + authorizationFailures.join('\n- '));
  process.exit(1);
}

let BUY_TX_HASH = process.env.SENTINEL_BUY_TX_HASH ?? authorization.buyTransactionHash;
let SELL_TX_HASH = process.env.SENTINEL_SELL_TX_HASH ?? authorization.sellTransactionHash;
let expectedWalletInput = process.env.SENTINEL_SMOKE_TEST_WALLET ?? authorization.testWallet;

if (!BUY_TX_HASH || !SELL_TX_HASH) {
  try {
    const existing = JSON.parse(await readFile(RECEIPTS_PATH, 'utf8'));
    BUY_TX_HASH ??= existing.buy?.transactionHash;
    SELL_TX_HASH ??= existing.sell?.transactionHash;
    expectedWalletInput ??= existing.expectedWallet ?? existing.buy?.signer;
  } catch {
    // The receipt file is created only after both transaction hashes are supplied.
  }
}

if (!BUY_TX_HASH || !SELL_TX_HASH) {
  throw new Error('Set SENTINEL_BUY_TX_HASH and SENTINEL_SELL_TX_HASH or record them in authorization.json. This verifier never signs or broadcasts transactions.');
}

const EXPECTED_WALLET = getAddress(expectedWalletInput);
if (getAddress(authorization.testWallet) !== EXPECTED_WALLET) throw new Error('Expected wallet does not match authorization.testWallet');

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

  const gasPrice = receipt.gasPrice ?? tx.gasPrice ?? 0n;
  const gasCost = receipt.gasUsed * gasPrice;

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

const buy = await verify(BUY_TX_HASH, 'buy-sentinel-with-weth');
const sell = await verify(SELL_TX_HASH, 'sell-sentinel-for-weth');

const actualBuyWeth = BigInt(buy.canonicalPoolAmounts.wethInWei);
const actualSellSentinel = BigInt(sell.canonicalPoolAmounts.sentinelInWei);
const totalGasCost = BigInt(buy.gasCostWei) + BigInt(sell.gasCostWei);

if (actualBuyWeth > BigInt(authorization.buyAmountWethWei)) throw new Error('Actual buy WETH exceeds authorized buyAmountWethWei');
if (actualBuyWeth > BigInt(authorization.maxWethPrincipalWei)) throw new Error('Actual buy WETH exceeds maxWethPrincipalWei');
if (actualSellSentinel > BigInt(authorization.sellAmountSentinelWei)) throw new Error('Actual sell SENTINEL exceeds sellAmountSentinelWei');
if (totalGasCost > BigInt(authorization.maxTotalGasCostWei)) throw new Error('Actual total gas cost exceeds maxTotalGasCostWei');

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
await provider.destroy();
