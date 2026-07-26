#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Interface, JsonRpcProvider, getAddress } from 'ethers';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com';
const BUY_TX_HASH = process.env.SENTINEL_BUY_TX_HASH;
const SELL_TX_HASH = process.env.SENTINEL_SELL_TX_HASH;
const EXPECTED_WALLET = process.env.SENTINEL_SMOKE_TEST_WALLET ? getAddress(process.env.SENTINEL_SMOKE_TEST_WALLET) : null;
const POOL_MANAGER = getAddress(process.env.SENTINEL_POOL_MANAGER ?? '0x498581fF718922c3f8e6A244956aF099B2652b2b');
const POOL_ID = (process.env.SENTINEL_POOL_ID ?? '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d').toLowerCase();
const OUTPUT_DIR = process.env.SENTINEL_SMOKE_OUTPUT_DIR ?? 'release-evidence/sentinel-mainnet/smoke-test';

if (!BUY_TX_HASH || !SELL_TX_HASH) throw new Error('Set SENTINEL_BUY_TX_HASH and SENTINEL_SELL_TX_HASH. This verifier never signs or broadcasts transactions.');

const provider = new JsonRpcProvider(RPC_URL, 8453, { staticNetwork: true });
const iface = new Interface([
  'event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)',
]);

async function verify(hash, expectedDirection) {
  const [tx, receipt] = await Promise.all([provider.getTransaction(hash), provider.getTransactionReceipt(hash)]);
  if (!tx || !receipt) throw new Error(`Transaction not found: ${hash}`);
  if (receipt.status !== 1) throw new Error(`Transaction reverted: ${hash}`);
  if (EXPECTED_WALLET && getAddress(tx.from) !== EXPECTED_WALLET) throw new Error(`Unexpected signer for ${hash}: ${tx.from}`);

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

  return {
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
    signer: getAddress(tx.from),
    entrypoint: tx.to ? getAddress(tx.to) : null,
    inputSelector: tx.data.slice(0, 10),
    gasUsed: receipt.gasUsed.toString(),
    directions,
  };
}

const buy = await verify(BUY_TX_HASH, 'buy-sentinel-with-weth');
const sell = await verify(SELL_TX_HASH, 'sell-sentinel-for-weth');
const result = {
  schemaVersion: 1,
  verifiedAtUtc: new Date().toISOString(),
  chainId: 8453,
  poolManager: POOL_MANAGER,
  poolId: POOL_ID,
  expectedWallet: EXPECTED_WALLET,
  buy,
  sell,
  notice: 'Receipt verification only. The verifier never signs or broadcasts transactions.',
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(path.join(OUTPUT_DIR, 'smoke-test-receipts.json'), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(path.join(OUTPUT_DIR, 'README.md'), `# SENTINEL minimal buy/sell smoke-test evidence\n\n- Verified: ${result.verifiedAtUtc}\n- Buy transaction: \`${BUY_TX_HASH}\`\n- Sell transaction: \`${SELL_TX_HASH}\`\n- Pool ID: \`${POOL_ID}\`\n- Signer: \`${buy.signer}\`\n\nBoth receipts succeeded and emitted canonical-pool Swap events in the expected directions.\n`);
console.log(JSON.stringify(result, null, 2));
await provider.destroy();
