const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/base-sepolia-pipeline.yml');

test('Base Sepolia deploy writes a run-specific immutable deployment manifest', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

  assert.match(
    workflow,
    /^\s{6}DEPLOYMENT_MANIFEST_PATH:\s*deployments\/baseSepolia-sentinel-guardrails-v1-\$\{\{\s*github\.run_id\s*\}\}\.json\s*$/m,
    'deploy job must override the legacy manifest with a run-specific evidence file'
  );
  assert.match(
    workflow,
    /^\s{12}\$\{\{\s*env\.DEPLOYMENT_MANIFEST_PATH\s*\}\}\s*$/m,
    'deployment artifact upload must preserve the exact run-specific manifest'
  );
  assert.doesNotMatch(
    workflow,
    /^\s{12}deployments\/baseSepolia-sentinel-guardrails-v1\.json\s*$/m,
    'deploy artifact upload must not treat the preserved legacy manifest as the new deployment evidence'
  );
});
