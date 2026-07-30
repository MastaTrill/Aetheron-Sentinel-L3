#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AbiCoder, Interface, JsonRpcProvider, getAddress, keccak256 } from 'ethers';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com';
const OUTPUT_PATH =
  process.env.SENTINEL_LEGACY_RECONSTRUCTION_OUTPUT ??
  'release-evidence/sentinel-mainnet/redeployment/legacy-launch-inputs.json';
const FROM_BLOCK = Number(process.env.SENTINEL_CREATE_FROM_BLOCK ?? '42400000');
const TO_BLOCK = Number(process.env.SENTINEL_CREATE_TO_BLOCK ?? '42600000');
const LOG_CHUNK = Number(process.env.SENTINEL_CREATE_LOG_CHUNK ?? '5000');

const AIRLOCK = getAddress('0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12');
const LEGACY_TOKEN = getAddress('0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3');

const airlock = new Interface([
  'event Create(address asset,address indexed numeraire,address initializer,address poolOrHook)',
  'function create((uint256 initialSupply,uint256 numTokensToSell,address numeraire,address tokenFactory,bytes tokenFactoryData,address governanceFactory,bytes governanceFactoryData,address poolInitializer,bytes poolInitializerData,address liquidityMigrator,bytes liquidityMigratorData,address integrator,bytes32 salt) createData) returns (address asset,address pool,address governance,address timelock,address migrationPool)',
]);
const coder = AbiCoder.defaultAbiCoder();
const provider = new JsonRpcProvider(RPC_URL, 8453, { staticNetwork: true });

function jsonValue(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/^\d+$/.test(key))
        .map(([key, item]) => [key, jsonValue(item)]),
    );
  }
  return value;
}

async function findCreateLog() {
  const topic = airlock.getEvent('Create').topicHash;
  for (let start = FROM_BLOCK; start <= TO_BLOCK; start += LOG_CHUNK) {
    const end = Math.min(start + LOG_CHUNK - 1, TO_BLOCK);
    const logs = await provider.getLogs({ address: AIRLOCK, topics: [topic], fromBlock: start, toBlock: end });
    for (const log of logs) {
      const parsed = airlock.parseLog(log);
      if (getAddress(parsed.args.asset) === LEGACY_TOKEN) return { log, parsed };
    }
    console.error(`scanned Base blocks ${start}-${end}`);
  }
  throw new Error(`Legacy SENTINEL Create event not found in blocks ${FROM_BLOCK}-${TO_BLOCK}`);
}

const network = await provider.getNetwork();
if (network.chainId !== 8453n) throw new Error(`Expected Base chain 8453, received ${network.chainId}`);

const { log, parsed } = await findCreateLog();
const transaction = await provider.getTransaction(log.transactionHash);
if (!transaction) throw new Error(`Missing transaction ${log.transactionHash}`);
if (getAddress(transaction.to) !== AIRLOCK) throw new Error('Creation transaction target is not the canonical Airlock');

const decodedCall = airlock.parseTransaction({ data: transaction.data, value: transaction.value });
if (!decodedCall || decodedCall.name !== 'create') throw new Error('Unable to decode Airlock.create calldata');
const createData = decodedCall.args.createData;

const [name, symbol, yearlyMintRate, vestingDuration, vestingRecipients, vestingAmounts, tokenURI] =
  coder.decode(
    ['string', 'string', 'uint256', 'uint256', 'address[]', 'uint256[]', 'string'],
    createData.tokenFactoryData,
  );

const [pool] = coder.decode(
  [
    'tuple(uint24 startFee,uint24 fee,uint32 durationSeconds,int24 tickSpacing,tuple(int24 tickLower,int24 tickUpper,uint16 numPositions,uint256 shares)[] curves,tuple(address beneficiary,uint96 shares)[] beneficiaries,uint32 startingTime)',
  ],
  createData.poolInitializerData,
);

const result = {
  schemaVersion: 1,
  purpose: 'read-only reconstruction of the legacy non-canonical launch input',
  chainId: Number(network.chainId),
  blockNumber: log.blockNumber,
  transactionHash: log.transactionHash,
  transactionFrom: getAddress(transaction.from),
  airlock: AIRLOCK,
  createEvent: {
    asset: getAddress(parsed.args.asset),
    numeraire: getAddress(parsed.args.numeraire),
    initializer: getAddress(parsed.args.initializer),
    poolOrHook: getAddress(parsed.args.poolOrHook),
  },
  createData: jsonValue(createData),
  decodedTokenFactoryData: jsonValue({
    name,
    symbol,
    yearlyMintRate,
    vestingDuration,
    vestingRecipients,
    vestingAmounts,
    tokenURI,
  }),
  decodedDecayPoolInitializerData: jsonValue(pool),
  calldataHash: keccak256(transaction.data),
  notice: 'No transaction was signed or broadcast. This file reconstructs historical legacy calldata only.',
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));

