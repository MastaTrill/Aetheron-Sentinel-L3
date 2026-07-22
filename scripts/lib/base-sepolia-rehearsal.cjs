const { RELEASE_CONFIG, assertExactContractScope } = require('./release-core.cjs');

const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/i;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
const HASH_PATTERN = /^0x[0-9a-f]{64}$/i;
const RUN_ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const WORKFLOW_PATH = '.github/workflows/base-sepolia-pipeline.yml';
const MAX_MANIFEST_BYTES = 1024 * 1024;

function assertRunId(runId) {
  if (!RUN_ID_PATTERN.test(String(runId || ''))) {
    throw new Error('BASE_SEPOLIA_RUN_ID must be a positive GitHub Actions run ID');
  }
}

function assertSuccessfulRehearsalRun(run, expectedRunId, expectedCommit) {
  assertRunId(expectedRunId);
  if (!COMMIT_PATTERN.test(expectedCommit || '')) {
    throw new Error('RELEASE_COMMIT must be a 40-character Git commit');
  }
  if (String(run?.id) !== String(expectedRunId)) {
    throw new Error('Base Sepolia workflow run ID does not match BASE_SEPOLIA_RUN_ID');
  }
  if (String(run.path || '').split('@')[0] !== WORKFLOW_PATH) {
    throw new Error('The supplied run was not created by the Base Sepolia deployment workflow');
  }
  if (run.event !== 'workflow_dispatch') {
    throw new Error('Base Sepolia rehearsal must be an explicitly dispatched workflow run');
  }
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('Base Sepolia rehearsal workflow did not complete successfully');
  }
  if (String(run.head_sha || '').toLowerCase() !== expectedCommit.toLowerCase()) {
    throw new Error('Base Sepolia rehearsal workflow did not run the release commit');
  }
  return run;
}

function assertAddress(label, value) {
  if (!ADDRESS_PATTERN.test(value || '') || /^0x0{40}$/i.test(value)) {
    throw new Error(`${label} must be a non-zero address`);
  }
}

function assertVerifiedManifest(manifest, expectedCommit) {
  if (manifest?.schemaVersion !== RELEASE_CONFIG.schemaVersion) {
    throw new Error('Base Sepolia manifest schema version is invalid');
  }
  if (manifest.releaseProfile !== RELEASE_CONFIG.profile) {
    throw new Error('Base Sepolia manifest release profile is invalid');
  }
  if (manifest.status !== 'verified-paused') {
    throw new Error('Base Sepolia manifest did not reach verified-paused');
  }
  if (manifest.network !== 'baseSepolia' || manifest.chainId !== 84532) {
    throw new Error('Base Sepolia manifest network identity is invalid');
  }
  if (String(manifest.releaseCommit || '').toLowerCase() !== expectedCommit.toLowerCase()) {
    throw new Error('Base Sepolia manifest does not identify the release commit');
  }

  assertAddress('Base Sepolia deployer', manifest.deployer);
  assertAddress('Base Sepolia owner', manifest.owner);
  if (manifest.deployer.toLowerCase() === manifest.owner.toLowerCase()) {
    throw new Error('Base Sepolia owner must differ from the deployer');
  }

  if (
    manifest.safety?.paused !== true ||
    manifest.safety?.autonomousMode !== false ||
    manifest.safety?.custodyEnabled !== false ||
    !Array.isArray(manifest.safety?.pendingActions) ||
    manifest.safety.pendingActions.length !== 0
  ) {
    throw new Error('Base Sepolia manifest safety state is invalid');
  }

  assertExactContractScope(Object.keys(manifest.contracts || {}));
  for (const [name, record] of Object.entries(manifest.contracts)) {
    assertAddress(`${name} address`, record?.address);
    if (!HASH_PATTERN.test(record.runtimeCodeHash || '')) {
      throw new Error(`${name} runtime bytecode hash is invalid`);
    }
    if (!HASH_PATTERN.test(record.deploymentTransaction || '')) {
      throw new Error(`${name} deployment transaction is invalid`);
    }
    if (!Number.isSafeInteger(record.deploymentBlock) || record.deploymentBlock <= 0) {
      throw new Error(`${name} deployment block is invalid`);
    }
  }

  const monitors = manifest.configuration?.monitors;
  if (!Array.isArray(monitors) || monitors.length === 0) {
    throw new Error('Base Sepolia manifest must include at least one monitor');
  }
  const normalizedMonitors = new Set();
  for (const monitor of monitors) {
    assertAddress('Base Sepolia monitor', monitor);
    const normalized = monitor.toLowerCase();
    if (normalized === manifest.deployer.toLowerCase()) {
      throw new Error('Base Sepolia deployer cannot remain a monitor');
    }
    if (normalizedMonitors.has(normalized)) {
      throw new Error('Base Sepolia manifest contains duplicate monitors');
    }
    normalizedMonitors.add(normalized);
  }
  return manifest;
}

function parseVerifiedManifest(manifestBytes, expectedCommit) {
  if (!Buffer.isBuffer(manifestBytes)) {
    throw new Error('Base Sepolia deployment manifest must be a byte buffer');
  }
  if (manifestBytes.length === 0 || manifestBytes.length > MAX_MANIFEST_BYTES) {
    throw new Error('Base Sepolia deployment manifest size is invalid');
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    throw new Error('Base Sepolia deployment manifest is not valid JSON');
  }
  return { manifest: assertVerifiedManifest(manifest, expectedCommit), manifestBytes };
}

module.exports = {
  MAX_MANIFEST_BYTES,
  RUN_ID_PATTERN,
  WORKFLOW_PATH,
  assertRunId,
  assertSuccessfulRehearsalRun,
  assertVerifiedManifest,
  parseVerifiedManifest,
};
