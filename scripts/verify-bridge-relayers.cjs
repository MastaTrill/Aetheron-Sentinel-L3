const { ethers } = require('ethers');
const fs = require('fs');
const vm = require('vm');

function resolveRpcUrl() {
  const fallback = 'https://ethereum-sepolia-rpc.publicnode.com';
  const raw = (process.env.SEPOLIA_RPC_URL || '').trim();
  if (!raw) return fallback;

  // Ignore template placeholders from .env.example and use a known-good public RPC.
  const lower = raw.toLowerCase();
  if (
    lower.includes('your_sepolia_rpc_url') ||
    lower.includes('your_infura_key') ||
    lower.includes('your_')
  ) {
    return fallback;
  }

  return raw;
}

const RPC = resolveRpcUrl();

function parseAddressList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((addr) => ethers.getAddress(addr));
}

(async function main() {
  const relayers = parseAddressList(process.env.RELAYER_ADDRESSES || '');
  if (relayers.length === 0) {
    console.error(
      'No relayers provided. Set RELAYER_ADDRESSES as comma-separated addresses.',
    );
    process.exit(1);
  }

  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('site/contracts.js', 'utf8'), ctx);
  const contracts = ctx.window.SENTINEL_CONTRACTS;
  const bridgeAddr = contracts.AetheronBridge?.address;

  if (!bridgeAddr) {
    console.error('Missing AetheronBridge address in site/contracts.js');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const bridge = new ethers.Contract(
    bridgeAddr,
    [
      'function RELAYER_ROLE() view returns (bytes32)',
      'function hasRole(bytes32 role, address account) view returns (bool)',
    ],
    provider,
  );

  const role = await bridge.RELAYER_ROLE();
  console.log(`Bridge: ${bridgeAddr}`);
  console.log(`RELAYER_ROLE: ${role}`);

  let ok = true;
  for (const relayer of relayers) {
    const has = await bridge.hasRole(role, relayer);
    console.log(`${has ? 'PASS' : 'FAIL'} ${relayer} relayer=${has}`);
    if (!has) ok = false;
  }

  if (!ok) process.exit(1);
})();
