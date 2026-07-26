#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Interface, JsonRpcProvider, getAddress } from 'ethers';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com';
const POOL_MANAGER = getAddress(process.env.SENTINEL_POOL_MANAGER ?? '0x498581fF718922c3f8e6A244956aF099B2652b2b');
const POOL_ID = (process.env.SENTINEL_POOL_ID ?? '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d').toLowerCase();
const FROM_BLOCK = Number(process.env.SENTINEL_SWAP_FROM_BLOCK ?? '42506026');
const requestedToBlock = process.env.SENTINEL_SWAP_TO_BLOCK;
const INITIAL_CHUNK = Number(process.env.SENTINEL_LOG_CHUNK ?? '100000');
const MIN_CHUNK = 1000;
const OUTPUT_DIR = process.env.SENTINEL_SWAP_OUTPUT_DIR ?? 'release-evidence/sentinel-mainnet/swaps-decoded';

if (!Number.isSafeInteger(FROM_BLOCK) || FROM_BLOCK < 0) throw new Error('Invalid SENTINEL_SWAP_FROM_BLOCK');
if (!Number.isSafeInteger(INITIAL_CHUNK) || INITIAL_CHUNK < MIN_CHUNK) throw new Error('Invalid SENTINEL_LOG_CHUNK');

const provider = new JsonRpcProvider(RPC_URL, 8453, { staticNetwork: true });
const iface = new Interface([
  'event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)',
]);
const swapEvent = iface.getEvent('Swap');
const topic0 = swapEvent.topicHash;
const toBlock = requestedToBlock ? Number(requestedToBlock) : await provider.getBlockNumber();
if (!Number.isSafeInteger(toBlock) || toBlock < FROM_BLOCK) throw new Error('Invalid SENTINEL_SWAP_TO_BLOCK');

async function fetchLogsAdaptive(fromBlock, endBlock) {
  const all = [];
  let cursor = fromBlock;
  let chunk = INITIAL_CHUNK;
  while (cursor <= endBlock) {
    const upper = Math.min(endBlock, cursor + chunk - 1);
    try {
      const logs = await provider.getLogs({
        address: POOL_MANAGER,
        fromBlock: cursor,
        toBlock: upper,
        topics: [topic0, POOL_ID],
      });
      all.push(...logs);
      cursor = upper + 1;
      if (chunk < INITIAL_CHUNK) chunk = Math.min(INITIAL_CHUNK, chunk * 2);
    } catch (error) {
      if (chunk <= MIN_CHUNK) {
        throw new Error(`eth_getLogs failed for ${cursor}-${upper}: ${error instanceof Error ? error.message : String(error)}`);
      }
      chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
    }
  }
  return all;
}

const logs = await fetchLogsAdaptive(FROM_BLOCK, toBlock);
logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

const transactionCache = new Map();
async function getTransaction(hash) {
  if (!transactionCache.has(hash)) transactionCache.set(hash, provider.getTransaction(hash));
  return transactionCache.get(hash);
}

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
  const tx = await getTransaction(log.transactionHash);
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
console.log(JSON.stringify({ outputDir: OUTPUT_DIR, swapLogCount: decoded.length, buys, sells, uniqueSenders }, null, 2));
await provider.destroy();
