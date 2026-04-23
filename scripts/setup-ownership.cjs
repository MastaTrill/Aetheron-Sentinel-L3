/**
 * Post-deploy ownership setup script for Sentinel L3.
 *
 * Executes all privileged configuration calls that must be made by SENTINEL_OWNER
 * after deployment (because the deployer is a different account).
 *
 * Usage:
 *   OWNER_PRIVATE_KEY=0x... npm run setup:ownership -- --network sepolia
 *
 * Required env vars:
 *   DEPLOYED_ADDRESSES  - JSON map printed by deploy.cjs
 *   OWNER_PRIVATE_KEY   - Private key of the SENTINEL_OWNER wallet
 *   SEPOLIA_RPC_URL     - (or MAINNET_RPC_URL, etc.)
 *
 * Optional env vars (same defaults as deploy.cjs):
 *   SENTINEL_OWNER, MONITOR_ADDRESSES, REPORTER_ADDRESSES,
 *   TRACKED_CHAIN_IDS, CHAIN_LIMITS, YIELD_TOKEN_ADDRESS, etc.
 */

require('dotenv').config();
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// ── helpers ───────────────────────────────────────────────────────────────────

function getNetworkName() {
  const idx = process.argv.indexOf('--network');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.HARDHAT_NETWORK || 'sepolia';
}

function getRpcUrl(network) {
  const map = {
    sepolia: process.env.SEPOLIA_RPC_URL,
    mainnet: process.env.MAINNET_RPC_URL,
    hoodi: process.env.HOODI_RPC_URL,
    baseSepolia: process.env.BASE_SEPOLIA_RPC_URL,
  };
  const url = map[network];
  if (!url) throw new Error(`No RPC URL configured for network: ${network}`);
  return url;
}

function parseAddressList(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseChainLimits(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [chainId, limit] = entry.split(':').map((p) => p.trim());
      return { chainId: BigInt(chainId), limit: ethers.parseEther(limit) };
    });
}

function loadAbi(contractName) {
  const abiPath = path.join(process.cwd(), 'abis', `${contractName}.json`);
  if (!fs.existsSync(abiPath)) {
    throw new Error(
      `ABI not found for ${contractName} at ${abiPath}. Run npm run export:abis first.`,
    );
  }
  return JSON.parse(fs.readFileSync(abiPath, 'utf8'));
}

function contract(name, address, signer) {
  return new ethers.Contract(address, loadAbi(name), signer);
}

async function call(label, fn) {
  process.stdout.write(`  ${label}... `);
  try {
    const tx = await fn();
    await tx.wait();
    console.log('✅');
  } catch (err) {
    const msg = err?.message || String(err);
    if (/already|granted|same/i.test(msg)) {
      console.log('ℹ️  already set');
    } else {
      console.error(`❌ FAILED: ${msg.split('\n')[0]}`);
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const rawAddresses = process.env.DEPLOYED_ADDRESSES;
  if (!rawAddresses) {
    throw new Error(
      'DEPLOYED_ADDRESSES env var is required.\n' +
        'Set it to the JSON output from deploy.cjs.',
    );
  }
  const addresses = JSON.parse(rawAddresses);

  const ownerKey = process.env.OWNER_PRIVATE_KEY;
  if (!ownerKey) {
    throw new Error(
      'OWNER_PRIVATE_KEY env var is required.\n' +
        'This must be the private key of the SENTINEL_OWNER wallet.',
    );
  }

  const network = getNetworkName();
  const provider = new ethers.JsonRpcProvider(getRpcUrl(network));
  const owner = new ethers.Wallet(ownerKey, provider);
  const ownerAddress = owner.address;

  const balance = await provider.getBalance(ownerAddress);
  console.log(`\nOwnership setup on network: ${network}`);
  console.log(`Owner wallet: ${ownerAddress}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error(
      'Owner wallet has no ETH for gas. Fund it before running setup.',
    );
  }

  // Config from env
  const monitors = parseAddressList(process.env.MONITOR_ADDRESSES);
  const reporters = parseAddressList(process.env.REPORTER_ADDRESSES);
  const securityReporters = parseAddressList(
    process.env.SECURITY_REPORTER_ADDRESSES,
  );
  const trackedChains = parseAddressList(process.env.TRACKED_CHAIN_IDS).map(
    BigInt,
  );
  const chainLimits = parseChainLimits(process.env.CHAIN_LIMITS);
  const bridgeTokens = parseAddressList(process.env.BRIDGE_TOKEN_ADDRESSES);
  const relayers = parseAddressList(process.env.RELAYER_ADDRESSES);
  const yieldTokenAddress =
    process.env.YIELD_TOKEN_ADDRESS || addresses.SentinelToken || '';
  const anomalyThreshold = Number(process.env.ANOMALY_THRESHOLD || '10');
  const tvlThreshold = ethers.parseEther(
    process.env.TVL_THRESHOLD_ETH || '1000',
  );

  // ── 1. SentinelTimelock: grant roles to SentinelGovernance ─────────────────
  if (addresses.SentinelTimelock && addresses.SentinelGovernance) {
    console.log('1. SentinelTimelock role grants →');
    const timelock = contract(
      'SentinelTimelock',
      addresses.SentinelTimelock,
      owner,
    );
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    await call(`grantRole(PROPOSER_ROLE, SentinelGovernance)`, () =>
      timelock.grantRole(PROPOSER_ROLE, addresses.SentinelGovernance),
    );
    await call(`grantRole(CANCELLER_ROLE, SentinelGovernance)`, () =>
      timelock.grantRole(CANCELLER_ROLE, addresses.SentinelGovernance),
    );
  } else {
    console.log('1. SentinelTimelock/Governance: skipped (no address)');
  }

  // ── 2. SentinelMonitor: authorize contracts + tracked chains ───────────────
  if (addresses.SentinelMonitor) {
    console.log('\n2. SentinelMonitor authorization →');
    const monitor = contract(
      'SentinelMonitor',
      addresses.SentinelMonitor,
      owner,
    );
    const toAuthorize = [
      addresses.SentinelInterceptor,
      addresses.AetheronBridge,
      addresses.CircuitBreaker,
    ].filter(Boolean);
    for (const addr of toAuthorize) {
      await call(`authorizeContract(${addr})`, () =>
        monitor.authorizeContract(addr),
      );
    }
    for (const chainId of trackedChains) {
      await call(`addTrackedChain(${chainId})`, () =>
        monitor.addTrackedChain(chainId),
      );
    }
  } else {
    console.log('\n2. SentinelMonitor: skipped (no address)');
  }

  // ── 3. RateLimiter: setCaller + setChainLimit ──────────────────────────────
  if (addresses.RateLimiter) {
    console.log('\n3. RateLimiter configuration →');
    const rateLimiter = contract('RateLimiter', addresses.RateLimiter, owner);
    const callers = new Set(
      [addresses.AetheronBridge, ...relayers].filter(Boolean),
    );
    for (const caller of callers) {
      await call(`setCaller(${caller}, true)`, () =>
        rateLimiter.setCaller(caller, true),
      );
    }
    for (const { chainId, limit } of chainLimits) {
      await call(`setChainLimit(${chainId}, ...)`, () =>
        rateLimiter.setChainLimit(chainId, limit),
      );
    }
  } else {
    console.log('\n3. RateLimiter: skipped (no address)');
  }

  // ── 4. SentinelInterceptor: MONITOR_ROLE + addReporter ────────────────────
  if (addresses.SentinelInterceptor) {
    console.log('\n4. SentinelInterceptor role grants →');
    const interceptor = contract(
      'SentinelInterceptor',
      addresses.SentinelInterceptor,
      owner,
    );
    const MONITOR_ROLE = await interceptor.MONITOR_ROLE();
    for (const mon of monitors) {
      await call(`grantRole(MONITOR_ROLE, ${mon})`, () =>
        interceptor.grantRole(MONITOR_ROLE, mon),
      );
    }
    const reporterSet = new Set([...monitors, ...reporters]);
    for (const rep of reporterSet) {
      await call(`addReporter(${rep})`, () => interceptor.addReporter(rep));
    }
  } else {
    console.log('\n4. SentinelInterceptor: skipped (no address)');
  }

  // ── 5. SentinelToken: setSecurityReporter ─────────────────────────────────
  if (addresses.SentinelToken && securityReporters.length > 0) {
    console.log('\n5. SentinelToken security reporters →');
    const token = contract('SentinelToken', addresses.SentinelToken, owner);
    for (const rep of securityReporters) {
      await call(`setSecurityReporter(${rep}, true)`, () =>
        token.setSecurityReporter(rep, true),
      );
    }
  } else {
    console.log('\n5. SentinelToken: skipped (no reporters configured)');
  }

  // ── 6. SentinelYieldMaximizer: setYieldToken ──────────────────────────────
  if (addresses.SentinelYieldMaximizer && yieldTokenAddress) {
    console.log('\n6. SentinelYieldMaximizer setup →');
    const yieldMax = contract(
      'SentinelYieldMaximizer',
      addresses.SentinelYieldMaximizer,
      owner,
    );
    await call(`setYieldToken(${yieldTokenAddress})`, () =>
      yieldMax.setYieldToken(yieldTokenAddress),
    );
  } else {
    console.log('\n6. SentinelYieldMaximizer: skipped (no yield token)');
  }

  // ── 7. AetheronBridge: setRelayer + setTokenSupport + setChainLimit ────────
  if (addresses.AetheronBridge) {
    console.log('\n7. AetheronBridge configuration →');
    const bridge = contract('AetheronBridge', addresses.AetheronBridge, owner);
    for (const relayer of relayers) {
      await call(`setRelayer(${relayer}, true)`, () =>
        bridge.setRelayer(relayer, true),
      );
    }
    for (const token of bridgeTokens) {
      await call(`setTokenSupport(${token}, true)`, () =>
        bridge.setTokenSupport(token, true),
      );
    }
    for (const { chainId, limit } of chainLimits) {
      await call(`setChainLimit(${chainId}, ...)`, () =>
        bridge.setChainLimit(chainId, limit),
      );
    }
  } else {
    console.log('\n7. AetheronBridge: skipped (no address)');
  }

  // ── 8. SentinelCoreLoop: set system components ────────────────────────────
  if (addresses.SentinelCoreLoop) {
    console.log('\n8. SentinelCoreLoop system components →');
    const coreLoop = contract(
      'SentinelCoreLoop',
      addresses.SentinelCoreLoop,
      owner,
    );

    if (typeof coreLoop.initializeCoreComponents === 'function') {
      await call('initializeCoreComponents(...)', () =>
        coreLoop.initializeCoreComponents(
          addresses.SentinelInterceptor || ethers.ZeroAddress,
          addresses.AetheronBridge || ethers.ZeroAddress,
          addresses.SentinelQuantumGuard || ethers.ZeroAddress,
          addresses.RateLimiter || ethers.ZeroAddress,
          addresses.CircuitBreaker || ethers.ZeroAddress,
          addresses.SentinelYieldMaximizer || ethers.ZeroAddress,
          addresses.SentinelOracleNetwork || ethers.ZeroAddress,
        ),
      );
    }

    const components = [
      ['sentinelInterceptor', addresses.SentinelInterceptor],
      ['aetheronBridge', addresses.AetheronBridge],
      ['rateLimiter', addresses.RateLimiter],
      ['circuitBreaker', addresses.CircuitBreaker],
      ['quantumGuard', addresses.SentinelQuantumGuard],
      ['yieldMaximizer', addresses.SentinelYieldMaximizer],
      ['oracleNetwork', addresses.SentinelOracleNetwork],
    ].filter(([, addr]) => addr);
    for (const [name, addr] of components) {
      await call(`setSystemComponent(${name}, ${addr})`, () =>
        coreLoop.setSystemComponent(name, addr),
      );
    }
  } else {
    console.log('\n8. SentinelCoreLoop: skipped (no address)');
  }

  console.log('\n✅ Ownership setup complete.\n');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
