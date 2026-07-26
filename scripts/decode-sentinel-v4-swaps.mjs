#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Interface, JsonRpcProvider, getAddress } from 'ethers';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
const POOL_MANAGER = getAddress(process.env.SENTINEL_POOL_MANAGER ?? '0x498581fF718922c3f8e6A244956aF099B2652b2b');
const POOL_ID = (process.env.SENTINEL_POOL_ID ?? '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d').toLowerCase();
const FROM_BLOCK = Number(process.env.SENTINEL_SWAP_FROM_BLOCK ?? '42506026');
const requestedToBlock = process.env.SENTINEL_SWAP_TO_BLOCK;
const INITIAL_CHUNK = Number(process.env.SENTINEL_LOG_CHUNK ?? '9000');
const MIN_CHUNK = Number(process.env.SENTINEL_LOG_MIN_CHUNK ?? '500');
const CONCURRENCY = Number(process.env.SENTINEL_LOG_CONCURRENCY ?? '4');
const OUTPUT_DIR = process.env.SENTINEL_SWAP_OUTPUT_DIR ?? 'release-evidence/sentinel-mainnet/swaps-decoded';

if (!Number.isSafeInteger(FROM_BLOCK) || FROM_BLOCK < 0) throw new Error('Invalid SENTINEL_SWAP_FROM_BLOCK');
if (!Number.isSafeInteger(INITIAL_CHUNK) || INITIAL_CHUNK < MIN_CHUNK) throw new Error('Invalid SENTINEL_LOG_CHUNK');
if (!Number.isSafeInteger(MIN_CHUNK) || MIN_CHUNK < 1) throw new Error('Invalid SENTINEL_LOG_MIN_CHUNK');
if (!Number.isSafeInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 12) throw new Error('Invalid SENTINEL_LOG_CONCURRENCY');

const provider = new JsonRpcProvider(RPC_URL, 8453, { staticNetwork: true });
const iface = new Interface([
  'event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)',
]);
const swapEvent = iface.getEvent('Swap');
const topic0 = swapEvent.topicHash;
const toBlock = requestedToBlock ? Number(requestedToBlock) : await provider.getBlockNumber();
if (!Number.isSafeInteger(toBlock) || toBlock < FROM_BLOCK) throw new Error('Invalid SENTINEL_SWAP_TO_BLOCK');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchRange(fromBlock, endBlock, attempt = 0) {
  try {
    return await provider.getLogs({
      address: POOL_MANAGER,
      fromBlock,
      toBlock: endBlock,
      topics: [topic0, POOL_ID],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attempt < 2) {
      await sleep(500 * (2 ** attempt));
      return fetchRange(fromBlock, endBlock, attempt + 1);
    }
    const width = endBlock - fromBlock + 1;
    if (width > MIN_CHUNK) {
      const midpoint = fromBlock + Math.floor(width / 2) - 1;
      const [left, right] = await Promise.all([
        fetchRange(fromBlock, midpoint),
        fetchRange(midpoint + 1, endBlock),
      ]);
      return [...left, ...right];
    }
    throw new Error(`eth_getLogs failed for ${fromBlock}-${endBlock}: ${message}`);
  }
}

const ranges = [];
for (let cursor = FROM_BLOCK; cursor <= toBlock; cursor += INITIAL_CHUNK) {
  ranges.push([cursor, Math.min(toBlock, cursor + INITIAL_CHUNK - 1)]);
}

let nextRange = 0;
let completedRanges = 0;
const collectedLogs = [];
async function worker() {
  while (true) {
    const index = nextRange;
    nextRange += 1;
    if (index >= ranges.length) return;
    const [fromBlock, endBlock] = ranges[index];
    const logs = await fetchRange(fromBlock, endBlock);
    collectedLogs.push(...logs);
    completedRanges += 1;
    if (completedRanges % 50 === 0 || completedRanges === ranges.length) {
      console.error(`Scanned ${completedRanges}/${ranges.length} ranges; matching logs: ${collectedLogs.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ranges.length) }, () => worker()));
const logMap = new Map();
for (const log of collectedLogs) logMap.set(`${log.transactionHash}:${log.index}`, log);
const logs = [...logMap.values()].sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

const transactionHashes = [...new Set(logs.map((log) => log.transactionHash))];
const transactions = await Promise.all(transactionHashes.map((hash) => provider.getTransaction(hash)));
const transactionMap = new Map(transactionHashes.map((hash, index) => [hash, transactions[index]]));

const decoded = [];
for (const log of logs) {
  const parsed = iface.parseLog(log);
  if (!parsed) continue;
  const amount0 = parsed.args.amount0;
  const amount1 = parsed.args.amount1;
  const direction = amount0 > 0n && amount1 < 0n
    ? 'buy-sentinel-with-weth'
    : amount0 < 0n && amount1 > 0n
      ? 'sell-sentinel-for-weth'
      : 'other';
  const tx = transactionMap.get(log.transactionHash);
  decoded.push({
    blockNumber: log.blockNumber,
    transactionIndex: log.transactionIndex,
    logIndex: log.index,
    transactionHash: log.transactionHash,
    sender: getAddress(parsed.args.sender),
    transactionFrom: tx?.from ? getAddress(tx.from) : null,
    transactionTo: tx?.to ? getAddress(tx.to) : null,
    inputSelector: tx?.data?.slice(0, 10) ?? null,
    amount0WethRaw: amount0.toString(),
    amount1SentinelRaw: amount1.toString(),
    sqrtPriceX96: parsed.args.sqrtPriceX96.toString(),
    liquidity: parsed.args.liquidity.toString(),
    tick: Number(parsed.args.tick),
    feeRaw: Number(parsed.args.fee),
    direction,
  });
}

const buys = decoded.filter((row) => row.direction === 'buy-sentinel-with-weth').length;
const sells = decoded.filter((row) => row.direction === 'sell-sentinel-for-weth').length;
const uniqueSenders = new Set(decoded.map((row) => row.sender.toLowerCase())).size;
const uniqueEntrypoints = [...new Set(decoded.map((row) => row.transactionTo).filter(Boolean))].sort();
const capturedAtUtc = new Date().toISOString();
const summary = {
  schemaVersion: 1,
  capturedAtUtc,
  chainId: 8453,
  rpcUrlRedacted: new URL(RPC_URL).origin,
  poolManager: POOL_MANAGER,
  poolId: POOL_ID,
  fromBlock: FROM_BLOCK,
  toBlock,
  chunkSize: INITIAL_CHUNK,
  concurrency: CONCURRENCY,
  swapLogCount: decoded.length,
  buyCount: buys,
  sellCount: sells,
  otherCount: decoded.length - buys - sells,
  uniqueSenders,
  uniqueTransactionEntrypoints: uniqueEntrypoints,
  swaps: decoded,
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(path.join(OUTPUT_DIR, 'swaps.json'), `${JSON.stringify(summary, null, 2)}\n`);

const markdown = `# SENTINEL V4 decoded swap and routing evidence\n\n- Captured: ${capturedAtUtc}\n- Chain ID: 8453\n- Pool manager: \`${POOL_MANAGER}\`\n- Pool ID: \`${POOL_ID}\`\n- Block range: ${FROM_BLOCK}–${toBlock}\n- Matching swaps: ${decoded.length}\n- Buys (WETH in, SENTINEL out): ${buys}\n- Sells (SENTINEL in, WETH out): ${sells}\n- Other sign patterns: ${decoded.length - buys - sells}\n- Unique event senders: ${uniqueSenders}\n\n## Transaction entrypoints\n\n${uniqueEntrypoints.length ? uniqueEntrypoints.map((address) => `- \`${address}\``).join('\n') : '- None resolved'}\n\n## Evidence limitations\n\nThis file proves historical successful PoolManager Swap events for the canonical pool and records the outer transaction entrypoints and selectors. It does not identify the human trader, prove current quote availability, or replace the separately authorized buy-and-sell smoke test.\n`;
await writeFile(path.join(OUTPUT_DIR, 'routing-summary.md'), markdown);
console.log(JSON.stringify({ outputDir: OUTPUT_DIR, rangeCount: ranges.length, swapLogCount: decoded.length, buys, sells, uniqueSenders }, null, 2));
await provider.destroy();
