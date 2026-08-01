import { expect } from 'chai';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(
  repositoryRoot,
  'release-evidence/sentinel-mainnet/redeployment-closure.json'
);

function validate(mode, mutate = manifest => manifest) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sentinel-redeployment-'));
  const candidatePath = path.join(directory, 'release-closure.json');
  const manifest = mutate(JSON.parse(readFileSync(manifestPath, 'utf8')));
  writeFileSync(candidatePath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    ['scripts/validate-sentinel-redeployment-closure.mjs', `--mode=${mode}`],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        SENTINEL_REDEPLOYMENT_CLOSURE_MANIFEST: candidatePath,
      },
      encoding: 'utf8',
    }
  );
  rmSync(directory, { recursive: true, force: true });
  return result;
}

describe('SENTINEL controlled-redeployment closure', function () {
  it('passes the complete release-policy test suite', function () {
    this.timeout(120000);
    const result = spawnSync(
      process.execPath,
      [
        '--test',
        'test/github-environment.test.cjs',
        'test/release-evidence.test.cjs',
      ],
      { cwd: repositoryRoot, env: process.env, encoding: 'utf8', timeout: 110000 }
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).to.equal(0);
  });

  it('keeps the preserved legacy evidence structurally readable', function () {
    const result = spawnSync(
      process.execPath,
      ['scripts/validate-sentinel-release-closure.mjs', '--mode=readiness'],
      { cwd: repositoryRoot, env: process.env, encoding: 'utf8' }
    );
    expect(result.status, result.stderr).to.equal(0);
  });

  it('accepts preparation in readiness mode and blocks final mode', function () {
    const readiness = validate('readiness');
    expect(readiness.status, readiness.stderr).to.equal(0);
    expect(readiness.stdout).to.include('Complete gates: 1/9');

    const final = validate('final');
    expect(final.status).to.not.equal(0);
    expect(final.stderr).to.include('final mode requires a deployed replacement');
    expect(final.stderr).to.include('final mode requires every gate complete');
  });

  it('rejects any replacement Creator beneficiary other than the Aetheron treasury', function () {
    const result = validate('readiness', manifest => {
      manifest.replacementDeployment.creatorBeneficiary =
        '0x1111111111111111111111111111111111111111';
      return manifest;
    });
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('must be the established Aetheron treasury');
  });

  it('rejects attempts to rewrite the preserved legacy beneficiary evidence', function () {
    const result = validate('readiness', manifest => {
      manifest.legacyDeployment.currentCreatorBeneficiary =
        '0x1111111111111111111111111111111111111111';
      return manifest;
    });
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('legacy beneficiary evidence changed');
  });

  it('locks the exact approved ADR and required retirement evidence', function () {
    const result = validate('readiness', manifest => {
      manifest.decision = 'docs/decisions/UNAPPROVED.md';
      manifest.requiredEvidenceFiles = [];
      return manifest;
    });
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('decision must remain');
    expect(result.stderr).to.include('requiredEvidenceFiles must include');
  });

  it('rejects zero pool and deployment transaction hashes', function () {
    const result = validate('readiness', manifest => {
      manifest.replacementDeployment = {
        ...manifest.replacementDeployment,
        status: 'deployed',
        token: '0x1111111111111111111111111111111111111111',
        initializer: '0x2222222222222222222222222222222222222222',
        poolId: `0x${'0'.repeat(64)}`,
        deploymentTransactionHash: `0x${'0'.repeat(64)}`,
      };
      return manifest;
    });
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('replacement poolId must be a nonzero 32-byte hash');
    expect(result.stderr).to.include(
      'replacement deploymentTransactionHash must be a nonzero 32-byte hash'
    );
  });

  it('rejects arbitrary files as completed-gate evidence', function () {
    const result = validate('readiness', manifest => {
      manifest.gates.exactDeploymentManifest = {
        status: 'complete',
        evidence: [
          'docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md',
        ],
      };
      return manifest;
    });
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include(
      'exactDeploymentManifest: evidence must include release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json'
    );
  });
});

describe('SENTINEL beneficiary-remediation preflight safety', function () {
  it('rejects an RPC timeout below the fail-closed minimum before contacting providers', function () {
    const result = spawnSync(
      process.execPath,
      ['scripts/prepare-sentinel-beneficiary-remediation.mjs'],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          BASE_RPC_TIMEOUT_MS: '999',
          BASE_RPC_URLS: 'http://127.0.0.1:1,http://127.0.0.1:2',
        },
        encoding: 'utf8',
        timeout: 10000,
      }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include(
      'BASE_RPC_TIMEOUT_MS must be an integer of at least 1000 milliseconds'
    );
  });
});
