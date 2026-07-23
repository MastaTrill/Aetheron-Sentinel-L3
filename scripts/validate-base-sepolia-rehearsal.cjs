const crypto = require('node:crypto');
const fs = require('node:fs');
const {
  assertSuccessfulRehearsalRun,
  parseVerifiedManifest,
} = require('./lib/base-sepolia-rehearsal.cjs');
const { githubJson } = require('./lib/github-api.cjs');

function appendActionValue(filePath, name, value) {
  if (filePath) fs.appendFileSync(filePath, `${name}=${value}\n`, { encoding: 'utf8' });
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const releaseCommit = process.env.RELEASE_COMMIT;
  const runId = process.env.BASE_SEPOLIA_RUN_ID;
  const manifestPath = process.env.BASE_SEPOLIA_MANIFEST_PATH;

  const run = await githubJson(
    repository,
    token,
    `/actions/runs/${encodeURIComponent(runId || '')}`,
    'Cannot load the Base Sepolia workflow run'
  );
  assertSuccessfulRehearsalRun(run, runId, releaseCommit);

  if (!manifestPath || !fs.existsSync(manifestPath)) {
    throw new Error('Downloaded Base Sepolia deployment manifest is missing');
  }
  const manifestBytes = fs.readFileSync(manifestPath);
  const { manifest } = parseVerifiedManifest(manifestBytes, releaseCommit);
  const manifestSha256 = crypto.createHash('sha256').update(manifestBytes).digest('hex');

  appendActionValue(process.env.GITHUB_OUTPUT, 'manifest_sha256', manifestSha256);
  appendActionValue(process.env.GITHUB_ENV, 'BASE_SEPOLIA_MANIFEST_SHA256', manifestSha256);

  console.log('BASE SEPOLIA REHEARSAL: PASS');
  console.log(`Workflow run: ${run.html_url}`);
  console.log(`Release commit: ${manifest.releaseCommit}`);
  console.log(`Manifest SHA-256: ${manifestSha256}`);
}

main().catch(error => {
  console.error('BASE SEPOLIA REHEARSAL: FAIL');
  console.error(error.message);
  process.exitCode = 1;
});
