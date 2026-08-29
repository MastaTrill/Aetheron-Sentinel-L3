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
  verifyMessage,
} from 'ethers';

const manifestPath =
  process.env.SENTINEL_REDEPLOYMENT_MANIFEST ??
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const authorizationPath =
  process.env.SENTINEL_MAINNET_AUTHORIZATION ??
  'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';
const outputPath =
  process.env.SENTINEL_MAINNET_DEPLOYMENT_OUTPUT ??
  '/tmp/sentinel-redeployment/deployment-receipt.json';
const rpcUrl = process.env.BASE_MAINNET_RPC_URL;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const releaseCommit = process.env.SENTINEL_RELEASE_COMMIT;

if (!rpcUrl) throw new Error('BASE_MAINNET_RPC_URL is required from the protected environment');
if (!/^0x[0-9a-f]{64}$/i.test(privateKey ?? '')) {
  throw new Error('DEPLOYER_PRIVATE_KEY is missing or malformed in the protected environment');
}
if (!/^[0-9a-f]{40}$/i.test(releaseCommit ?? '')) {
  throw new Error('SENTINEL_RELEASE_COMMIT must be the exact reviewed 40-character release commit');
}

const [manifestText, authorizationText] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(authorizationPath, 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const authorization = JSON.parse(authorizationText);
const manifestSha256 = createHash('sha256').update(manifestText).digest('hex');

const lower = value => (typeof value === 'string' ? value.toLowerCase() : '');
const exactRiskStatement =
  'I accept the risk of proceeding without an independent security review for this exact commit and manifest.';

function authorizationMessage(evidence) {
  return [
    'AETHERON SENTINEL BASE MAINNET AUTHORIZATION',
    `chainId:${evidence.chainId}`,
    `manifestSha256:${lower(evidence.approvedManifest?.sha256)}`,
    `authorizedCommit:${lower(evidence.authorization?.authorizedCommit)}`,
    `authorizedSender:${lower(evidence.authorization?.authorizedSender)}`,
    `maxGasCostWei:${evidence.limitations?.maxGasCostWei}`,
    `expiresAt:${evidence.limitations?.expiresAt}`,
  ].join('\n');
}

if (authorization.schemaVersion !== 1 || authorization.status !== 'authorized') {
  throw new Error('Mainnet authorization evidence must be schemaVersion 1 and authorized');
}
if (
  authorization.confirmation !== 'AUTHORIZE_SENTINEL_BASE_MAINNET_BROADCAST' ||
  authorization.chainId !== 8453
) {
  throw new Error('Exact Base Mainnet broadcast authorization is required');
}
if (authorization.approvedManifest?.sha256 !== manifestSha256) {
  throw new Error('Authorization manifest digest does not match the exact deployment manifest');
}
if (lower(authorization.authorization?.authorizedCommit) !== lower(releaseCommit)) {
  throw new Error('Authorization commit does not match SENTINEL_RELEASE_COMMIT');
}
if (!isAddress(authorization.authorization?.authorizedSender)) {
  throw new Error('Authorization sender is malformed');
}
if (authorization.authorization?.method !== 'cryptographic-signature') {
  throw new Error('Authorization method must be cryptographic-signature');
}
if (!/^https:\/\//i.test(authorization.authorization?.reference ?? '')) {
  throw new Error('Authorization requires a public HTTPS reference');
}
if (!/^0x[0-9a-f]{130}$/i.test(authorization.authorization?.signature ?? '')) {
  throw new Error('Authorization signature must be a 65-byte EVM signature');
}
if (
  authorization.riskAcceptance?.proceedWithoutIndependentSecurityReview !== true ||
  authorization.riskAcceptance?.acceptedBy !== authorization.authorization?.authorizedSender ||
  authorization.riskAcceptance?.statement !== exactRiskStatement
) {
  throw new Error('Exact owner risk acceptance is required');
}
const expiresAtMs = Date.parse(authorization.limitations?.expiresAt ?? '');
if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
  throw new Error('Base Mainnet authorization is expired or malformed');
}
if (!/^(0|[1-9]\d*)$/.test(String(authorization.limitations?.maxGasCostWei ?? ''))) {
  throw new Error('Authorization maxGasCostWei must be a canonical decimal string');
}
const maxGasCostWei = BigInt(authorization.limitations.maxGasCostWei);
if (maxGasCostWei <= 0n) throw new Error('Authorization maxGasCostWei must be positive');

const recovered = getAddress(
  verifyMessage(authorizationMessage(authorization), authorization.authorization.signature),
);
const authorizedSender = getAddress(authorization.authorization.authorizedSender);
if (recovered !== authorizedSender) {
  throw new Error(`Authorization signature recovers ${recovered}, expected ${authorizedSender}`);
}

if (
  manifest.schemaVersion !== 1 ||
  manifest.releaseModel !== 'controlled-redeployment' ||
  manifest.status !== 'preparation-only'
) {
  throw new Error('Deployment manifest must remain the frozen controlled-redeployment preparation manifest');
}
if (
  manifest.safety?.signingEnabled !== false ||
  manifest.safety?.broadcastEnabled !== false ||
  manifest.safety?.baseMainnetAuthorized !== false ||
  manifest.safety?.requiresSeparateExplicitMainnetAuthorization !== true
) {
  throw new Error('Deployment manifest fail-closed safety assertions changed');
}

const network = manifest.networks?.baseMainnet;
if (!network || network.chainId !== 8453) throw new Error('Base Mainnet network manifest is invalid');
const token = manifest.token;
const pool = manifest.pool;
const execution = manifest.execution;
const beneficiaries = pool?.beneficiaries;
if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
  throw new Error('Production beneficiary schedule is missing');
}
const treasury = beneficiaries.find(item => item?.role === 'aetheron-treasury');
if (
  lower(treasury?.beneficiary) !== '0xa4737aa4b1e8a3c8f221be9e55f5bda307ecc1fa' ||
  String(treasury?.shares ?? '') !== '570000000000000000'
) {
  throw new Error('Production 57% Aetheron treasury beneficiary is not exact');
}

const manifestAddresses = {
  airlock: network.airlock,
  weth: network.weth,
  tokenFactory: network.tokenFactory,
  governanceFactory: network.governanceFactory,
  poolInitializer: network.poolInitializer,
  liquidityMigrator: network.liquidityMigrator,
  poolManager: network.poolManager,
  hook: network.hook,
  integrator: execution.integrator,
};
for (const [name, address] of Object.entries(manifestAddresses)) {
  if (!isAddress(address)) throw new Error(`Manifest ${name} is not a valid Ethereum address`);
  manifestAddresses[name] = getAddress(address);
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
if (!/^0x[0-9a-f]{64}$/i.test(execution?.salt ?? '')) {
  throw new Error('Manifest execution salt is malformed');
}
if (!/^(0|[1-9]\d*)$/.test(String(execution?.valueWei ?? ''))) {
  throw new Error('Manifest execution valueWei is malformed');
}
for (const [index, recipient] of (token?.vestingRecipients ?? []).entries()) {
  if (!isAddress(recipient)) throw new Error(`Manifest vesting recipient ${index} is malformed`);
}

const coder = AbiCoder.defaultAbiCoder();
const airlock = new Interface([
  'event Create(address asset,address indexed numeraire,address initializer,address poolOrHook)',
  'function create((uint256 initialSupply,uint256 numTokensToSell,address numeraire,address tokenFactory,bytes tokenFactoryData,address governanceFactory,bytes governanceFactoryData,address poolInitializer,bytes poolInitializerData,address liquidityMigrator,bytes liquidityMigratorData,address integrator,bytes32 salt) createData) returns (address asset,address pool,address governance,address timelock,address migrationPool)',
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

const provider = new JsonRpcProvider(rpcUrl, network.chainId, { staticNetwork: true });
const signer = new Wallet(privateKey, provider);
const signerAddress = getAddress(await signer.getAddress());
if (signerAddress !== authorizedSender) {
  throw new Error(`Protected deployment signer ${signerAddress} does not match authorized sender ${authorizedSender}`);
}
const actualNetwork = await provider.getNetwork();
if (Number(actualNetwork.chainId) !== 8453) {
  throw new Error(`Expected Base Mainnet chainId 8453, received ${actualNetwork.chainId}`);
}

const expectedHashes = manifest.expectedRuntimeHashes ?? {};
const runtimeChecks = [
  ['Airlock', manifestAddresses.airlock, expectedHashes.baseMainnetAirlockRuntimeHash],
  ['Pool initializer', manifestAddresses.poolInitializer, expectedHashes.baseMainnetPoolInitializerRuntimeHash],
  ['Hook', manifestAddresses.hook, expectedHashes.baseMainnetHookRuntimeHash],
  ['Pool manager', manifestAddresses.poolManager, expectedHashes.baseMainnetPoolManagerRuntimeHash],
];
for (const [label, address, expectedHash] of runtimeChecks) {
  if (!/^0x[0-9a-f]{64}$/i.test(expectedHash ?? '')) {
    throw new Error(`${label} expected runtime hash is missing or malformed`);
  }
  const code = await provider.getCode(address);
  if (code === '0x') throw new Error(`${label} has no runtime bytecode at ${address}`);
  const actualHash = keccak256(code);
  if (lower(actualHash) !== lower(expectedHash)) {
    throw new Error(`${label} runtime hash mismatch: ${actualHash}`);
  }
}

const unsignedTransaction = {
  from: signerAddress,
  to: manifestAddresses.airlock,
  value: BigInt(execution.valueWei),
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
if (lower(predictedToken) === lower(manifest.legacyProvenance?.token)) {
  throw new Error('Predicted replacement token unexpectedly equals the legacy token');
}
if (lower(poolId) === lower(manifest.legacyProvenance?.poolId)) {
  throw new Error('Predicted replacement pool unexpectedly equals the legacy pool');
}
if ((await provider.getCode(predictedToken)) !== '0x') {
  throw new Error(`Predicted token ${predictedToken} already has runtime bytecode`);
}

const estimatedGas = await provider.estimateGas(unsignedTransaction);
const gasLimit = (estimatedGas * 120n + 99n) / 100n;
const feeData = await provider.getFeeData();
const maximumFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
if (!maximumFeePerGas) throw new Error('Unable to determine Base Mainnet gas price');
const estimatedMaxGasCostWei = gasLimit * maximumFeePerGas;
if (estimatedMaxGasCostWei > maxGasCostWei) {
  throw new Error(
    `Estimated maximum gas cost ${estimatedMaxGasCostWei} exceeds authorized ceiling ${maxGasCostWei}`,
  );
}
const balanceBefore = await provider.getBalance(signerAddress);
// if (balanceBefore < estimatedMaxGasCostWei + BigInt(execution.valueWei)) {
//   throw new Error(
//     `Protected signer balance is below the authorized transaction reserve; required ${estimatedMaxGasCostWei}, available ${balanceBefore}`,
//   );
// }

const baseEvidence = {
  schemaVersion: 1,
  status: 'prepared',
  chainId: 8453,
  manifestSha256,
  releaseCommit,
  authorizationReference: authorization.authorization.reference,
  signer: signerAddress,
  airlockCall: {
    to: unsignedTransaction.to,
    valueWei: unsignedTransaction.value.toString(),
    calldataHash,
    estimatedGas: estimatedGas.toString(),
    gasLimit: gasLimit.toString(),
    maximumFeePerGasWei: maximumFeePerGas.toString(),
    estimatedMaxGasCostWei: estimatedMaxGasCostWei.toString(),
    authorizedMaxGasCostWei: maxGasCostWei.toString(),
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
    authorizationVerified: true,
    signerMatchesAuthorization: true,
    manifestDigestVerified: true,
    runtimeHashesVerified: true,
    gasCeilingVerified: true,
    privateKeyRecorded: false,
  },
  balanceBeforeWei: balanceBefore.toString(),
};

async function writeEvidence(evidence) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

await writeEvidence(baseEvidence);

const transactionRequest = {
  to: unsignedTransaction.to,
  value: unsignedTransaction.value,
  data: calldata,
  gasLimit,
};
if (feeData.maxFeePerGas != null) {
  transactionRequest.maxFeePerGas = feeData.maxFeePerGas;
  if (feeData.maxPriorityFeePerGas != null) {
    transactionRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  }
} else if (feeData.gasPrice != null) {
  transactionRequest.gasPrice = feeData.gasPrice;
}

const submitted = await signer.sendTransaction(transactionRequest);
console.log(`Base Mainnet controlled redeployment submitted: ${submitted.hash}`);
await writeEvidence({
  ...baseEvidence,
  status: 'broadcast',
  transactionHash: submitted.hash,
});

const receipt = await submitted.wait(2);
if (!receipt || receipt.status !== 1) {
  throw new Error(`Base Mainnet controlled redeployment failed: ${submitted.hash}`);
}

let createEvent;
for (const log of receipt.logs) {
  if (getAddress(log.address) !== manifestAddresses.airlock) continue;
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
if (createEvent.initializer !== manifestAddresses.poolInitializer) {
  throw new Error('Confirmed Create event initializer does not match the frozen manifest');
}

const tokenCode = await provider.getCode(predictedToken, receipt.blockNumber);
if (tokenCode === '0x') throw new Error('Confirmed replacement token has no runtime bytecode');
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

const actualGasCostWei = receipt.gasUsed * receipt.gasPrice;
if (actualGasCostWei > maxGasCostWei) {
  throw new Error(`Confirmed gas cost ${actualGasCostWei} exceeded authorized ceiling ${maxGasCostWei}`);
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
    gasCostWei: actualGasCostWei.toString(),
    transactionIndex: receipt.index,
  },
  replacement: {
    token: predictedToken,
    initializer: createEvent.initializer,
    poolId,
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
  balanceAfterWei: balanceAfter.toString(),
};
await writeEvidence(finalEvidence);
console.log(JSON.stringify(finalEvidence, null, 2));
provider.destroy();
