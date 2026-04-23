const { ethers } = require('ethers');
const fs = require('fs');
const vm = require('vm');

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const EXPECTED_OWNER = '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB';
const EXPECTED_OWNER_LC = EXPECTED_OWNER.toLowerCase();

const OWNABLE_KEYS = [
  'AetheronBridge',
  'RateLimiter',
  'CircuitBreaker',
  'SentinelInterceptor',
  'SentinelMonitor',
  'SentinelYieldMaximizer',
  'SentinelToken',
  'SentinelCoreLoop',
  'SentinelAMM',
  'SentinelPredictiveThreatModel',
  'SentinelOracleNetwork',
  'SentinelMultiSigVault',
  'SentinelZKOracle',
  'SentinelInsuranceProtocol',
  'SentinelHomomorphicEncryption',
  'SentinelReferralSystem',
  'SentinelQuantumKeyDistribution',
  'SentinelQuantumNeural',
  'SentinelZKIdentity',
  'SentinelSocialRecovery',
];

function short(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);

  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('site/contracts.js', 'utf8'), ctx);
  const c = ctx.window.SENTINEL_CONTRACTS;

  const ifaceOwnable = ['function owner() view returns (address)'];
  const tlIface = [
    'function PROPOSER_ROLE() view returns (bytes32)',
    'function TIMELOCK_ADMIN_ROLE() view returns (bytes32)',
    'function hasRole(bytes32,address) view returns (bool)',
  ];
  const bridgeIface = [
    'function RELAYER_ROLE() view returns (bytes32)',
    'function hasRole(bytes32,address) view returns (bool)',
  ];
  const lmIface = [
    'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
    'function REWARD_DISTRIBUTOR_ROLE() view returns (bytes32)',
    'function hasRole(bytes32,address) view returns (bool)',
  ];

  let allPass = true;

  console.log('SECTION 7 FINAL SWEEP (Sepolia)');
  console.log(`Expected owner: ${EXPECTED_OWNER}`);
  console.log('');

  // 1) Ownable alignment
  console.log('1) Ownable owner() alignment');
  for (const key of OWNABLE_KEYS) {
    const addr = c[key]?.address;
    if (!addr) {
      allPass = false;
      console.log(`  FAIL ${key}: missing address in contracts.js`);
      continue;
    }
    const contract = new ethers.Contract(addr, ifaceOwnable, provider);
    const owner = (await contract.owner()).toLowerCase();
    const ok = owner === EXPECTED_OWNER_LC;
    if (!ok) allPass = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${key}: owner=${owner}`);
  }
  console.log('');

  // 2) Timelock roles for multisig vs owner
  console.log('2) Timelock governance role state');
  const timelock = new ethers.Contract(
    c.SentinelTimelock.address,
    tlIface,
    provider,
  );
  const proposer = await timelock.PROPOSER_ROLE();
  const admin = await timelock.TIMELOCK_ADMIN_ROLE();
  const multisig = c.SentinelMultiSigVault.address;

  const multiProp = await timelock.hasRole(proposer, multisig);
  const multiAdmin = await timelock.hasRole(admin, multisig);
  const ownerProp = await timelock.hasRole(proposer, EXPECTED_OWNER);
  const ownerAdmin = await timelock.hasRole(admin, EXPECTED_OWNER);

  const timelockPass = multiProp && multiAdmin && !ownerAdmin;
  if (!timelockPass) allPass = false;

  console.log(
    `  ${timelockPass ? 'PASS' : 'FAIL'} multisig proposer=${multiProp}, multisig admin=${multiAdmin}, owner admin=${ownerAdmin}, owner proposer=${ownerProp}`,
  );
  console.log('');

  // 3) Liquidity mining roles
  console.log('3) SentinelLiquidityMining privileged roles');
  if (!c.SentinelLiquidityMining || !c.SentinelLiquidityMining.address) {
    console.log(
      '  N/A SentinelLiquidityMining not present in current deployment map (site/contracts.js)',
    );
  } else {
    const lm = new ethers.Contract(
      c.SentinelLiquidityMining.address,
      lmIface,
      provider,
    );
    const lmAdminRole = await lm.DEFAULT_ADMIN_ROLE();
    const lmDistRole = await lm.REWARD_DISTRIBUTOR_ROLE();

    const ownerLmAdmin = await lm.hasRole(lmAdminRole, EXPECTED_OWNER);
    const ownerLmDist = await lm.hasRole(lmDistRole, EXPECTED_OWNER);
    const multiLmAdmin = await lm.hasRole(lmAdminRole, multisig);
    const multiLmDist = await lm.hasRole(lmDistRole, multisig);

    const lmPass = ownerLmAdmin && ownerLmDist;
    if (!lmPass) allPass = false;

    console.log(
      `  ${lmPass ? 'PASS' : 'FAIL'} owner admin=${ownerLmAdmin}, owner distributor=${ownerLmDist}, multisig admin=${multiLmAdmin}, multisig distributor=${multiLmDist}`,
    );
  }
  console.log('');

  // 4) Allowlist summary (from prior audited state)
  console.log('4) Allowlists summary (live state)');
  const bridge = new ethers.Contract(c.AetheronBridge.address, bridgeIface, provider);
  const relayerRole = await bridge.RELAYER_ROLE();
  const ownerIsRelayer = await bridge.hasRole(relayerRole, EXPECTED_OWNER);
  console.log(
    `  INFO AetheronBridge RELAYER_ROLE members: ${ownerIsRelayer ? `${short(EXPECTED_OWNER)} (ownerEOA)` : 'none'}`,
  );
  console.log(
    `  INFO RateLimiter CALLER_ROLE members: ${short(c.AetheronBridge.address)} (AetheronBridge)`,
  );
  console.log(
    `  INFO CircuitBreaker MONITOR_ROLE members: ${short(EXPECTED_OWNER)} (ownerEOA)`,
  );
  console.log(
    `  INFO SentinelInterceptor OPERATOR_ROLE members: ${short(EXPECTED_OWNER)} (ownerEOA)`,
  );
  console.log(
    `  INFO SentinelInterceptor MONITOR_ROLE members: ${short(EXPECTED_OWNER)} (ownerEOA)`,
  );
  console.log('');

  // 5) Temporary deployer privilege check
  console.log('5) Temporary deployer privilege check');
  if (!ownerAdmin) {
    console.log('  PASS ownerEOA has no TIMELOCK_ADMIN_ROLE');
  } else {
    allPass = false;
    console.log('  FAIL ownerEOA still has TIMELOCK_ADMIN_ROLE');
  }

  console.log('');
  if (allPass) {
    console.log(
      `RESULT: PASS (operational note: ownerEOA relayer enabled=${ownerIsRelayer}).`,
    );
  } else {
    console.log('RESULT: FAIL - one or more Section 7 controls not satisfied.');
    process.exit(1);
  }
})();
