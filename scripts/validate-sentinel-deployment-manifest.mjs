#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const manifestPath =
  process.env.SENTINEL_REDEPLOYMENT_MANIFEST ??
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const legacy = JSON.parse(await readFile(manifest.legacyProvenance.evidence, 'utf8'));
const failures = [];

const OLD_CREATOR = '0x7e3d11f70084d667295710e6b7ff50c3b0487a45';
const TREASURY = '0xa4737aa4b1e8a3c8f221be9e55f5bda307ecc1fa';
const WAD = 10n ** 18n;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/i;

function lower(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function same(label, actual, expected) {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, received ${actual}`);
}

function sameAddress(label, actual, expected) {
  if (lower(actual) !== lower(expected)) failures.push(`${label}: expected ${expected}, received ${actual}`);
}

function validAddress(label, value) {
  if (!ADDRESS.test(value ?? '') || /^0x0{40}$/i.test(value)) failures.push(`${label}: invalid address`);
}

function validHash(label, value) {
  if (!HASH.test(value ?? '') || /^0x0{64}$/i.test(value)) failures.push(`${label}: invalid hash`);
}

same('schemaVersion', manifest.schemaVersion, 1);
same('releaseModel', manifest.releaseModel, 'controlled-redeployment');
same('status', manifest.status, 'preparation-only');
same('signingEnabled', manifest.safety?.signingEnabled, false);
same('broadcastEnabled', manifest.safety?.broadcastEnabled, false);
same('baseMainnetAuthorized', manifest.safety?.baseMainnetAuthorized, false);
same('independent review gate', manifest.safety?.requiresIndependentHumanReview, true);
same('explicit authorization gate', manifest.safety?.requiresSeparateExplicitMainnetAuthorization, true);
same('authorized Base Mainnet sender', manifest.execution?.authorizedBaseMainnetSender, null);
same('protected rehearsal broadcast', manifest.rehearsal?.protectedBroadcastAuthorized, false);
same('rehearsal mode', manifest.rehearsal?.mode, 'simulation-only');

same('SDK version', manifest.sourcePins?.dopplerSdk?.version, '1.0.33');
same('SDK commit', manifest.sourcePins?.dopplerSdk?.commit, 'd6b52689e6af367e7831a3d728c5a48dfa1507e8');
same('solc', manifest.sourcePins?.dopplerContracts?.compiler?.solc, '0.8.26');
same('EVM version', manifest.sourcePins?.dopplerContracts?.compiler?.evmVersion, 'cancun');
same('optimizer runs', manifest.sourcePins?.dopplerContracts?.compiler?.optimizerRuns, 0);
same('bytecode hash mode', manifest.sourcePins?.dopplerContracts?.compiler?.bytecodeHash, 'none');

const expectedNetworks = {
  baseSepolia: {
    chainId: 84532,
    airlock: '0x3411306Ce66c9469BFF1535BA955503c4Bde1C6e',
    tokenFactory: '0xf0B5141dD9096254B2ca624dff26024f46087229',
    governanceFactory: '0x916b8987e4ad325c10d58ed8dc2036a6ff5eb228',
    poolInitializer: '0xD59cE43E53D69F190E15d9822Fb4540dCcc91178',
    liquidityMigrator: '0xF11066abbd329ac4bBA39455340539322C222eb0',
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
    weth: '0x4200000000000000000000000000000000000006',
    hook: '0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0',
  },
  baseMainnet: {
    chainId: 8453,
    airlock: '0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12',
    tokenFactory: '0xf0B5141dD9096254B2ca624dff26024f46087229',
    governanceFactory: '0xe7dfbd5b0A2C3B4464653A9beCdc489229eF090E',
    poolInitializer: '0xD59cE43E53D69F190E15d9822Fb4540dCcc91178',
    liquidityMigrator: '0x6ddfED58D238Ca3195E49d8ac3d4cEa6386E5C33',
    poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    weth: '0x4200000000000000000000000000000000000006',
    hook: '0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0',
  },
};

for (const [networkName, expected] of Object.entries(expectedNetworks)) {
  const actual = manifest.networks?.[networkName] ?? {};
  same(`${networkName}.chainId`, actual.chainId, expected.chainId);
  for (const [field, address] of Object.entries(expected).filter(([key]) => key !== 'chainId')) {
    validAddress(`${networkName}.${field}`, actual[field]);
    sameAddress(`${networkName}.${field}`, actual[field], address);
  }
}

const token = manifest.token ?? {};
same('token name', token.name, 'SENTINEL');
same('token symbol', token.symbol, 'SENTINEL');
same('token decimals', token.decimals, 18);
same('initial supply', token.initialSupply, '100000000000000000000000000000');
same('tokens to sell', token.numTokensToSell, token.initialSupply);
same('yearly mint rate', token.yearlyMintRate, '20000000000000000');
same('vesting duration', token.vestingDuration, '0');
same('vesting recipients', JSON.stringify(token.vestingRecipients), '[]');
same('vesting amounts', JSON.stringify(token.vestingAmounts), '[]');
same('token URI', token.tokenURI, 'ipfs://bafkreih43tnu76b2mrcvankahfmlgzcpgjmknzdmrclqezig4dtkpjm7wy');

const pool = manifest.pool ?? {};
same('pool type', pool.type, 'uniswap-v4-decay-multicurve');
same('dynamic fee flag', pool.dynamicFeeFlag, 8388608);
same('start fee', pool.startFee, 800000);
same('terminal fee', pool.fee, 12000);
same('fee duration', pool.durationSeconds, 10);
same('tick spacing', pool.tickSpacing, 200);
same('starting time', pool.startingTime, 0);
same('curves', JSON.stringify(pool.curves), JSON.stringify([
  { tickLower: -230000, tickUpper: -120000, numPositions: 1, shares: '990000000000000000' },
  { tickLower: -120000, tickUpper: 887200, numPositions: 1, shares: '10000000000000000' },
]));
if ((pool.curves ?? []).reduce((sum, curve) => sum + BigInt(curve.shares), 0n) !== WAD) {
  failures.push('curve shares must sum to 1e18');
}

const beneficiaries = pool.beneficiaries ?? [];
if (beneficiaries.reduce((sum, item) => sum + BigInt(item.shares), 0n) !== WAD) {
  failures.push('beneficiary shares must sum to 1e18');
}
const beneficiaryAddresses = beneficiaries.map(item => lower(item.beneficiary));
if (beneficiaryAddresses.includes(OLD_CREATOR)) failures.push('legacy creator is present in replacement beneficiaries');
if (JSON.stringify(beneficiaryAddresses) !== JSON.stringify([...beneficiaryAddresses].sort())) {
  failures.push('beneficiaries must remain address-sorted');
}
const treasury = beneficiaries.find(item => lower(item.beneficiary) === TREASURY);
same('treasury role', treasury?.role, 'aetheron-treasury');
same('treasury share', treasury?.shares, '570000000000000000');

same('governance model', manifest.execution?.governanceModel, 'no-op');
same('migration model', manifest.execution?.migrationModel, 'no-op');
same('governance factory data', manifest.execution?.governanceFactoryData, '0x');
same('migrator data', manifest.execution?.liquidityMigratorData, '0x');
sameAddress('integrator', manifest.execution?.integrator, '0xF60633D02690e2A15A54AB919925F3d038Df163e');
same('fixed salt', manifest.execution?.salt, '0x53454e54494e454c2d52454445504c4f592d5631000000000000000000000000');
same('call value', manifest.execution?.valueWei, '0');

same('legacy chain', legacy.chainId, manifest.legacyProvenance.chainId);
same('legacy block', legacy.blockNumber, manifest.legacyProvenance.blockNumber);
same('legacy transaction', legacy.transactionHash, manifest.legacyProvenance.transactionHash);
same('legacy calldata hash', legacy.calldataHash, manifest.legacyProvenance.airlockCalldataHash);
sameAddress('legacy token', legacy.createEvent.asset, manifest.legacyProvenance.token);
sameAddress('legacy creator', legacy.airlockCall.from, manifest.legacyProvenance.replacedCreatorBeneficiary);
validHash('legacy transaction hash', manifest.legacyProvenance.transactionHash);
validHash('legacy calldata hash', manifest.legacyProvenance.airlockCalldataHash);

const legacyToken = legacy.decodedTokenFactoryData;
same('legacy token name match', token.name, legacyToken.name);
same('legacy token symbol match', token.symbol, legacyToken.symbol);
same('legacy yearly mint match', token.yearlyMintRate, legacyToken.yearlyMintRate);
same('legacy vesting duration match', token.vestingDuration, legacyToken.vestingDuration);
same('legacy token URI match', token.tokenURI, legacyToken.tokenURI);
same('legacy initial supply match', token.initialSupply, legacy.createData.initialSupply);
same('legacy tokens to sell match', token.numTokensToSell, legacy.createData.numTokensToSell);

const normalizedLegacyCurves = legacy.decodedDecayPoolInitializerData.curves.map(curve => ({
  tickLower: Number(curve.tickLower),
  tickUpper: Number(curve.tickUpper),
  numPositions: Number(curve.numPositions),
  shares: curve.shares,
}));
same('legacy curve preservation', JSON.stringify(pool.curves), JSON.stringify(normalizedLegacyCurves));

const expectedBeneficiaries = legacy.decodedDecayPoolInitializerData.beneficiaries.map(item => ({
  beneficiary: lower(item.beneficiary) === OLD_CREATOR ? TREASURY : lower(item.beneficiary),
  shares: item.shares,
}));
same(
  'legacy beneficiary preservation with treasury substitution',
  JSON.stringify(beneficiaries.map(item => ({ beneficiary: lower(item.beneficiary), shares: item.shares }))),
  JSON.stringify(expectedBeneficiaries),
);

if (failures.length) {
  console.error(`SENTINEL deployment manifest is invalid:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('SENTINEL deployment manifest is exact, unsigned, and fail-closed for Base Mainnet.');
