const assert = require('node:assert/strict');
const test = require('node:test');
const {
  assertSuccessfulRehearsalRun,
  assertVerifiedManifest,
  parseVerifiedManifest,
} = require('../scripts/lib/base-sepolia-rehearsal.cjs');
const {
  assertImmutableRelease,
  assertReleaseCommit,
  resolveTagCommit,
} = require('../scripts/lib/immutable-release.cjs');

const COMMIT = 'a'.repeat(40);
const OWNER = `0x${'1'.repeat(40)}`;
const DEPLOYER = `0x${'2'.repeat(40)}`;
const MONITOR = `0x${'3'.repeat(40)}`;

function validRun(overrides = {}) {
  return {
    id: 1234,
    path: '.github/workflows/base-sepolia-pipeline.yml',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    head_sha: COMMIT,
    ...overrides,
  };
}

function contractRecord(seed) {
  return {
    address: `0x${seed.repeat(40)}`,
    deploymentTransaction: `0x${seed.repeat(64)}`,
    deploymentBlock: 100,
    runtimeCodeHash: `0x${seed.repeat(64)}`,
  };
}

function validManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    releaseProfile: 'sentinel-guardrails-v1',
    status: 'verified-paused',
    network: 'baseSepolia',
    chainId: 84532,
    releaseCommit: COMMIT,
    deployer: DEPLOYER,
    owner: OWNER,
    safety: {
      paused: true,
      autonomousMode: false,
      custodyEnabled: false,
      pendingActions: [],
    },
    configuration: { monitors: [MONITOR] },
    contracts: {
      SentinelInterceptor: contractRecord('4'),
      CircuitBreaker: contractRecord('5'),
      RateLimiter: contractRecord('6'),
    },
    ...overrides,
  };
}

test('accepts an immutable published release and its lightweight tag', async () => {
  assertImmutableRelease(
    {
      tag_name: 'v1.2.3',
      draft: false,
      prerelease: false,
      immutable: true,
      published_at: '2026-07-21T00:00:00Z',
    },
    'v1.2.3'
  );
  const resolved = await resolveTagCommit(
    { ref: 'refs/tags/v1.2.3', object: { type: 'commit', sha: COMMIT } },
    'v1.2.3',
    async () => assert.fail('lightweight tag should not load an annotated object')
  );
  assertReleaseCommit(resolved, COMMIT);
});

test('resolves an annotated immutable release tag', async () => {
  const tagObjectSha = 'b'.repeat(40);
  const resolved = await resolveTagCommit(
    { ref: 'refs/tags/v1.2.3', object: { type: 'tag', sha: tagObjectSha } },
    'v1.2.3',
    async sha => {
      assert.equal(sha, tagObjectSha);
      return { object: { type: 'commit', sha: COMMIT } };
    }
  );
  assert.equal(resolved, COMMIT);
});

test('rejects a mutable release or a tag pointing at another commit', async () => {
  assert.throws(
    () =>
      assertImmutableRelease(
        {
          tag_name: 'v1.2.3',
          draft: false,
          prerelease: false,
          immutable: false,
          published_at: '2026-07-21T00:00:00Z',
        },
        'v1.2.3'
      ),
    /must be immutable/
  );
  assert.throws(() => assertReleaseCommit('b'.repeat(40), COMMIT), /does not resolve/);
});

test('accepts only the successful Base Sepolia broadcast run for the release commit', () => {
  assertSuccessfulRehearsalRun(validRun(), '1234', COMMIT);
  assert.throws(
    () => assertSuccessfulRehearsalRun(validRun({ head_sha: 'b'.repeat(40) }), '1234', COMMIT),
    /did not run the release commit/
  );
  assert.throws(
    () => assertSuccessfulRehearsalRun(validRun({ conclusion: 'failure' }), '1234', COMMIT),
    /did not complete successfully/
  );
});

test('accepts a verified paused Base Sepolia manifest for the release commit', () => {
  assert.equal(assertVerifiedManifest(validManifest(), COMMIT).status, 'verified-paused');
});

test('rejects unsafe or mismatched Base Sepolia manifests', () => {
  assert.throws(
    () => assertVerifiedManifest(validManifest({ releaseCommit: 'b'.repeat(40) }), COMMIT),
    /does not identify the release commit/
  );
  assert.throws(
    () =>
      assertVerifiedManifest(
        validManifest({
          safety: {
            paused: false,
            autonomousMode: false,
            custodyEnabled: false,
            pendingActions: [],
          },
        }),
        COMMIT
      ),
    /safety state is invalid/
  );
});

test('parses and validates the downloaded deployment manifest', () => {
  const result = parseVerifiedManifest(Buffer.from(JSON.stringify(validManifest())), COMMIT);
  assert.equal(result.manifest.releaseCommit, COMMIT);
  assert.ok(result.manifestBytes.length > 0);
});

test('rejects invalid downloaded deployment manifest bytes', () => {
  assert.throws(() => parseVerifiedManifest(Buffer.from('{'), COMMIT), /not valid JSON/);
  assert.throws(() => parseVerifiedManifest(Buffer.alloc(0), COMMIT), /size is invalid/);
});
