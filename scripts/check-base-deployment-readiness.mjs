import process from 'node:process';

function fail(message) {
  console.error(`BASE DEPLOYMENT GATE: FAIL — ${message}`);
  process.exitCode = 1;
}

const mode = process.env.DEPLOYMENT_MODE || 'readiness';
if (!['readiness', 'base-sepolia', 'base-mainnet'].includes(mode)) fail(`unsupported DEPLOYMENT_MODE ${mode}`);

const expectedChain = mode === 'base-mainnet' ? '8453' : '84532';
if (mode !== 'readiness' && process.env.EXPECTED_CHAIN_ID !== expectedChain) fail(`EXPECTED_CHAIN_ID must be ${expectedChain}`);

if (mode !== 'readiness') {
  const confirmation = mode === 'base-mainnet' ? 'DEPLOY_SENTINEL_BASE_MAINNET' : 'DEPLOY_SENTINEL_BASE_SEPOLIA';
  if (process.env.CONFIRM_DEPLOYMENT !== confirmation) fail(`CONFIRM_DEPLOYMENT must equal ${confirmation}`);
  if (process.env.REVIEWED_COMMIT !== process.env.GITHUB_SHA) fail('REVIEWED_COMMIT must equal the immutable workflow commit');
  if (process.env.SECURITY_REVIEW_APPROVED !== 'true') fail('security review approval is required');
  if (process.env.TWO_PERSON_REVIEW_APPROVED !== 'true') fail('two-person review approval is required');
  if (process.env.OWNER_ADDRESS_REVIEWED !== 'true') fail('owner address review is required');
  if (process.env.INCIDENT_RESPONSE_READY !== 'true') fail('incident response readiness is required');
  if (!process.env.DEPLOYER_ADDRESS) fail('DEPLOYER_ADDRESS must be explicit');
  if (!process.env.MIN_DEPLOYER_BALANCE_ETH) fail('MIN_DEPLOYER_BALANCE_ETH must be explicit');
}

if (mode === 'base-mainnet') {
  if (process.env.MULTISIG_ADDRESS_REVIEWED !== 'true') fail('reviewed multisig is required for Base mainnet');
  if (process.env.TIMELOCK_ADDRESS_REVIEWED !== 'true') fail('reviewed timelock is required for Base mainnet');
  if (process.env.INDEPENDENT_AUDIT_APPROVED !== 'true') fail('independent audit approval is required for Base mainnet');
  if (process.env.BASE_SEPOLIA_EVIDENCE_APPROVED !== 'true') fail('approved Base Sepolia evidence is required');
}

if (!process.exitCode) console.log(`BASE DEPLOYMENT GATE: PASS — ${mode}`);
