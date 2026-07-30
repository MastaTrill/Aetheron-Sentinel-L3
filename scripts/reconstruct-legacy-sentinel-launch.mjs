#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AbiCoder, Interface, JsonRpcProvider, getAddress, keccak256 } from 'ethers';

const RPC_URLS = (process.env.BASE_RPC_URLS ?? process.env.BASE_RPC_URL ?? [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.drpc.org',
  'https://1rpc.io/base',
  'https://base-rpc.publicnode.com',
].join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const BLOCKSCOUT_ADDRESS_API =
  process.env.BASE_BLOCKSCOUT_ADDRESS_API ?? 'https://base.blockscout.com/api/v2/addresses';
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

async function getExplorerCreationTransactionHash() {
  const response = await fetch(`${BLOCKSCOUT_ADDRESS_API}/${LEGACY_TOKEN}`);
  if (!response.ok) throw new Error(`Blockscout address lookup returned HTTP ${response.status}`);
  const address = await response.json();
  const transactionHash = address.creation_tx_hash ?? address.creation_transaction_hash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash ?? '')) {
    throw new Error('Blockscout did not return a creation transaction hash');
  }
  return transactionHash;
}

async function findCreateLog(provider) {
  const topic = airlock.getEvent('Create').topicHash;

  try {
    const transactionHash = await getExplorerCreationTransactionHash();
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) throw new Error(`Missing receipt ${transactionHash}`);
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== AIRLOCK || log.topics[0] !== topic) continue;
      const parsed = airlock.parseLog(log);
      if (getAddress(parsed.args.asset) === LEGACY_TOKEN) return { log, parsed };
    }
    throw new Error(`Creation receipt ${transactionHash} lacks the canonical Airlock Create event`);
  } catch (error) {
    console.error(`explorer-assisted lookup unavailable: ${error.message}`);
  }

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

async function selectProvider() {
  const errors = [];
  for (const rpcUrl of RPC_URLS) {
    const candidate = new JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    try {
      const network = await candidate.getNetwork();
      if (network.chainId !== 8453n) throw new Error(`unexpected chain ${network.chainId}`);
      const found = await findCreateLog(candidate);
      return { provider: candidate, network, ...found };
    } catch (error) {
      errors.push(`${rpcUrl}: ${error.message}`);
      candidate.destroy();
    }
  }
  throw new Error(`No configured Base RPC could reconstruct the launch:\n${errors.join('\n')}`);
}

const { provider, network, log, parsed } = await selectProvider();
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
  createData: jsonValue({
    initialSupply: createData.initialSupply,
    numTokensToSell: createData.numTokensToSell,
    numeraire: createData.numeraire,
    tokenFactory: createData.tokenFactory,
    tokenFactoryData: createData.tokenFactoryData,
    governanceFactory: createData.governanceFactory,
    governanceFactoryData: createData.governanceFactoryData,
    poolInitializer: createData.poolInitializer,
    poolInitializerData: createData.poolInitializerData,
    liquidityMigrator: createData.liquidityMigrator,
    liquidityMigratorData: createData.liquidityMigratorData,
    integrator: createData.integrator,
    salt: createData.salt,
  }),
  decodedTokenFactoryData: jsonValue({
    name,
    symbol,
    yearlyMintRate,
    vestingDuration,
    vestingRecipients,
    vestingAmounts,
    tokenURI,
  }),
  decodedDecayPoolInitializerData: jsonValue({
    startFee: pool.startFee,
    fee: pool.fee,
    durationSeconds: pool.durationSeconds,
    tickSpacing: pool.tickSpacing,
    curves: pool.curves.map((curve) => ({
      tickLower: curve.tickLower,
      tickUpper: curve.tickUpper,
      numPositions: curve.numPositions,
      shares: curve.shares,
    })),
    beneficiaries: pool.beneficiaries.map((beneficiary) => ({
      beneficiary: beneficiary.beneficiary,
      shares: beneficiary.shares,
    })),
    startingTime: pool.startingTime,
  }),
  calldataHash: keccak256(transaction.data),
  notice: 'No transaction was signed or broadcast. This file reconstructs historical legacy calldata only.',
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
provider.destroy();
