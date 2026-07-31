#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AbiCoder, Interface, JsonRpcProvider, getAddress, keccak256 } from 'ethers';

const manifestPath =
  process.env.SENTINEL_REDEPLOYMENT_MANIFEST ??
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const outputPath =
  process.env.SENTINEL_BASE_SEPOLIA_REHEARSAL_OUTPUT ??
  'release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json';
const rpcUrls = (process.env.BASE_SEPOLIA_RPC_URLS ?? [
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
  'https://base-sepolia.drpc.org',
].join(','))
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const manifestText = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(manifestText);
if (manifest.status !== 'preparation-only' || manifest.safety?.baseMainnetAuthorized !== false) {
  throw new Error('Manifest must remain preparation-only and explicitly unauthorized for Base Mainnet');
}
if (manifest.rehearsal?.mode !== 'simulation-only') {
  throw new Error('This workflow accepts simulation-only rehearsal manifests');
}

const network = manifest.networks.baseSepolia;
const token = manifest.token;
const pool = manifest.pool;
const execution = manifest.execution;
const coder = AbiCoder.defaultAbiCoder();
const airlock = new Interface([
  'function create((uint256 initialSupply,uint256 numTokensToSell,address numeraire,address tokenFactory,bytes tokenFactoryData,address governanceFactory,bytes governanceFactoryData,address poolInitializer,bytes poolInitializerData,address liquidityMigrator,bytes liquidityMigratorData,address integrator,bytes32 salt) createData) returns (address asset,address pool,address governance,address timelock,address migrationPool)',
  'function getModuleState(address module) view returns (uint8)',
  'error WrongModuleState(address module,uint8 expected,uint8 actual)',
]);

const tokenFactoryData = coder.encode(manifest.abi.tokenFactoryDataTypes, [
  token.name,
  token.symbol,
  token.yearlyMintRate,
  token.vestingDuration,
  token.vestingRecipients,
  token.vestingAmounts,
  token.tokenURI,
]);
const poolInitializerData = coder.encode([manifest.abi.poolInitializerDataType], [[
  pool.startFee,
  pool.fee,
  pool.durationSeconds,
  pool.tickSpacing,
  pool.curves.map(curve => [
    curve.tickLower,
    curve.tickUpper,
    curve.numPositions,
    curve.shares,
  ]),
  pool.beneficiaries.map(item => [item.beneficiary, item.shares]),
  pool.startingTime,
]]);
const createData = [
  token.initialSupply,
  token.numTokensToSell,
  network.weth,
  network.tokenFactory,
  tokenFactoryData,
  network.governanceFactory,
  execution.governanceFactoryData,
  network.poolInitializer,
  poolInitializerData,
  network.liquidityMigrator,
  execution.liquidityMigratorData,
  execution.integrator,
  execution.salt,
];
const calldata = airlock.encodeFunctionData('create', [createData]);
const transaction = {
  from: getAddress(manifest.rehearsal.simulationFrom),
  to: getAddress(network.airlock),
  value: execution.valueWei,
  data: calldata,
};

async function runSimulation(rpcUrl) {
  const provider = new JsonRpcProvider(rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const actualNetwork = await provider.getNetwork();
    if (Number(actualNetwork.chainId) !== network.chainId) {
      throw new Error(`expected chain ${network.chainId}, received ${actualNetwork.chainId}`);
    }
    const latest = await provider.getBlock('latest');
    if (!latest) throw new Error('latest block is unavailable');

    const moduleAddresses = {
      airlock: network.airlock,
      tokenFactory: network.tokenFactory,
      governanceFactory: network.governanceFactory,
      poolInitializer: network.poolInitializer,
      liquidityMigrator: network.liquidityMigrator,
      poolManager: network.poolManager,
      weth: network.weth,
      hook: network.hook,
    };
    const moduleEntries = await Promise.all(Object.entries(moduleAddresses).map(async ([name, address]) => {
      const code = await provider.getCode(address, latest.number);
      if (code === '0x') throw new Error(`${name} has no code at ${address}`);
      return [name, {
        address: getAddress(address),
        runtimeCodeHash: keccak256(code),
        runtimeCodeBytes: (code.length - 2) / 2,
      }];
    }));

    const requiredModuleStates = {
      tokenFactory: 1,
      governanceFactory: 2,
      poolInitializer: 3,
      liquidityMigrator: 4,
    };
    const registeredModuleStates = Object.fromEntries(await Promise.all(
      Object.entries(requiredModuleStates).map(async ([name, expected]) => {
        const data = airlock.encodeFunctionData('getModuleState', [network[name]]);
        const response = await provider.call({ to: network.airlock, data }, latest.number);
        const actual = Number(airlock.decodeFunctionResult('getModuleState', response)[0]);
        return [name, { expected, actual }];
      }),
    ));
    const stateMismatches = Object.entries(registeredModuleStates)
      .filter(([, state]) => state.actual !== state.expected)
      .map(([name, state]) => `${name}=${state.actual} (expected ${state.expected})`);
    if (stateMismatches.length) {
      throw new Error(`Airlock module registry mismatch: ${stateMismatches.join(', ')}`);
    }

    const returnData = await provider.call(transaction, latest.number);
    const decoded = airlock.decodeFunctionResult('create', returnData);
    const estimatedGas = await provider.estimateGas(transaction);
    const asset = getAddress(decoded.asset);
    const [currency0, currency1] =
      BigInt(network.weth) < BigInt(asset)
        ? [getAddress(network.weth), asset]
        : [asset, getAddress(network.weth)];
    const poolId = keccak256(coder.encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [currency0, currency1, pool.dynamicFeeFlag, pool.tickSpacing, network.hook],
    ));

    return {
      provider,
      result: {
        schemaVersion: 1,
        mode: 'simulation-only',
        chainId: network.chainId,
        rpcUrl,
        blockNumber: latest.number,
        blockHash: latest.hash,
        manifest: {
          path: manifestPath,
          sha256: createHash('sha256').update(manifestText).digest('hex'),
          sourcePreparationBaseCommit: manifest.sourcePins.projectPreparationBaseCommit,
        },
        airlockCall: {
          from: transaction.from,
          to: transaction.to,
          valueWei: String(transaction.value),
          calldata,
          calldataHash: keccak256(calldata),
          estimatedGas: estimatedGas.toString(),
        },
        encodedInputs: {
          tokenFactoryData,
          tokenFactoryDataHash: keccak256(tokenFactoryData),
          poolInitializerData,
          poolInitializerDataHash: keccak256(poolInitializerData),
          salt: execution.salt,
        },
        predicted: {
          token: asset,
          pool: getAddress(decoded.pool),
          governance: getAddress(decoded.governance),
          timelock: getAddress(decoded.timelock),
          migrationPool: getAddress(decoded.migrationPool),
          poolKey: {
            currency0,
            currency1,
            fee: pool.dynamicFeeFlag,
            tickSpacing: pool.tickSpacing,
            hooks: getAddress(network.hook),
          },
          poolId,
        },
        moduleRuntime: Object.fromEntries(moduleEntries),
        registeredModuleStates,
        safety: {
          signatureProduced: false,
          transactionBroadcast: false,
          baseMainnetAuthorized: false,
          note: 'eth_call and eth_estimateGas only; no private key or wallet was used.',
        },
      },
    };
  } catch (error) {
    provider.destroy();
    throw error;
  }
}

const errors = [];
let completed;
for (const rpcUrl of rpcUrls) {
  try {
    completed = await runSimulation(rpcUrl);
    break;
  } catch (error) {
    const revertData = error.data ?? error.info?.error?.data ?? error.error?.data;
    errors.push(
      `${rpcUrl}: ${error.shortMessage ?? error.message}${revertData ? ` [data=${JSON.stringify(revertData)}]` : ''}`,
    );
  }
}
if (!completed) {
  throw new Error(`Base Sepolia simulation failed on every configured RPC:\n${errors.join('\n')}`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(completed.result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(completed.result, null, 2));
completed.provider.destroy();
