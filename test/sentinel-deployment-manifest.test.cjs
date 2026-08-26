const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json'
);
const LEGACY_EVIDENCE_PATH = path.join(
  REPOSITORY_ROOT,
  'release-evidence/sentinel-mainnet/redeployment/legacy-launch-inputs.json'
);

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function runManifestValidator({ declaredDigest, reconstructedBytes } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sentinel-deployment-manifest-'));
  const manifestPath = path.join(directory, 'deployment-manifest.json');
  const legacyEvidencePath = path.join(directory, 'legacy-launch-inputs.json');
  const reconstructionPath = path.join(directory, 'reconstructed-legacy-launch-inputs.json');
  const legacyEvidenceBytes = readFileSync(LEGACY_EVIDENCE_PATH);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

  writeFileSync(legacyEvidencePath, legacyEvidenceBytes);
  manifest.legacyProvenance.evidence = legacyEvidencePath;
  manifest.legacyProvenance.artifactDigest = declaredDigest ?? sha256(legacyEvidenceBytes);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const env = {
    ...process.env,
    SENTINEL_REDEPLOYMENT_MANIFEST: manifestPath,
  };
  if (reconstructedBytes !== undefined) {
    writeFileSync(reconstructionPath, reconstructedBytes);
    env.SENTINEL_LEGACY_RECONSTRUCTION_OUTPUT = reconstructionPath;
  } else {
    delete env.SENTINEL_LEGACY_RECONSTRUCTION_OUTPUT;
  }

  const result = spawnSync(
    process.execPath,
    ['scripts/validate-sentinel-deployment-manifest.mjs'],
    {
      cwd: REPOSITORY_ROOT,
      env,
      encoding: 'utf8',
    }
  );
  rmSync(directory, { recursive: true, force: true });
  return result;
}

test('accepts the committed legacy evidence when its declared digest matches', () => {
  const result = runManifestValidator();
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a declared legacy evidence digest that does not match the committed bytes', () => {
  const result = runManifestValidator({ declaredDigest: `sha256:${'0'.repeat(64)}` });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /legacy evidence digest/);
});

test('rejects reconstructed legacy evidence that differs byte-for-byte from the committed artifact', () => {
  const committedBytes = readFileSync(LEGACY_EVIDENCE_PATH);
  const result = runManifestValidator({
    reconstructedBytes: Buffer.concat([committedBytes, Buffer.from('\n')]),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fresh reconstruction does not match committed legacy evidence/);
});
