#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  AbiCoder,
  Interface,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isAddress,
  keccak256,
} from 'ethers';

const manifestPath =
  process.env.SENTINEL_REDEPLOYMENT_MANIFEST ??
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const requestPath =
  process.env.SENTINEL_BASE_SEPOLIA_REHEARSAL_REQUEST ??
  'release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal-request.json';
const outputPath =
  process.env.SENTINEL_BASE_SEPOLIA_REHEARSAL_OUTPUT ??
  '/tmp/sentinel-redeployment/base-sepolia-rehearsal.json';
const rpcUrl = process.env.BASE_TESTNET_RPC_URL;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

if (!rpcUrl) throw new Error('BASE_TESTNET_RPC_URL is required from the protected environment');
if (!/^0x[0-9a-f]{64}$/i.test(privateKey ?? '')) {
  throw new Error('DEPLOYER_PRIVATE_KEY is missing or malformed in the protected environment');
}

const [manifestText, requestText] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(requestPath, 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const request = JSON.parse(requestText);
const manifestSha256 = createHash('sha256').update(manifestText).digest('hex');

if (request.schemaVersion !== 1) throw new Error('Rehearsal request schemaVersion must be 1');
if (request.confirmation !== 'EXECUTE_SENTINEL_BASE_SEPOLIA_REHEARSAL') {
  throw new Error('Rehearsal request confirmation is invalid');
}
if (request.chainId !== 84532 || request.baseMainnetAuthorized !== false) {
  throw new Error('Rehearsal request must be Base Sepolia only and deny Base Mainnet');
}
if (typeof request.expiresAt !== 'string') {
  throw new Error('Rehearsal request expiresAt must be an ISO-8601 string');
}
const expiresAtMs = Date.parse(request.expiresAt);
if (!Number.isFinite(expiresAtMs)) throw new Error('Rehearsal request expiresAt is malformed');
if (expiresAtMs <= Date.now()) throw new Error('Rehearsal request has expired');
if (!/^0x[0-9a-f]{64}$/i.test(request.expectedCalldataHash ?? '')) {
  throw new Error('Rehearsal request expectedCalldataHash is malformed');
}
if (!/^0x[0-9a-f]{64}$/i.test(request.expectedPoolId ?? '')) {
  throw new Error('Rehearsal request expectedPoolId is malformed');
}
const expectedCalldataHash = request.expectedCalldataHash.toLowerCase();
const expectedPoolId = request.expectedPoolId.toLowerCase();
if (!isAddress(request.expectedPredictedToken)) {
  throw new Error('Rehearsal request expectedPredictedToken is malformed');
}
if (request.manifestSha256 !== manifestSha256) throw new Error('Rehearsal request manifest digest mismatch');
if (manifest.status !== 'preparation-only' || manifest.safety?.baseMainnetAuthorized !== false) {
  throw new Error('Manifest must remain preparation-only and unauthorized for Base Mainnet');
}

const network = manifest.networks.baseSepolia;
const token = manifest.token;
const pool = manifest.pool;
const execution = manifest.execution;
const beneficiaries = manifest.rehearsal.beneficiaries;
const manifestAddresses = {
  airlock: network.airlock,
  weth: network.weth,
  tokenFactory: network.tokenFactory,
  governanceFactory: network.governanceFactory,
  poolInitializer: network.poolInitializer,
  liquidityMigrator: network.liquidityMigrator,
  hook: network.hook,
  integrator: execution.integrator,
};
for (const [name, address] of Object.entries(manifestAddresses)) {
  if (!isAddress(address)) throw new Error(`Manifest ${name} is not a valid Ethereum address`);
  manifestAddresses[name] = getAddress(address);
}
if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
  throw new Error('Manifest rehearsal beneficiaries must be a non-empty array');
}
const normalizedBeneficiaries = beneficiaries.map((item, index) => {
  if (!isAddress(item?.beneficiary)) {
    throw new Error(`Manifest beneficiary ${index} is not a valid Ethereum address`);
  }
  if (typeof item?.shares !== 'string' || !/^(0|[1-9]\d*)$/.test(item.shares)) {
    throw new Error(`Manifest beneficiary ${index} shares must be a canonical decimal string`);
  }
  return {
    ...item,
    beneficiary: getAddress(item.beneficiary),
    shares: BigInt(item.shares).toString(),
  };
});
for (const [index, recipient] of (token.vestingRecipients ?? []).entries()) {
  if (!isAddress(recipient)) throw new Error(`Manifest vesting recipient ${index} is malformed`);
}
if (!/^0x[0-9a-f]{64}$/i.test(execution.salt ?? '')) {
  throw new Error('Manifest execution salt is malformed');
}
const coder = AbiCoder.defaultAbiCoder();
const airlock = new Interface([
  'event Create(address asset,address indexed numeraire,address initializer,address poolOrHook)',
  'function create((uint256 initialSupply,uint256 numTokensToSell,address numeraire,address tokenFactory,bytes tokenFactoryData,address governanceFactory,bytes governanceFactoryData,address poolInitializer,bytes poolInitializerData,address liquidityMigrator,bytes liquidityMigratorData,address integrator,bytes32 salt) createData) returns (address asset,address pool,address governance,address timelock,address migrationPool)',
  'function getModuleState(address module) view returns (uint8)',
]);
const erc20 = new Interface([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
]);
const initializer = new Interface([
  'function getShares(bytes32 poolId,address beneficiary) view returns (uint256)',
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
  normalizedBeneficiaries.map(item => [item.beneficiary, item.shares]),
  pool.startingTime,
]]);
const createData = [
  token.initialSupply,
  token.numTokensToSell,
  manifestAddresses.weth,
  manifestAddresses.tokenFactory,
  tokenFactoryData,
  manifestAddresses.governanceFactory,
  execution.governanceFactoryData,
  manifestAddresses.poolInitializer,
  poolInitializerData,
  manifestAddresses.liquidityMigrator,
  execution.liquidityMigratorData,
  manifestAddresses.integrator,
  execution.salt,
];
const calldata = airlock.encodeFunctionData('create', [createData]);
const calldataHash = keccak256(calldata);
if (calldataHash !== expectedCalldataHash) throw new Error('Rehearsal calldata hash mismatch');

const provider = new JsonRpcProvider(rpcUrl, network.chainId, { staticNetwork: true });
const signer = new Wallet(privateKey, provider);
const signerAddress = getAddress(await signer.getAddress());
const actualNetwork = await provider.getNetwork();
if (Number(actualNetwork.chainId) !== network.chainId) {
  throw new Error(`Expected Base Sepolia ${network.chainId}, received ${actualNetwork.chainId}`);
}

const unsignedTransaction = {
  from: signerAddress,
  to: manifestAddresses.airlock,
  value: 0n,
  data: calldata,
};
const simulatedReturn = await provider.call(unsignedTransaction);
const predicted = airlock.decodeFunctionResult('create', simulatedReturn);
const predictedToken = getAddress(predicted.asset);
const [currency0, currency1] =
  BigInt(manifestAddresses.weth) < BigInt(predictedToken)
    ? [manifestAddresses.weth, predictedToken]
    : [predictedToken, manifestAddresses.weth];
const poolId = keccak256(coder.encode(
  ['address', 'address', 'uint24', 'int24', 'address'],
  [currency0, currency1, pool.dynamicFeeFlag, pool.tickSpacing, manifestAddresses.hook],
));
if (predictedToken !== getAddress(request.expectedPredictedToken)) {
  throw new Error(`Predicted token mismatch: ${predictedToken}`);
}
if (poolId !== expectedPoolId) throw new Error(`Predicted pool ID mismatch: ${poolId}`);

const estimatedGas = await provider.estimateGas(unsignedTransaction);
const feeData = await provider.getFeeData();
const maximumFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
if (!maximumFeePerGas) throw new Error('Unable to determine Base Sepolia gas price');
const balanceBefore = await provider.getBalance(signerAddress);
const requiredBalance = estimatedGas * maximumFeePerGas * 2n;
if (balanceBefore < requiredBalance) {
  throw new Error(
    `Protected signer balance is below the 2x gas reserve; required ${requiredBalance}, available ${balanceBefore}`,
  );
}

const baseEvidence = {
  schemaVersion: 1,
  mode: 'protected-testnet-broadcast',
  chainId: network.chainId,
  manifest: {
    path: manifestPath,
    sha256: manifestSha256,
  },
  request: {
    path: requestPath,
    sha256: createHash('sha256').update(requestText).digest('hex'),
    sourceCommit: request.sourceCommit,
    expiresAt: request.expiresAt,
  },
  signer: signerAddress,
  airlockCall: {
    to: unsignedTransaction.to,
    valueWei: '0',
    calldataHash,
    estimatedGas: estimatedGas.toString(),
  },
  predicted: {
    token: predictedToken,
    pool: getAddress(predicted.pool),
    governance: getAddress(predicted.governance),
    timelock: getAddress(predicted.timelock),
    migrationPool: getAddress(predicted.migrationPool),
    poolId,
  },
  safety: {
    baseMainnetAuthorized: false,
    mainnetTransactionProduced: false,
    privateKeyRecorded: false,
  },
};

async function writeEvidence(evidence) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

await writeEvidence({ ...baseEvidence, status: 'prepared', balanceBeforeWei: balanceBefore.toString() });

const submitted = await signer.sendTransaction({
  to: unsignedTransaction.to,
  value: 0n,
  data: calldata,
  gasLimit: estimatedGas * 120n / 100n,
});
console.log(`Base Sepolia rehearsal transaction submitted: ${submitted.hash}`);
await writeEvidence({
  ...baseEvidence,
  status: 'broadcast',
  transactionHash: submitted.hash,
  balanceBeforeWei: balanceBefore.toString(),
});

const receipt = await submitted.wait(2);
if (!receipt || receipt.status !== 1) throw new Error(`Rehearsal transaction failed: ${submitted.hash}`);
let createEvent;
for (const log of receipt.logs) {
  if (getAddress(log.address) !== getAddress(network.airlock)) continue;
  try {
    const parsed = airlock.parseLog(log);
    if (parsed?.name === 'Create') {
      createEvent = {
        token: getAddress(parsed.args.asset),
        numeraire: getAddress(parsed.args.numeraire),
        initializer: getAddress(parsed.args.initializer),
        poolOrHook: getAddress(parsed.args.poolOrHook),
        logIndex: log.index,
      };
      break;
    }
  } catch {
    // Ignore unrelated Airlock logs.
  }
}
if (!createEvent || createEvent.token !== predictedToken) {
  throw new Error('Confirmed receipt lacks the predicted Airlock Create event');
}

const tokenCode = await provider.getCode(predictedToken, receipt.blockNumber);
if (tokenCode === '0x') throw new Error('Confirmed token has no runtime bytecode');
async function tokenRead(functionName) {
  const data = erc20.encodeFunctionData(functionName);
  const response = await provider.call({ to: predictedToken, data }, receipt.blockNumber);
  return erc20.decodeFunctionResult(functionName, response)[0];
}
const [name, symbol, totalSupply, owner] = await Promise.all([
  tokenRead('name'),
  tokenRead('symbol'),
  tokenRead('totalSupply'),
  tokenRead('owner'),
]);
const beneficiaryShares = [];
for (const item of normalizedBeneficiaries) {
  const data = initializer.encodeFunctionData('getShares', [poolId, item.beneficiary]);
  const response = await provider.call({ to: manifestAddresses.poolInitializer, data }, receipt.blockNumber);
  const shares = initializer.decodeFunctionResult('getShares', response)[0].toString();
  if (shares !== item.shares) throw new Error(`Beneficiary share mismatch for ${item.beneficiary}`);
  beneficiaryShares.push({ ...item, verifiedShares: shares });
}

const balanceAfter = await provider.getBalance(signerAddress, receipt.blockNumber);
const finalEvidence = {
  ...baseEvidence,
  status: 'confirmed',
  transactionHash: receipt.hash,
  receipt: {
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    confirmations: 2,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    gasPriceWei: receipt.gasPrice.toString(),
    transactionIndex: receipt.index,
  },
  createEvent,
  tokenState: {
    address: predictedToken,
    name,
    symbol,
    totalSupply: totalSupply.toString(),
    owner: getAddress(owner),
    runtimeCodeHash: keccak256(tokenCode),
  },
  beneficiaryShares,
  balanceBeforeWei: balanceBefore.toString(),
  balanceAfterWei: balanceAfter.toString(),
};
await writeEvidence(finalEvidence);
console.log(JSON.stringify(finalEvidence, null, 2));
provider.destroy();
