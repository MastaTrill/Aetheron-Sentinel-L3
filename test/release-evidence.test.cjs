const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
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
const {
  MIN_TIMELOCK_DELAY_SECONDS,
  validateGovernanceOwner,
} = require('../scripts/lib/release-core.cjs');

const COMMIT = 'a'.repeat(40);
const OWNER = `0x${'1'.repeat(40)}`;
const DEPLOYER = `0x${'2'.repeat(40)}`;
const MONITOR = `0x${'3'.repeat(40)}`;
const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const REDEPLOYMENT_MANIFEST = path.join(
  REPOSITORY_ROOT,
  'release-evidence/sentinel-mainnet/redeployment-closure.json'
);

function runRedeploymentClosure(mode, mutate = manifest => manifest) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sentinel-redeployment-'));
  const manifestPath = path.join(directory, 'release-closure.json');
  const manifest = mutate(JSON.parse(readFileSync(REDEPLOYMENT_MANIFEST, 'utf8')));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    ['scripts/validate-sentinel-redeployment-closure.mjs', `--mode=${mode}`],
    {
      cwd: REPOSITORY_ROOT,
      env: {
        ...process.env,
        SENTINEL_REDEPLOYMENT_CLOSURE_MANIFEST: manifestPath,
      },
      encoding: 'utf8',
    }
  );
  rmSync(directory, { recursive: true, force: true });
  return result;
}

function governanceHarness(configuration) {
  const provider = {
    getCode: async () => configuration.code ?? '0x1234',
    governance: configuration,
  };
  class Contract {
    constructor(_address, _abi, connectedProvider) {
      this.configuration = connectedProvider.governance;
    }

    async getOwners() {
      if (!this.configuration.safe) throw new Error('not a Safe');
      return this.configuration.owners;
    }

    async getThreshold() {
      if (!this.configuration.safe) throw new Error('not a Safe');
      return this.configuration.threshold;
    }

    async getMinDelay() {
      if (!this.configuration.timelock) throw new Error('not a timelock');
      return this.configuration.delay;
    }

    async PROPOSER_ROLE() {
      if (!this.configuration.timelock) throw new Error('not a timelock');
      return 'role:PROPOSER_ROLE';
    }

    async EXECUTOR_ROLE() {
      if (!this.configuration.timelock) throw new Error('not a timelock');
      return 'role:EXECUTOR_ROLE';
    }
  }
  return {
    provider,
    ethers: {
      Contract,
      ZeroAddress: `0x${'0'.repeat(40)}`,
      id: value => `role:${value}`,
      isAddress: value => /^0x[0-9a-f]{40}$/i.test(value || ''),
    },
  };
}

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

test('accepts a Safe with at least three owners and a two-signature threshold', async () => {
  const harness = governanceHarness({
    safe: true,
    owners: [OWNER, DEPLOYER, MONITOR],
    threshold: 2n,
  });
  const result = await validateGovernanceOwner(harness.provider, OWNER, harness.ethers);
  assert.equal(result.type, 'safe');
  assert.equal(result.threshold, 2);
});

test('rejects an under-protected Safe', async () => {
  const harness = governanceHarness({
    safe: true,
    owners: [OWNER, DEPLOYER, MONITOR],
    threshold: 1n,
  });
  await assert.rejects(
    validateGovernanceOwner(harness.provider, OWNER, harness.ethers),
    /threshold must be at least/
  );
});

test('accepts an OpenZeppelin timelock with a 48-hour delay', async () => {
  const harness = governanceHarness({ timelock: true, delay: MIN_TIMELOCK_DELAY_SECONDS });
  const result = await validateGovernanceOwner(harness.provider, OWNER, harness.ethers);
  assert.equal(result.type, 'timelock');
  assert.equal(result.minimumDelaySeconds, MIN_TIMELOCK_DELAY_SECONDS.toString());
});

test('rejects a short timelock or an address without bytecode', async () => {
  const shortTimelock = governanceHarness({
    timelock: true,
    delay: MIN_TIMELOCK_DELAY_SECONDS - 1n,
  });
  await assert.rejects(
    validateGovernanceOwner(shortTimelock.provider, OWNER, shortTimelock.ethers),
    /delay must be at least/
  );

  const noCode = governanceHarness({ code: '0x' });
  await assert.rejects(
    validateGovernanceOwner(noCode.provider, OWNER, noCode.ethers),
    /has no deployed bytecode/
  );
});

test('accepts the fail-closed redeployment manifest in readiness mode', () => {
  const result = runRedeploymentClosure('readiness');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Complete gates: \d\/9/);
});

test('blocks final release while the replacement is not deployed', () => {
  const result = runRedeploymentClosure('final');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /final mode requires a deployed replacement/);
  assert.match(result.stderr, /final mode requires every gate complete/);
});

test('rejects a replacement manifest with the wrong Creator beneficiary', () => {
  const result = runRedeploymentClosure('readiness', manifest => {
    manifest.replacementDeployment.creatorBeneficiary = OWNER;
    return manifest;
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be the established Aetheron treasury/);
});

test('rejects changes that rewrite the preserved legacy beneficiary evidence', () => {
  const result = runRedeploymentClosure('readiness', manifest => {
    manifest.legacyDeployment.currentCreatorBeneficiary = OWNER;
    return manifest;
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /legacy beneficiary evidence changed/);
});
