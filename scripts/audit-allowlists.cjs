/**
 * Allowlist audit for Aetheron Sentinel L3 (Sepolia)
 * Queries RoleGranted/RoleRevoked events to reconstruct live role members for:
 *   - AetheronBridge:      RELAYER_ROLE
 *   - RateLimiter:         CALLER_ROLE
 *   - CircuitBreaker:      MONITOR_ROLE
 *   - SentinelInterceptor: OPERATOR_ROLE, MONITOR_ROLE
 */
const { ethers } = require('ethers');
const fs = require('fs');
const vm = require('vm');

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

// Known expected principals
const KNOWN = {
  '0xa1b9cf0f48f815ce80ed2ab203fa7c0c8299a0fb': 'ownerEOA',
  '0xcdcd79e3336d2e5f5045fb4ecd7b9d43395ba994': 'multiSigVault',
  '0x38427f04abd2a9d938674a41c6dbf592e6e953f0': 'governance',
  '0x670f79bfe0829e491ab0c41a7a93b1e56a09f2a0': 'timelock',
  // Deployed contracts (loaded from site/contracts.js below)
};

// Populate KNOWN from contracts.js at runtime (called after ctx is set up)
function populateKnownContracts(c) {
  for (const [name, entry] of Object.entries(c)) {
    if (entry && entry.address) {
      KNOWN[entry.address.toLowerCase()] = name;
    }
  }
}

// Role preimages
const ROLES = {
  RELAYER_ROLE: ethers.id('RELAYER_ROLE'),
  CALLER_ROLE: ethers.id('CALLER_ROLE'),
  MONITOR_ROLE: ethers.id('MONITOR_ROLE'),
  OPERATOR_ROLE: ethers.id('OPERATOR_ROLE'),
};

// RoleGranted / RoleRevoked topic
const ROLE_GRANTED = ethers.id('RoleGranted(bytes32,address,address)');
const ROLE_REVOKED = ethers.id('RoleRevoked(bytes32,address,address)');

async function getRoleMembers(
  provider,
  contractAddress,
  roleHash,
  fromBlock,
  toBlock,
) {
  const granted = await provider.getLogs({
    address: contractAddress,
    topics: [ROLE_GRANTED, roleHash],
    fromBlock,
    toBlock,
  });
  const revoked = await provider.getLogs({
    address: contractAddress,
    topics: [ROLE_REVOKED, roleHash],
    fromBlock,
    toBlock,
  });

  const members = new Set();
  for (const log of granted) {
    // account is topics[2] (address padded to 32 bytes)
    const account = ethers.getAddress('0x' + log.topics[2].slice(26));
    members.add(account.toLowerCase());
  }
  for (const log of revoked) {
    const account = ethers.getAddress('0x' + log.topics[2].slice(26));
    members.delete(account.toLowerCase());
  }
  return [...members];
}

function label(addr) {
  const k = KNOWN[addr.toLowerCase()];
  return k ? `${addr} (${k})` : `${addr} *** UNKNOWN ***`;
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);

  // Load addresses from site/contracts.js
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('site/contracts.js', 'utf8'), ctx);
  const c = ctx.window.SENTINEL_CONTRACTS;

  populateKnownContracts(c);

  const TO_BLOCK = await provider.getBlockNumber();
  console.log(`Audit at block ${TO_BLOCK}\n`);

  const targets = [
    {
      name: 'AetheronBridge',
      address: c.AetheronBridge.address,
      fromBlock: 10707539,
      roles: [{ name: 'RELAYER_ROLE', hash: ROLES.RELAYER_ROLE }],
    },
    {
      name: 'RateLimiter',
      address: c.RateLimiter.address,
      fromBlock: 10707542,
      roles: [{ name: 'CALLER_ROLE', hash: ROLES.CALLER_ROLE }],
    },
    {
      name: 'CircuitBreaker',
      address: c.CircuitBreaker.address,
      fromBlock: 10707541,
      roles: [{ name: 'MONITOR_ROLE', hash: ROLES.MONITOR_ROLE }],
    },
    {
      name: 'SentinelInterceptor',
      address: c.SentinelInterceptor.address,
      fromBlock: 10707540,
      roles: [
        { name: 'OPERATOR_ROLE', hash: ROLES.OPERATOR_ROLE },
        { name: 'MONITOR_ROLE', hash: ROLES.MONITOR_ROLE },
      ],
    },
  ];

  let allClear = true;

  for (const target of targets) {
    console.log(`=== ${target.name} (${target.address}) ===`);
    for (const role of target.roles) {
      const members = await getRoleMembers(
        provider,
        target.address,
        role.hash,
        target.fromBlock,
        TO_BLOCK,
      );
      const unknowns = members.filter((m) => !KNOWN[m.toLowerCase()]);
      if (unknowns.length) allClear = false;

      console.log(`  ${role.name}:`);
      if (members.length === 0) {
        console.log('    (no members)');
      } else {
        for (const m of members) {
          const flag = KNOWN[m.toLowerCase()] ? '  OK' : '  *** UNKNOWN ***';
          console.log(`    ${flag}  ${label(m)}`);
        }
      }
    }
    console.log();
  }

  if (allClear) {
    console.log(
      'RESULT: All role members are known principals. No unexpected addresses found.',
    );
  } else {
    console.log(
      'RESULT: *** UNKNOWN addresses found in allowlists — review required. ***',
    );
    process.exit(1);
  }
})();
