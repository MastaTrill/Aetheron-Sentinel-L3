#!/usr/bin/env node
import { Interface, JsonRpcProvider, getAddress } from 'ethers';

const CHAIN_ID = 8453;
const INITIALIZER = getAddress('0xD59cE43E53D69F190E15d9822Fb4540dCcc91178');
const POOL_ID = '0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d';
const CURRENT_BENEFICIARY = getAddress('0x7e3D11f70084D667295710E6b7FF50C3b0487a45');
const INTENDED_TREASURY = getAddress('0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa');
const EXPECTED_CREATOR_SHARES = 570000000000000000n;
const WAD = 1000000000000000000n;

const rpcUrls = (process.env.BASE_RPC_URLS ??
  'https://mainnet.base.org,https://base-rpc.publicnode.com')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (rpcUrls.length < 2) {
  throw new Error('BASE_RPC_URLS must contain at least two independent Base RPC endpoints');
}

const initializer = new Interface([
  'function collectFees(bytes32 poolId) returns (uint128 fees0, uint128 fees1)',
  'function updateBeneficiary(bytes32 poolId,address newBeneficiary)',
  'function getShares(bytes32 poolId,address beneficiary) view returns (uint256)',
  'function getCumulatedFees0(bytes32 poolId) view returns (uint256)',
  'function getCumulatedFees1(bytes32 poolId) view returns (uint256)',
  'function getLastCumulatedFees0(bytes32 poolId,address beneficiary) view returns (uint256)',
  'function getLastCumulatedFees1(bytes32 poolId,address beneficiary) view returns (uint256)',
]);

const providers = rpcUrls.map(
  (url) => new JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true }),
);

const collectFeesData = initializer.encodeFunctionData('collectFees', [POOL_ID]);
const updateBeneficiaryData = initializer.encodeFunctionData('updateBeneficiary', [
  POOL_ID,
  INTENDED_TREASURY,
]);

function serialize(value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function read(provider, functionName, args, blockTag) {
  const data = initializer.encodeFunctionData(functionName, args);
  const raw = await provider.call({ to: INITIALIZER, data }, blockTag);
  return initializer.decodeFunctionResult(functionName, raw);
}

async function inspectProvider(provider, url, blockTag) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`${url} returned chain ID ${network.chainId}, expected ${CHAIN_ID}`);
  }

  const block = await provider.getBlock(blockTag);
  if (!block) throw new Error(`${url} could not read pinned block ${blockTag}`);

  const [currentShares] = await read(
    provider,
    'getShares',
    [POOL_ID, CURRENT_BENEFICIARY],
    blockTag,
  );
  const [targetShares] = await read(
    provider,
    'getShares',
    [POOL_ID, INTENDED_TREASURY],
    blockTag,
  );
  const [cumulatedFees0] = await read(provider, 'getCumulatedFees0', [POOL_ID], blockTag);
  const [cumulatedFees1] = await read(provider, 'getCumulatedFees1', [POOL_ID], blockTag);
  const [lastCumulatedFees0] = await read(
    provider,
    'getLastCumulatedFees0',
    [POOL_ID, CURRENT_BENEFICIARY],
    blockTag,
  );
  const [lastCumulatedFees1] = await read(
    provider,
    'getLastCumulatedFees1',
    [POOL_ID, CURRENT_BENEFICIARY],
    blockTag,
  );

  const pendingHeldFees0 =
    ((cumulatedFees0 - lastCumulatedFees0) * currentShares) / WAD;
  const pendingHeldFees1 =
    ((cumulatedFees1 - lastCumulatedFees1) * currentShares) / WAD;

  let collectSimulation;
  try {
    const raw = await provider.call(
      {
        to: INITIALIZER,
        from: CURRENT_BENEFICIARY,
        data: collectFeesData,
      },
      blockTag,
    );
    const [newlyCollectedFees0, newlyCollectedFees1] =
      initializer.decodeFunctionResult('collectFees', raw);
    collectSimulation = {
      success: true,
      newlyCollectedFees0,
      newlyCollectedFees1,
    };
  } catch (error) {
    collectSimulation = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let updateSimulation;
  try {
    await provider.call(
      {
        to: INITIALIZER,
        from: CURRENT_BENEFICIARY,
        data: updateBeneficiaryData,
      },
      blockTag,
    );
    updateSimulation = { success: true };
  } catch (error) {
    updateSimulation = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    rpcUrl: url,
    blockNumber: block.number,
    blockHash: block.hash,
    blockTimestamp: block.timestamp,
    currentShares,
    targetShares,
    cumulatedFees0,
    cumulatedFees1,
    lastCumulatedFees0,
    lastCumulatedFees1,
    pendingHeldFees0,
    pendingHeldFees1,
    collectSimulation,
    updateSimulation,
  };
}

try {
  const latestBlocks = await Promise.all(providers.map((provider) => provider.getBlockNumber()));
  const pinnedBlock = Math.min(...latestBlocks);
  const observations = await Promise.all(
    providers.map((provider, index) => inspectProvider(provider, rpcUrls[index], pinnedBlock)),
  );

  const first = observations[0];
  const consistent = observations.every(
    (observation) =>
      observation.blockHash === first.blockHash &&
      observation.currentShares === first.currentShares &&
      observation.targetShares === first.targetShares &&
      observation.cumulatedFees0 === first.cumulatedFees0 &&
      observation.cumulatedFees1 === first.cumulatedFees1 &&
      observation.lastCumulatedFees0 === first.lastCumulatedFees0 &&
      observation.lastCumulatedFees1 === first.lastCumulatedFees1 &&
      observation.collectSimulation.success === first.collectSimulation.success &&
      observation.updateSimulation.success === first.updateSimulation.success,
  );

  const checks = {
    twoRpcAgreement: consistent,
    currentShareIsExactly57Percent: first.currentShares === EXPECTED_CREATOR_SHARES,
    intendedTreasuryHasNoExistingShare: first.targetShares === 0n,
    collectFeesSimulationSucceeds: first.collectSimulation.success,
    updateBeneficiarySimulationSucceeds: first.updateSimulation.success,
  };
  const readyForExplicitAuthorization = Object.values(checks).every(Boolean);

  const output = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    network: { name: 'Base Mainnet', chainId: CHAIN_ID },
    initializer: INITIALIZER,
    poolId: POOL_ID,
    currentBeneficiary: CURRENT_BENEFICIARY,
    intendedTreasury: INTENDED_TREASURY,
    pinnedBlock,
    checks,
    status: readyForExplicitAuthorization
      ? 'READY_FOR_EXPLICIT_AUTHORIZATION'
      : 'BLOCKED',
    requiredExecutionOrder: [
      'Obtain cryptographic proof that the operator controls the current beneficiary.',
      'Explicitly authorize exact gas and spending limits for both calls.',
      'Call collectFees(poolId) from the current beneficiary to establish a fee cutoff.',
      'After the collection confirms, call updateBeneficiary(poolId,intendedTreasury) from the same beneficiary.',
      'Verify the new 57% share through two independent RPC providers and preserve both receipts.',
    ],
    unsignedTransactions: {
      collectFees: {
        chainId: CHAIN_ID,
        from: CURRENT_BENEFICIARY,
        to: INITIALIZER,
        value: '0',
        data: collectFeesData,
        authorized: false,
      },
      updateBeneficiary: {
        chainId: CHAIN_ID,
        from: CURRENT_BENEFICIARY,
        to: INITIALIZER,
        value: '0',
        data: updateBeneficiaryData,
        authorized: false,
      },
    },
    observations,
    safetyNotice:
      'This output is read-only and unsigned. It does not prove wallet control and does not authorize signing or broadcasting.',
  };

  console.log(JSON.stringify(output, serialize, 2));
  if (!readyForExplicitAuthorization) process.exitCode = 1;
} finally {
  await Promise.all(providers.map((provider) => provider.destroy()));
}
