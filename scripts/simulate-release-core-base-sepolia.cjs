#!/usr/bin/env node
/**
 * simulate-release-core-base-sepolia.cjs
 *
 * Local simulation harness for the guarded Base Sepolia release-core deployment.
 * Spins up a Hardhat in-process fork (no real ETH spent) and executes the full
 * deploy → verify pipeline, producing a labeled simulation manifest.
 *
 * Usage:
 *   node scripts/simulate-release-core-base-sepolia.cjs
 *
 * Or via npm:
 *   npm run mainnet:simulate
 *
 * Env vars (load from .env.basesepolia or set directly):
 *   BASE_TESTNET_RPC_URL   — Base Sepolia RPC used as the fork origin
 *   SENTINEL_OWNER         — owner address (any non-zero EOA for simulation)
 *   MONITOR_ADDRESSES      — comma-separated list of monitor addresses
 *
 * The simulation runs against chainId 31337 (Hardhat), so no gas is consumed.
 * The manifest is written to /tmp/sentinel-guardrails-simulation.json and is
 * clearly labeled with mode: "local-simulation".
 */

'use strict';

const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');

// Load .env.basesepolia if it exists (lower precedence than shell env).
const dotenvPath = path.resolve(__dirname, '..', '.env.basesepolia');
if (fs.existsSync(dotenvPath)) {
  const lines = fs.readFileSync(dotenvPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}

const SIMULATION_MANIFEST = '/tmp/sentinel-guardrails-simulation.json';
const ROOT = path.resolve(__dirname, '..');

// Resolve sensible defaults for simulation.
const owner = process.env.SENTINEL_OWNER || process.env.OWNER_ADDRESS || '';
const monitors = process.env.MONITOR_ADDRESSES || '';

// For a simulation, if owner / monitors are not set or are zero-address,
// we inject synthetic test values so the script can be run without a real wallet.
const ZERO = '0x0000000000000000000000000000000000000000';
const simulationOwner = (owner && owner !== ZERO) ? owner : '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Account 1
const simulationMonitor = (monitors && !monitors.includes(ZERO))
  ? monitors
  : '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // Account 2
const simulationDeployer = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478';

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  Sentinel Guardrails — Base Sepolia Local Simulation ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');
console.log(`  Simulation owner   : ${simulationOwner}`);
console.log(`  Monitor addresses  : ${simulationMonitor}`);
console.log(`  Output manifest    : ${SIMULATION_MANIFEST}`);
console.log('');
console.log('Running deploy-release-core.cjs on Hardhat (chainId 31337)…');
console.log('');

// Environment for the subprocess.
const env = {
  ...process.env,
  // Override for simulation — Hardhat provides these accounts with fake ETH.
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || simulationDeployer,
  SENTINEL_OWNER: simulationOwner,
  MONITOR_ADDRESSES: simulationMonitor,
  DEPLOYMENT_MANIFEST_PATH: SIMULATION_MANIFEST,
  ALLOW_MANIFEST_OVERWRITE: 'true',
  // No confirmation token required for chainId 31337
  DEPLOY_CONFIRMATION: '',
  RELEASE_COMMIT: '',
};

console.log('Starting local Hardhat node in background...');
const nodeProcess = spawn('npx', ['hardhat', 'node'], {
  cwd: ROOT,
  env,
  shell: true,
});

// Wait briefly for node to start up
spawnSync('node', ['-e', 'setTimeout(()=>{}, 3000)']);

try {
  console.log('Running deploy-release-core.cjs on localhost…\n');
  const deployResult = spawnSync(
    'npx',
    ['hardhat', 'run', path.join(ROOT, 'scripts', 'deploy-release-core.cjs'), '--network', 'localhost'],
    { cwd: ROOT, env, stdio: 'inherit', shell: true }
  );

  if (deployResult.status !== 0) {
    console.error('\n✖  SIMULATION DEPLOY FAILED');
    process.exit(1);
  }

  console.log('\nRunning verify-release-core.cjs on localhost…\n');
  const verifyResult = spawnSync(
    'npx',
    ['hardhat', 'run', path.join(ROOT, 'scripts', 'verify-release-core.cjs'), '--network', 'localhost'],
    { cwd: ROOT, env: { ...env, DEPLOYMENT_MANIFEST_PATH: SIMULATION_MANIFEST }, stdio: 'inherit', shell: true }
  );

  if (verifyResult.status !== 0) {
    console.error('\n✖  SIMULATION VERIFY FAILED');
    process.exit(1);
  }
} finally {
  console.log('Killing Hardhat node...');
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', nodeProcess.pid, '/f', '/t']);
    } else {
      spawnSync('pkill', ['-f', 'hardhat']);
    }
  } catch (err) {
    // ignore kill errors
  }
}

// Annotate the manifest clearly as a simulation.
if (fs.existsSync(SIMULATION_MANIFEST)) {
  const manifest = JSON.parse(fs.readFileSync(SIMULATION_MANIFEST, 'utf8'));
  manifest._simulationMode = true;
  manifest._simulationNote =
    'This manifest was produced by a local Hardhat simulation (chainId 31337). ' +
    'It is NOT a real Base Sepolia broadcast. Contract addresses are fictional.';
  fs.writeFileSync(SIMULATION_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   SIMULATION COMPLETE — all invariants satisfied     ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');
console.log(`Simulation manifest written to: ${SIMULATION_MANIFEST}`);
console.log('');
console.log('Next step: trigger the guarded CI broadcast:');
console.log('  GitHub → Actions → "Sentinel Guardrails Base Sepolia Pipeline"');
console.log('  → Run workflow → broadcast: true → confirmation: DEPLOY_BASE_SEPOLIA');
