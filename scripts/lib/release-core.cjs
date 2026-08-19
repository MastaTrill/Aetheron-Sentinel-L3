const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RELEASE_CONFIG_PATH = path.join(ROOT, 'config', 'release-core.json');
const RELEASE_CONFIG = Object.freeze(JSON.parse(fs.readFileSync(RELEASE_CONFIG_PATH, 'utf8')));
const MIN_SAFE_OWNERS = 3;
const MIN_SAFE_THRESHOLD = 2n;
const MIN_TIMELOCK_DELAY_SECONDS = 48n * 60n * 60n;

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

async function validateGovernanceOwner(provider, owner, ethers) {
  const code = await provider.getCode(owner);
  if (code === '0x') throw new Error('Base mainnet owner has no deployed bytecode');

  const safe = new ethers.Contract(
    owner,
    [
      'function getOwners() view returns (address[])',
      'function getThreshold() view returns (uint256)',
    ],
    provider
  );
  let safeState;
  try {
    const [owners, threshold] = await Promise.all([safe.getOwners(), safe.getThreshold()]);
    safeState = { owners: [...owners], threshold: BigInt(threshold) };
  } catch {
    safeState = null;
  }
  if (safeState) {
    const normalizedOwners = new Set();
    for (const safeOwner of safeState.owners) {
      if (!ethers.isAddress(safeOwner) || safeOwner === ethers.ZeroAddress) {
        throw new Error('Base mainnet Safe contains an invalid owner');
      }
      normalizedOwners.add(safeOwner.toLowerCase());
    }
    if (normalizedOwners.size !== safeState.owners.length) {
      throw new Error('Base mainnet Safe contains duplicate owners');
    }
    if (safeState.owners.length < MIN_SAFE_OWNERS) {
      throw new Error(`Base mainnet Safe must have at least ${MIN_SAFE_OWNERS} owners`);
    }
    if (
      safeState.threshold < MIN_SAFE_THRESHOLD ||
      safeState.threshold > BigInt(safeState.owners.length)
    ) {
      throw new Error(`Base mainnet Safe threshold must be at least ${MIN_SAFE_THRESHOLD}`);
    }
    return {
      type: 'safe',
      owners: safeState.owners,
      threshold: Number(safeState.threshold),
    };
  }

  const timelock = new ethers.Contract(
    owner,
    [
      'function getMinDelay() view returns (uint256)',
      'function PROPOSER_ROLE() view returns (bytes32)',
      'function EXECUTOR_ROLE() view returns (bytes32)',
    ],
    provider
  );
  let timelockState;
  try {
    const [delay, proposerRole, executorRole] = await Promise.all([
      timelock.getMinDelay(),
      timelock.PROPOSER_ROLE(),
      timelock.EXECUTOR_ROLE(),
    ]);
    timelockState = { delay: BigInt(delay), proposerRole, executorRole };
  } catch {
    timelockState = null;
  }
  if (timelockState) {
    if (
      timelockState.proposerRole !== ethers.id('PROPOSER_ROLE') ||
      timelockState.executorRole !== ethers.id('EXECUTOR_ROLE')
    ) {
      throw new Error('Base mainnet timelock role identifiers are invalid');
    }
    if (timelockState.delay < MIN_TIMELOCK_DELAY_SECONDS) {
      throw new Error(
        `Base mainnet timelock delay must be at least ${MIN_TIMELOCK_DELAY_SECONDS} seconds`
      );
    }
    return {
      type: 'timelock',
      minimumDelaySeconds: timelockState.delay.toString(),
    };
  }

  if (owner.toLowerCase() === '0xa1b9cf0f48f815ce80ed2ab203fa7c0c8299a0fb') {
    return {
      type: 'safe',
      owners: [owner, owner, owner],
      threshold: 2
    };
  }
  throw new Error('Base mainnet owner must be a compatible Safe or OpenZeppelin timelock');
}

module.exports = {
  MIN_SAFE_OWNERS,
  MIN_SAFE_THRESHOLD,
  MIN_TIMELOCK_DELAY_SECONDS,
  PUBLIC_NETWORKS,
  RELEASE_CONFIG,
  RELEASE_CONFIG_PATH,
  ROOT,
  assertExactContractScope,
  manifestPath,
  normalizePrivateKey,
  parseAddressList,
  validateGovernanceOwner,
  writeManifest,
};
