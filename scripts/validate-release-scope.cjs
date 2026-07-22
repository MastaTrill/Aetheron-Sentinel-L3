const fs = require('node:fs');
const path = require('node:path');
const { RELEASE_CONFIG, ROOT, assertExactContractScope } = require('./lib/release-core.cjs');

const FORBIDDEN_MARKERS = [
  /\bdemo\b/i,
  /\bplaceholder\b/i,
  /\bsimulat(?:e|ed|ion)\b/i,
  /\bsimplified\b/i,
  /\bTODO\b/,
  /in production,? this would/i,
];

assertExactContractScope(RELEASE_CONFIG.contracts);
for (const name of RELEASE_CONFIG.contracts) {
  const sourcePath = path.join(ROOT, 'contracts', `${name}.sol`);
  if (!fs.existsSync(sourcePath)) throw new Error(`Release contract is missing: ${sourcePath}`);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const marker = FORBIDDEN_MARKERS.find(pattern => pattern.test(source));
  if (marker) throw new Error(`${name} contains prohibited release marker ${marker}`);
}

const excludedContracts = [
  'AetheronBridge',
  'SentinelCore',
  'SentinelCoreLoop',
  'SentinelHomomorphicEncryption',
  'SentinelInsuranceProtocol',
  'SentinelQuantumGuard',
  'SentinelSocialRecovery',
  'SentinelYieldMaximizer',
  'SentinelZKIdentity',
  'SentinelZKOracle',
];
for (const excluded of excludedContracts) {
  if (RELEASE_CONFIG.contracts.includes(excluded)) {
    throw new Error(`Unsafe or custodial contract entered the core release scope: ${excluded}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
for (const scriptName of ['deploy:base', 'deploy:base-sepolia']) {
  if (!packageJson.scripts[scriptName]?.includes('deploy-release-core.cjs')) {
    throw new Error(`${scriptName} does not use the frozen release deployer`);
  }
}
for (const scriptName of ['deploy:mainnet', 'pipeline:base', 'patch:base']) {
  if (!packageJson.scripts[scriptName]?.includes('disabled')) {
    throw new Error(`${scriptName} must remain disabled`);
  }
}

console.log(`RELEASE SCOPE: PASS (${RELEASE_CONFIG.profile})`);
console.log(`Contracts: ${RELEASE_CONFIG.contracts.join(', ')}`);
