const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RELEASE_CONFIG_PATH = path.join(ROOT, 'config', 'release-core.json');
const RELEASE_CONFIG = Object.freeze(JSON.parse(fs.readFileSync(RELEASE_CONFIG_PATH, 'utf8')));

const PUBLIC_NETWORKS = Object.freeze({
  8453: {
    name: 'base',
    confirmation: 'DEPLOY_BASE_MAINNET',
    minBalanceKey: 'baseMinDeployerBalanceEth',
    auditRequired: true,
  },
  84532: {
    name: 'baseSepolia',
    confirmation: 'DEPLOY_BASE_SEPOLIA',
    minBalanceKey: 'baseSepoliaMinDeployerBalanceEth',
    auditRequired: false,
  },
});

function parseAddressList(value) {
  return [...new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean))];
}

function normalizePrivateKey(value) {
  let normalized = String(value || '').trim().replace(/^\uFEFF/, '');
  while (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) normalized = `0x${normalized}`;
  return normalized;
}

function manifestPath(networkName) {
  return (
    process.env.DEPLOYMENT_MANIFEST_PATH ||
    path.join(ROOT, 'deployments', `${networkName}-${RELEASE_CONFIG.profile}.json`)
  );
}

function writeManifest(filePath, manifest) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  const json = JSON.stringify(
    manifest,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
  fs.writeFileSync(temporaryPath, `${json}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, filePath);
}

function assertExactContractScope(contractNames) {
  const expected = [...RELEASE_CONFIG.contracts].sort();
  const actual = [...contractNames].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `Release contract scope mismatch. Expected ${expected.join(', ')}, found ${actual.join(', ')}`
    );
  }
}

module.exports = {
  PUBLIC_NETWORKS,
  RELEASE_CONFIG,
  RELEASE_CONFIG_PATH,
  ROOT,
  assertExactContractScope,
  manifestPath,
  normalizePrivateKey,
  parseAddressList,
  writeManifest,
};
