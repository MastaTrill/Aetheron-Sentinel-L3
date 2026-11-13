const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const CLOSURE = 'release-evidence/sentinel-mainnet/redeployment-closure.json';
const RPC_A = 'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-a.json';
const RPC_B = 'release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-b.json';
const AUTHORITY = 'release-evidence/sentinel-mainnet/redeployment/authority-beneficiary-verification.json';
const TOKEN = '0x1111111111111111111111111111111111111111';
const POOL = '0x' + '2'.repeat(64);
const AIRLOCK = '0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12';
const TREASURY = '0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa';

const BENEFICIARIES = [
  { role: 'doppler-protocol', beneficiary: '0x21E2ce70511e4FE542a97708e89520471DAa7A66', shares: '50000000000000000', verifiedShares: '50000000000000000' },
  { role: 'bankr-ecosystem', beneficiary: '0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1', shares: '19000000000000000', verifiedShares: '19000000000000000' },
  { role: 'aetheron-treasury', beneficiary: TREASURY, shares: '570000000000000000', verifiedShares: '570000000000000000' },
  { role: 'bankr-platform-integrator', beneficiary: '0xF60633D02690e2A15A54AB919925F3d038Df163e', shares: '361000000000000000', verifiedShares: '361000000000000000' },
];

function rpc(provider, endpoint) {
  return {
    schemaVersion: 1,
    status: 'verified',
    provider,
    endpoint,
    chainId: 8453,
    capturedAtUtc: '2026-11-06T00:00:00Z',
    blockNumber: 41000000,
    blockHash: '0x' + 'a'.repeat(64),
    token: {
      address: TOKEN,
      name: 'SENTINEL',
      symbol: 'SENTINEL',
      totalSupply: '100000000000000000000000000000',
      owner: AIRLOCK,
      runtimeCodeHash: '0x' + 'b'.repeat(64),
    },
    pool: {
      poolId: POOL,
      poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
      hook: '0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0',
      beneficiaries: structuredClone(BENEFICIARIES),
    },
  };
}

function validate(gate, files, customize = () => {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sentinel-evidence-coherence-'));
  try {
    const closure = JSON.parse(readFileSync(path.join(ROOT, CLOSURE), 'utf8'));
    closure.replacementDeployment = {
      ...closure.replacementDeployment,
      status: 'deployed',
      token: TOKEN,
      poolId: POOL,
      initializer: '0xD59cE43E53D69F190E15d9822Fb4540dCcc91178',
      deploymentTransactionHash: '0x' + '4'.repeat(64),
    };
    for (const value of Object.values(closure.gates)) {
      value.status = 'pending';
      value.evidence = [];
    }
    closure.gates[gate] = { status: 'complete', evidence: Object.keys(files) };
    customize(closure, files);
    const candidate = path.join(directory, 'closure.json');
    writeFileSync(candidate, JSON.stringify(closure));
    for (const [name, value] of Object.entries(files)) {
      const destination = path.join(directory, name);
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, JSON.stringify(value));
    }
    return spawnSync(process.execPath, [
      'scripts/validate-sentinel-redeployment-closure.mjs',
      '--mode=readiness',
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        SENTINEL_REDEPLOYMENT_CLOSURE_MANIFEST: candidate,
        SENTINEL_REDEPLOYMENT_EVIDENCE_ROOT: directory,
      },
      encoding: 'utf8',
      timeout: 10000,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function rpcPair() {
  return { [RPC_A]: rpc('Provider A', 'https://rpc-a.example.org'), [RPC_B]: rpc('Provider B', 'https://rpc-b.example.org') };
}

test('accepts mutually consistent, replacement-bound independent RPC captures', () => {
  const result = validate('independentRpcReproduction', rpcPair());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Complete gates: 1\/8/);
});

test('rejects unrelated token even if both RPC captures agree', () => {
  const result = validate('independentRpcReproduction', rpcPair(), (_closure, files) => {
    files[RPC_A].token.address = '0x5555555555555555555555555555555555555555';
    files[RPC_B].token.address = files[RPC_A].token.address;
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /token must match replacement token/);
});

test('rejects two providers with conflicting observed runtime bytecode', () => {
  const result = validate('independentRpcReproduction', rpcPair(), (_closure, files) => {
    files[RPC_B].token.runtimeCodeHash = '0x' + 'f'.repeat(64);
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /providers disagree on replacement state/);
});

test('rejects independent RPC captures at different blocks', () => {
  const result = validate('independentRpcReproduction', rpcPair(), (_closure, files) => {
    files[RPC_B].blockNumber += 1;
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /both providers must reproduce the same block/);
});

test('rejects incomplete beneficiary roster despite a correct 57% treasury', () => {
  const result = validate('independentRpcReproduction', rpcPair(), (_closure, files) => {
    files[RPC_A].pool.beneficiaries.pop();
    files[RPC_B].pool.beneficiaries.pop();
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must reproduce all four manifest beneficiaries/);
});

test('rejects authority verification pointing to a different token or pool', () => {
  const evidence = {
    schemaVersion: 1,
    status: 'verified',
    verifiedAtUtc: '2026-11-06T00:00:00Z',
    network: { name: 'Base Mainnet', chainId: 8453 },
    verifications: {
      tokenOwner: {
        address: '0x5555555555555555555555555555555555555555',
        expectedOwner: AIRLOCK,
        actualOwner: AIRLOCK,
        reachabilityTestPassed: true,
      },
      poolCreatorBeneficiary: {
        poolId: '0x' + '6'.repeat(64),
        expectedBeneficiary: TREASURY,
        actualBeneficiary: TREASURY,
        shareWad: '570000000000000000',
        reachabilityTestPassed: true,
      },
      timelockConsequences: {
        expectedAdmin: '0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994',
        actualAdmin: '0xcdcd79e3336D2e5f5045Fb4ecD7b9D43395BA994',
        consequencesApproved: true,
      },
    },
  };
  const result = validate('authorityAndBeneficiaryVerification', { [AUTHORITY]: evidence });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /token and owner must match the deployed replacement/);
  assert.match(result.stderr, /poolId must match replacement poolId/);
});
