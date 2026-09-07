const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { assertSuccessfulRehearsalRun } = require('../scripts/lib/base-sepolia-rehearsal.cjs');

const ROOT = path.resolve(__dirname, '..');
const AUDITED_RELEASE = 'f165e345f6909ffb8c3d9eab1f152aa5bd23e97b';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('Hardhat deploy compiler declaration matches the locked local solc package', () => {
  const pkg = JSON.parse(read('package.json'));
  const config = read('hardhat.config.js');

  assert.equal(pkg.devDependencies.solc, '0.8.36');
  assert.match(config, /version:\s*'0\.8\.36'/);
  assert.match(config, /path:\s*LOCAL_SOLC_PATH/);
});

test('explorer source verification fails closed instead of swallowing errors', () => {
  const verifier = read('deploy/verify-mainnet.ts');

  assert.doesNotMatch(verifier, /\[WARN\] Explorer verification/);
  assert.match(verifier, /throw verifyError;/);
  assert.match(verifier, /Explorer source verification complete\./);
});

test('Base Sepolia pinned release declares its actual locked compiler before build and deploy', () => {
  const workflow = read('.github/workflows/base-sepolia-pipeline.yml');
  const alignmentSteps = workflow.match(/name:\s*Align pinned release compiler declaration/g) || [];

  assert.equal(alignmentSteps.length, 2, 'readiness and deploy must both align compiler metadata');
  assert.match(workflow, /EXPECTED_SOLC_VERSION:\s*'0\.8\.36'/);
  assert.match(workflow, new RegExp(`RELEASE_COMMIT:\\s*${AUDITED_RELEASE}`));
});

test('existing Base Sepolia deployment source verification is isolated and non-broadcasting', () => {
  const workflow = read('.github/workflows/base-sepolia-source-verification.yml');

  assert.match(workflow, /deployment_run_id:/);
  assert.match(workflow, new RegExp(`RELEASE_COMMIT:\\s*${AUDITED_RELEASE}`));
  assert.match(workflow, /EXPECTED_SOLC_VERSION:\s*'0\.8\.36'/);
  assert.match(workflow, /environment:\s*base-sepolia/);
  assert.match(workflow, /base-sepolia-deployment-\$\{\{\s*inputs\.deployment_run_id\s*\}\}/);
  assert.match(
    workflow,
    /baseSepolia-sentinel-guardrails-v1-\$\{\{\s*inputs\.deployment_run_id\s*\}\}\.json/
  );
  assert.doesNotMatch(workflow, /deploy:base-sepolia|DEPLOY_BASE_SEPOLIA|DEPLOY_CONFIRMATION/);
});

test('mainnet readiness consumes the run-specific Base Sepolia manifest', () => {
  const workflow = read('.github/workflows/mainnet-pipeline.yml');

  assert.match(
    workflow,
    /BASE_SEPOLIA_MANIFEST_PATH:\s*\/tmp\/base-sepolia-rehearsal\/deployments\/baseSepolia-sentinel-guardrails-v1-\$\{\{\s*inputs\.base_sepolia_run_id\s*\}\}\.json/
  );
});

test('mainnet rehearsal validation trusts the verified manifest for release identity', () => {
  const run = {
    id: 34138747671,
    path: '.github/workflows/base-sepolia-pipeline.yml',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    head_sha: 'f74439ebd16cabef08f9a7eeddc064400374156d',
  };

  assert.doesNotThrow(() => assertSuccessfulRehearsalRun(run, '34138747671'));
  assert.throws(
    () => assertSuccessfulRehearsalRun({ ...run, head_sha: 'not-a-commit' }, '34138747671'),
    /head SHA is invalid/
  );

  const validator = read('scripts/validate-base-sepolia-rehearsal.cjs');
  assert.match(validator, /assertSuccessfulRehearsalRun\(run, runId\);/);
  assert.doesNotMatch(validator, /assertSuccessfulRehearsalRun\(run, runId, releaseCommit\)/);
});
