const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { Wallet } = require('ethers');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.github/workflows/mainnet-pipeline.yml');
const VALIDATOR = path.join(ROOT, 'scripts/validate-sentinel-mainnet-authorization.mjs');
const SIGNER_VALIDATOR = path.join(ROOT, 'scripts/validate-sentinel-mainnet-signer.mjs');
const EXECUTOR = path.join(ROOT, 'scripts/execute-sentinel-base-mainnet-redeployment.mjs');
const RPC_VALIDATOR = path.join(ROOT, 'scripts/validate-sentinel-mainnet-rpc.mjs');
const RELEASE_COMMIT = 'a'.repeat(40);

function authorizationMessage(auth) {
  return [
    'AETHERON SENTINEL BASE MAINNET AUTHORIZATION',
    `chainId:${auth.chainId}`,
    `manifestSha256:${auth.approvedManifest.sha256.toLowerCase()}`,
    `authorizedCommit:${auth.authorization.authorizedCommit.toLowerCase()}`,
    `authorizedSender:${auth.authorization.authorizedSender.toLowerCase()}`,
    `maxGasCostWei:${auth.limitations.maxGasCostWei}`,
    `expiresAt:${auth.limitations.expiresAt}`,
  ].join('\n');
}
async function makeFixture(overrides = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sentinel-mainnet-auth-'));
  const manifestPath = path.join(directory, 'deployment-manifest.json');
  const authorizationPath = path.join(directory, 'mainnet-authorization.json');
  const manifestText =
    JSON.stringify({ schemaVersion: 1, releaseModel: 'controlled-redeployment' }, null, 2) + '\n';
  writeFileSync(manifestPath, manifestText);
  const wallet = Wallet.createRandom();
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const auth = {
    schemaVersion: 1,
    status: 'authorized',
    confirmation: 'AUTHORIZE_SENTINEL_BASE_MAINNET_BROADCAST',
    chainId: 8453,
    limitations: { maxGasCostWei: '10000000000000000', expiresAt },
    approvedManifest: { sha256: createHash('sha256').update(manifestText).digest('hex') },
    authorization: {
      authorizedSender: wallet.address,
      authorizedAtUtc: new Date().toISOString(),
      authorizedCommit: RELEASE_COMMIT,
      reference: 'https://github.com/MastaTrill/Aetheron-Sentinel-L3/issues/210',
      signature: null,
      method: 'cryptographic-signature',
    },
    riskAcceptance: {
      proceedWithoutIndependentSecurityReview: true,
      acceptedBy: wallet.address,
      acceptedAtUtc: new Date().toISOString(),
      statement:
        'I accept the risk of proceeding without an independent security review for this exact commit and manifest.',
    },
  };
  Object.assign(auth, overrides.auth ?? {});
  auth.authorization.signature = await wallet.signMessage(authorizationMessage(auth));
  writeFileSync(authorizationPath, JSON.stringify(auth, null, 2) + '\n');
  return { directory, manifestPath, authorizationPath, auth, wallet };
}

function runValidator(fixture, releaseCommit = RELEASE_COMMIT) {
  return spawnSync(process.execPath, [VALIDATOR], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      SENTINEL_REDEPLOYMENT_MANIFEST: fixture.manifestPath,
      SENTINEL_MAINNET_AUTHORIZATION: fixture.authorizationPath,
      SENTINEL_RELEASE_COMMIT: releaseCommit,
    },
  });
}
test('mainnet workflow exposes isolated Guardrails and SENTINEL deployment targets', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  assert.match(workflow, /deployment_target:/);
  assert.match(workflow, /- guardrails/);
  assert.match(workflow, /- sentinel-redeployment/);
  assert.match(workflow, /inputs\.deployment_target == 'guardrails'/);
  assert.match(workflow, /inputs\.deployment_target == 'sentinel-redeployment'/);
  assert.match(workflow, /inputs\.confirmation == 'DEPLOY_BASE_MAINNET'/);
  assert.match(workflow, /inputs\.confirmation == 'DEPLOY_SENTINEL_BASE_MAINNET'/);
});

test('SENTINEL workflow validates authorization before any redeployment executor call', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const validatorIndex = workflow.indexOf('validate-sentinel-mainnet-authorization.mjs');
  const executorIndex = workflow.indexOf('execute-sentinel-base-mainnet-redeployment.mjs');
  assert.ok(
    validatorIndex >= 0,
    'workflow must invoke the read-only SENTINEL authorization validator'
  );
  assert.ok(
    executorIndex > validatorIndex,
    'workflow must validate authorization before invoking the executor'
  );
  assert.match(workflow, /SENTINEL_MAINNET_DEPLOYMENT_OUTPUT:.*deployment-receipt\.json/);
  assert.match(workflow, /deployment-receipt\.json/);
});

test('read-only SENTINEL authorization validator accepts a valid exact authorization', async () => {
  const fixture = await makeFixture();
  const result = runValidator(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /SENTINEL Base Mainnet authorization: PASS/);
});
test('read-only SENTINEL authorization validator rejects an expired authorization', async () => {
  const fixture = await makeFixture({ expiresAt: new Date(Date.now() - 60 * 1000).toISOString() });
  const result = runValidator(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expired or malformed/);
});

test('read-only SENTINEL authorization validator rejects a commit mismatch', async () => {
  const fixture = await makeFixture();
  const result = runValidator(fixture, 'b'.repeat(40));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /commit does not match/);
});

test('read-only SENTINEL authorization validator rejects a manifest digest mismatch', async () => {
  const fixture = await makeFixture();
  writeFileSync(fixture.manifestPath, JSON.stringify({ changed: true }, null, 2) + '\n');
  const result = runValidator(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /manifest digest does not match/);
});

test('release policy suite includes the SENTINEL mainnet workflow regressions', () => {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(
    packageJson.scripts['test:release:policy'],
    /test\/sentinel-mainnet-workflow\.test\.cjs/,
    'npm run test:release:policy must execute the SENTINEL mainnet workflow regressions'
  );
});

test('SENTINEL readiness validates the protected deployment signer before authorization', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const signerIndex = workflow.indexOf('validate-sentinel-mainnet-signer.mjs');
  const authIndex = workflow.indexOf('validate-sentinel-mainnet-authorization.mjs');
  assert.match(
    workflow,
    /sentinel_redeployment_readiness:[\s\S]*DEPLOYER_PRIVATE_KEY: \$\{\{ secrets\.DEPLOYER_PRIVATE_KEY \}\}/
  );
  assert.ok(signerIndex >= 0, 'workflow must validate the protected deployment signer');
  assert.ok(
    authIndex > signerIndex,
    'signer identity must be checked before authorization validity'
  );
});

test('read-only signer validator accepts a protected key matching the authorized sender', async () => {
  const fixture = await makeFixture();
  const result = spawnSync(process.execPath, [SIGNER_VALIDATOR], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      DEPLOYER_PRIVATE_KEY: fixture.wallet.privateKey,
      SENTINEL_MAINNET_AUTHORIZATION: fixture.authorizationPath,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Protected SENTINEL deployer signer: PASS/);
});

test('read-only signer validator rejects a protected key for a different sender', async () => {
  const fixture = await makeFixture();
  const other = Wallet.createRandom();
  const result = spawnSync(process.execPath, [SIGNER_VALIDATOR], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      DEPLOYER_PRIVATE_KEY: other.privateKey,
      SENTINEL_MAINNET_AUTHORIZATION: fixture.authorizationPath,
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match authorized sender/);
});

test('executor enforces signer balance reserve before broadcast', () => {
  const executor = readFileSync(EXECUTOR, 'utf8');
  assert.match(
    executor,
    /^\s*if \(balanceBefore < estimatedMaxGasCostWei \+ BigInt\(execution\.valueWei\)\) \{/m,
    'executor must fail closed when signer balance cannot cover the authorized reserve'
  );
});
test('read-only signer validator normalizes protected key formatting safely', async () => {
  const fixture = await makeFixture();
  const rawKey = fixture.wallet.privateKey.slice(2);
  const variants = [rawKey, ` ${rawKey} `, `\"${rawKey}\"`, `\uFEFF'${rawKey}'`];

  for (const protectedKey of variants) {
    const result = spawnSync(process.execPath, [SIGNER_VALIDATOR], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        DEPLOYER_PRIVATE_KEY: protectedKey,
        SENTINEL_MAINNET_AUTHORIZATION: fixture.authorizationPath,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Protected SENTINEL deployer signer: PASS/);
  }
});
test('executor normalizes protected deployment key formatting before validation', () => {
  const executor = readFileSync(EXECUTOR, 'utf8');
  assert.match(executor, /function normalizePrivateKey\(value\)/);
  assert.match(
    executor,
    /const protectedDeploymentKey = normalizePrivateKey\(process\.env\.DEPLOYER_PRIVATE_KEY\);/
  );
});


test('signer validator accepts historical JSON and assignment key wrappers', async () => {
  const fixture = await makeFixture();
  const rawKey = fixture.wallet.privateKey.slice(2);
  const variants = [
    JSON.stringify({ DEPLOYER_PRIVATE_KEY: rawKey }),
    JSON.stringify({ privateKey: rawKey }),
    `DEPLOYER_PRIVATE_KEY=${rawKey}`,
    `export PRIVATE_KEY='${rawKey}'`,
  ];
  for (const protectedKey of variants) {
    const result = spawnSync(process.execPath, [SIGNER_VALIDATOR], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, DEPLOYER_PRIVATE_KEY: protectedKey, SENTINEL_MAINNET_AUTHORIZATION: fixture.authorizationPath } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test('SENTINEL mainnet workflow falls back to RPC_URL and validates Base chain id before authorization', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  assert.match(workflow, /BASE_MAINNET_RPC_URL: \$\{\{ secrets\.BASE_MAINNET_RPC_URL \|\| secrets\.RPC_URL \}\}/);
  const rpcIndex = workflow.indexOf('validate-sentinel-mainnet-rpc.mjs');
  const authIndex = workflow.indexOf('validate-sentinel-mainnet-authorization.mjs');
  assert.ok(rpcIndex >= 0 && authIndex > rpcIndex);
  assert.ok(readFileSync(RPC_VALIDATOR, 'utf8').includes('8453'));
});
