import { expect } from 'chai';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(
  repositoryRoot,
  'release-evidence/sentinel-mainnet/redeployment-closure.json'
);
const deploymentManifestPath = path.join(
  repositoryRoot,
  'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json'
);

function validate(
  mode,
  mutate = manifest => manifest,
  evidenceOverrides = {}
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sentinel-redeployment-'));
  const candidatePath = path.join(directory, 'release-closure.json');
  const manifest = mutate(JSON.parse(readFileSync(manifestPath, 'utf8')));
  writeFileSync(candidatePath, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [relativePath, evidence] of Object.entries(evidenceOverrides)) {
    const evidencePath = path.join(directory, relativePath);
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    const content =
      typeof evidence === 'string' ? evidence : `${JSON.stringify(evidence, null, 2)}\n`;
    writeFileSync(evidencePath, content);
  }
  const result = spawnSync(
    process.execPath,
    ['scripts/validate-sentinel-redeployment-closure.mjs', `--mode=${mode}`],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        SENTINEL_REDEPLOYMENT_CLOSURE_MANIFEST: candidatePath,
        SENTINEL_REDEPLOYMENT_EVIDENCE_ROOT:
          Object.keys(evidenceOverrides).length > 0 ? directory : repositoryRoot,
      },
      encoding: 'utf8',
    }
  );
  rmSync(directory, { recursive: true, force: true });
  return result;
}

function completeOnly(manifest, name, evidencePath) {
  for (const gate of Object.values(manifest.gates)) {
    gate.status = 'pending';
    gate.evidence = [];
  }
  manifest.gates[name] = {
    status: 'complete',
    evidence: [evidencePath],
  };
  return manifest;
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
    expect(readiness.stdout).to.match(/Complete gates: \d\/9/);

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


  it('rejects a completed deployment-manifest gate when the evidence digest changes', function () {
    const evidencePath =
      'release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
    const evidence = JSON.parse(readFileSync(deploymentManifestPath, 'utf8'));
    evidence.token.name = 'UNREVIEWED';
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'exactDeploymentManifest', evidencePath),
      { [evidencePath]: evidence }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('exactDeploymentManifest: evidence file digest mismatch');
  });

  it('rejects placeholder content even when a completed gate names the expected file', function () {
    const evidencePath =
      'release-evidence/sentinel-mainnet/redeployment/authority-beneficiary-verification.json';
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'authorityAndBeneficiaryVerification', evidencePath),
      {
        [evidencePath]: {
          schemaVersion: 1,
          status: 'verified',
          verifiedAtUtc: '2026-08-01T20:00:00Z',
          network: { name: 'Base Mainnet', chainId: 8453 },
          verifications: {
            tokenOwner: {
              address: '0x1111111111111111111111111111111111111111',
              expectedOwner: '0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12',
              actualOwner: 'REPLACE_WITH_ONCHAIN_OWNER',
              reachabilityTestPassed: true,
            },
            poolCreatorBeneficiary: {
              poolId: `0x${'1'.repeat(64)}`,
              expectedBeneficiary: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
              actualBeneficiary: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
              shareWad: '570000000000000000',
              reachabilityTestPassed: true,
            },
            timelockConsequences: {
              expectedAdmin: '0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994',
              actualAdmin: '0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994',
              consequencesApproved: true,
            },
          },
        },
      }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('evidence contains placeholder or template values');
  });

  it('rejects an independent signoff whose rehearsal digest does not match the evidence', function () {
    const signoffPath =
      'release-evidence/sentinel-mainnet/redeployment/independent-security-signoff.json';
    const rehearsalPath =
      'release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json';
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'independentSecuritySignoff', signoffPath),
      {
        [rehearsalPath]: {
          schemaVersion: 1,
          request: { sourceCommit: '2222222222222222222222222222222222222222' },
        },
        [signoffPath]: {
          schemaVersion: 1,
          status: 'approved',
          reviewer: {
            nameOrOrganization: 'Independent Reviewer LLC',
            professionalIdentity: 'https://example.com/reviewer',
            contact: 'reviewer@example.com',
            independenceStatement:
              'I did not prepare the release or control any deployment or beneficiary wallet.',
          },
          review: {
            reviewedAtUtc: '2026-08-01T20:00:00Z',
            commit: '1111111111111111111111111111111111111111',
            deploymentManifestSha256:
              'f727b14201ec419518a683f329b0797b98764daec7f7cdbc6ccd3d0d83423e1d',
            baseSepoliaRehearsalSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            rehearsalSourceCommit: '2222222222222222222222222222222222222222',
            reproductionMethods: ['Independent compile and RPC receipt reproduction'],
            conclusion: 'approve',
            approvalReference: 'https://example.com/public-review',
          },
          requiredAssertions: {
            creatorBeneficiary: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
            creatorShareWad: '570000000000000000',
            legacyTokenExcluded: '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3',
            materialClaimsReproduced: true,
          },
        },
      }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include(
      'baseSepoliaRehearsalSha256 must equal the reviewed evidence digest'
    );
  });


  it('rejects a signoff that names a different rehearsal source commit', function () {
    const signoffPath =
      'release-evidence/sentinel-mainnet/redeployment/independent-security-signoff.json';
    const rehearsalPath =
      'release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json';
    const rehearsalRaw = `${JSON.stringify(
      {
        schemaVersion: 1,
        request: { sourceCommit: '2222222222222222222222222222222222222222' },
      },
      null,
      2
    )}\n`;
    const rehearsalDigest = createHash('sha256').update(rehearsalRaw).digest('hex');
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'independentSecuritySignoff', signoffPath),
      {
        [rehearsalPath]: rehearsalRaw,
        [signoffPath]: {
          schemaVersion: 1,
          status: 'approved',
          reviewer: {
            nameOrOrganization: 'Independent Reviewer LLC',
            professionalIdentity: 'https://example.com/reviewer',
            contact: 'reviewer@example.com',
            independenceStatement:
              'I did not prepare the release or control any deployment or beneficiary wallet.',
          },
          review: {
            reviewedAtUtc: '2026-08-01T20:00:00Z',
            commit: '1111111111111111111111111111111111111111',
            rehearsalSourceCommit: '3333333333333333333333333333333333333333',
            deploymentManifestSha256:
              'f727b14201ec419518a683f329b0797b98764daec7f7cdbc6ccd3d0d83423e1d',
            baseSepoliaRehearsalSha256: rehearsalDigest,
            reproductionMethods: ['Independent compile and RPC receipt reproduction'],
            conclusion: 'approve',
            approvalReference: 'https://example.com/public-review',
          },
          requiredAssertions: {
            creatorBeneficiary: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
            creatorShareWad: '570000000000000000',
            legacyTokenExcluded: '0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3',
            materialClaimsReproduced: true,
          },
        },
      }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include(
      'rehearsalSourceCommit must equal the rehearsal sourceCommit'
    );
  });

  it('rejects malformed cryptographic Mainnet authorization', function () {
    const authorizationPath =
      'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'explicitMainnetAuthorization', authorizationPath),
      {
        'release-evidence/sentinel-mainnet/redeployment/independent-security-signoff.json': {
          review: { commit: '1111111111111111111111111111111111111111' },
        },
        [authorizationPath]: {
          schemaVersion: 1,
          status: 'authorized',
          confirmation: 'AUTHORIZE_SENTINEL_BASE_MAINNET_BROADCAST',
          chainId: 8453,
          limitations: {
            maxGasCostWei: '10000000000000000',
            expiresAt: '2099-12-31T23:59:59.000Z',
          },
          approvedManifest: {
            sha256: 'f727b14201ec419518a683f329b0797b98764daec7f7cdbc6ccd3d0d83423e1d',
          },
          authorization: {
            authorizedSender: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
            authorizedAtUtc: '2026-08-01T20:00:00Z',
            authorizedCommit: '1111111111111111111111111111111111111111',
            reference: 'https://example.com/public-authorization',
            method: 'cryptographic-signature',
            signature: '0x1234',
          },
        },
      }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('cryptographic signature must be 65 bytes');
  });

  it('rejects a fabricated 65-byte Mainnet authorization signature', function () {
    const authorizationPath =
      'release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json';
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'explicitMainnetAuthorization', authorizationPath),
      {
        'release-evidence/sentinel-mainnet/redeployment/independent-security-signoff.json': {
          review: { commit: '1111111111111111111111111111111111111111' },
        },
        [authorizationPath]: {
          schemaVersion: 1,
          status: 'authorized',
          confirmation: 'AUTHORIZE_SENTINEL_BASE_MAINNET_BROADCAST',
          chainId: 8453,
          limitations: {
            maxGasCostWei: '10000000000000000',
            expiresAt: '2099-12-31T23:59:59.000Z',
          },
          approvedManifest: {
            sha256: 'f727b14201ec419518a683f329b0797b98764daec7f7cdbc6ccd3d0d83423e1d',
          },
          authorization: {
            authorizedSender: '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa',
            authorizedAtUtc: '2026-08-01T20:00:00Z',
            authorizedCommit: '1111111111111111111111111111111111111111',
            reference: 'https://example.com/public-authorization',
            method: 'cryptographic-signature',
            signature: `0x${'11'.repeat(65)}`,
          },
        },
      }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.match(
      /signature (does not recover authorizedSender|could not be cryptographically verified)/
    );
  });

  it('rejects empty Base Mainnet deployment evidence', function () {
    const evidencePath =
      'release-evidence/sentinel-mainnet/redeployment/deployment-receipt.json';
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'baseMainnetDeployment', evidencePath),
      { [evidencePath]: {} }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include(
      'baseMainnetDeployment: confirmed Base Mainnet evidence is required'
    );
  });

  it('rejects empty authorized smoke-test evidence', function () {
    const authorizationPath =
      'release-evidence/sentinel-mainnet/redeployment/smoke-test-authorization.json';
    const receiptsPath =
      'release-evidence/sentinel-mainnet/redeployment/smoke-test-receipts.json';
    const result = validate(
      'readiness',
      manifest => {
        for (const gate of Object.values(manifest.gates)) {
          gate.status = 'pending';
          gate.evidence = [];
        }
        manifest.gates.authorizedBuySellSmokeTest = {
          status: 'complete',
          evidence: [authorizationPath, receiptsPath],
        };
        return manifest;
      },
      { [authorizationPath]: {}, [receiptsPath]: {} }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include(
      'authorizedBuySellSmokeTest: exact smoke-test authorization is required'
    );
  });

  it('rejects malformed immutable evidence checksums', function () {
    const evidencePath =
      'release-evidence/sentinel-mainnet/redeployment/SHA256SUMS';
    const result = validate(
      'readiness',
      manifest => completeOnly(manifest, 'immutableEvidencePackage', evidencePath),
      { [evidencePath]: 'not-a-checksum\n' }
    );
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.include('immutableEvidencePackage: invalid SHA256SUMS line');
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
