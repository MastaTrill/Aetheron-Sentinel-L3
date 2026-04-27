let hre;
let ethers;
require('dotenv').config();

function parseAddressList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUint(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return BigInt(value);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
}

function parseChainLimits(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [chainId, limit] = entry.split(':').map((part) => part.trim());
      if (!chainId || !limit) {
        throw new Error(`Invalid CHAIN_LIMITS entry: ${entry}`);
      }
      return { chainId: BigInt(chainId), limit: ethers.parseEther(limit) };
    });
}

async function deployContract(name, args) {
  const sandboxContracts = new Set(['Base', 'Lottery', 'Staking', 'Vault']);
  if (sandboxContracts.has(name)) {
    throw new Error(
      `Refusing to deploy sandbox contract \"${name}\" from imported Remix sandbox`,
    );
  }
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function getTxOverrides(provider) {
  const feeData = await provider.getFeeData();
  if (feeData.maxFeePerGas != null) {
    const priorityFee =
      feeData.maxPriorityFeePerGas ?? feeData.maxFeePerGas / 2n;
    return {
      maxFeePerGas: (feeData.maxFeePerGas * 3n) / 2n,
      maxPriorityFeePerGas: (priorityFee * 3n) / 2n,
    };
  }

  if (feeData.gasPrice != null) {
    return { gasPrice: (feeData.gasPrice * 3n) / 2n };
  }

  // Fallback to provider defaults when RPC omits both EIP-1559 and legacy gas data.
  return {};
}

async function main() {
  const hardhatModule = await import('hardhat');
  hre = hardhatModule.default ?? hardhatModule;
  const connection = await hre.network.getOrCreate();
  ethers = connection.ethers;

  const signers = await ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      'No deployer signer available. Set PRIVATE_KEY or OWNER_PRIVATE_KEY to a valid 0x-prefixed hex private key.',
    );
  }
  const [deployer] = signers;
  const deployerAddress = await deployer.getAddress();
  const owner = process.env.SENTINEL_OWNER || deployerAddress;
  const deployerIsOwner = deployerAddress.toLowerCase() === owner.toLowerCase();

  const config = {
    owner,
    anomalyThreshold: Number(process.env.ANOMALY_THRESHOLD || '10'),
    tvlThreshold: ethers.parseEther(process.env.TVL_THRESHOLD_ETH || '1000'),
    autonomousMode: parseBoolean(process.env.AUTONOMOUS_MODE, true),
    rewardPerSecond: parseUint(process.env.REWARD_PER_SECOND, 0n),
    relayers: parseAddressList(process.env.RELAYER_ADDRESSES),
    callers: parseAddressList(process.env.CALLER_ADDRESSES),
    monitors: parseAddressList(process.env.MONITOR_ADDRESSES),
    reporters: parseAddressList(process.env.REPORTER_ADDRESSES),
    trackedChains: parseAddressList(process.env.TRACKED_CHAIN_IDS).map((id) =>
      BigInt(id),
    ),
    bridgeTokens: parseAddressList(process.env.BRIDGE_TOKEN_ADDRESSES),
    chainLimits: parseChainLimits(process.env.CHAIN_LIMITS),
    lpToken: process.env.LP_TOKEN_ADDRESS || '',
    stakingToken: process.env.STAKING_TOKEN_ADDRESS || '',
    rewardToken: process.env.REWARD_TOKEN_ADDRESS || '',
    yieldToken: process.env.YIELD_TOKEN_ADDRESS || '',
    grantSecurityReporters: parseAddressList(
      process.env.SECURITY_REPORTER_ADDRESSES,
    ),
    timelockMinDelay: parseUint(
      process.env.TIMELOCK_MIN_DELAY,
      172800n, // 2 days
    ),
    timelockProposers: parseAddressList(process.env.TIMELOCK_PROPOSERS),
    timelockExecutors: parseAddressList(process.env.TIMELOCK_EXECUTORS),
    timelockAdmin: process.env.TIMELOCK_ADMIN || owner,
  };

  console.log('Deploying with account:', deployerAddress);
  console.log('Configured owner:', config.owner);
  console.log('Network:', hre.network.name);
  console.log(
    'Deployer controls owner-only setup:',
    deployerIsOwner ? 'yes' : 'no',
  );

  const balance = await deployer.provider.getBalance(deployerAddress);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH\n');

  const addresses = {};
  const pendingActions = [];

  console.log('1. Deploying SentinelToken...');
  const sentinelToken = await deployContract('SentinelToken', [config.owner]);
  addresses.SentinelToken = await sentinelToken.getAddress();
  console.log('   SentinelToken:', addresses.SentinelToken);

  console.log('2. Deploying AetheronBridge...');
  const bridge = await deployContract('AetheronBridge', [config.owner]);
  addresses.AetheronBridge = await bridge.getAddress();
  console.log('   AetheronBridge:', addresses.AetheronBridge);

  console.log('3. Deploying SentinelInterceptor...');
  const interceptor = await deployContract('SentinelInterceptor', [
    config.anomalyThreshold,
    config.tvlThreshold,
    config.autonomousMode,
    config.owner,
  ]);
  addresses.SentinelInterceptor = await interceptor.getAddress();
  console.log('   SentinelInterceptor:', addresses.SentinelInterceptor);

  console.log('4. Deploying CircuitBreaker...');
  const circuitBreaker = await deployContract('CircuitBreaker', [config.owner]);
  addresses.CircuitBreaker = await circuitBreaker.getAddress();
  console.log('   CircuitBreaker:', addresses.CircuitBreaker);

  console.log('5. Deploying RateLimiter...');
  const rateLimiter = await deployContract('RateLimiter', [config.owner]);
  addresses.RateLimiter = await rateLimiter.getAddress();
  console.log('   RateLimiter:', addresses.RateLimiter);

  console.log('6. Deploying SentinelQuantumGuard...');
  const quantumGuard = await deployContract('SentinelQuantumGuard', [
    config.owner,
  ]);
  addresses.SentinelQuantumGuard = await quantumGuard.getAddress();
  console.log('   SentinelQuantumGuard:', addresses.SentinelQuantumGuard);

  console.log('7. Deploying SentinelMultiSigVault...');
  const multiSigVault = await deployContract('SentinelMultiSigVault', [
    config.owner,
  ]);
  addresses.SentinelMultiSigVault = await multiSigVault.getAddress();
  console.log('   SentinelMultiSigVault:', addresses.SentinelMultiSigVault);

  console.log('8. Deploying SentinelOracleNetwork...');
  const oracleNetwork = await deployContract('SentinelOracleNetwork', [
    config.owner,
  ]);
  addresses.SentinelOracleNetwork = await oracleNetwork.getAddress();
  console.log('   SentinelOracleNetwork:', addresses.SentinelOracleNetwork);

  console.log('9. Deploying SentinelSecurityAuditor...');
  const securityAuditor = await deployContract('SentinelSecurityAuditor', [
    config.owner,
  ]);
  addresses.SentinelSecurityAuditor = await securityAuditor.getAddress();
  console.log('   SentinelSecurityAuditor:', addresses.SentinelSecurityAuditor);

  console.log('10. Deploying SentinelMonitor...');
  const monitor = await deployContract('SentinelMonitor', [config.owner]);
  addresses.SentinelMonitor = await monitor.getAddress();
  console.log('   SentinelMonitor:', addresses.SentinelMonitor);

  console.log('11. Deploying SentinelYieldMaximizer...');
  const yieldMaximizer = await deployContract('SentinelYieldMaximizer', [
    config.owner,
  ]);
  addresses.SentinelYieldMaximizer = await yieldMaximizer.getAddress();
  console.log('   SentinelYieldMaximizer:', addresses.SentinelYieldMaximizer);

  const stakingTokenAddress = config.stakingToken || addresses.SentinelToken;
  const rewardTokenAddress = config.rewardToken || addresses.SentinelToken;
  const yieldTokenAddress = config.yieldToken || addresses.SentinelToken;

  console.log('12. Deploying SentinelStaking...');
  const staking = await deployContract('SentinelStaking', [
    stakingTokenAddress,
    rewardTokenAddress,
    config.owner,
  ]);
  addresses.SentinelStaking = await staking.getAddress();
  console.log('   SentinelStaking:', addresses.SentinelStaking);

  console.log('13. Deploying SentinelReferralSystem...');
  const referralSystem = await deployContract('SentinelReferralSystem', [
    rewardTokenAddress,
    config.owner,
  ]);
  addresses.SentinelReferralSystem = await referralSystem.getAddress();
  console.log('   SentinelReferralSystem:', addresses.SentinelReferralSystem);

  if (config.lpToken) {
    console.log('14. Deploying SentinelLiquidityMining...');
    const liquidityMining = await deployContract('SentinelLiquidityMining', [
      config.lpToken,
      rewardTokenAddress,
      config.rewardPerSecond,
      config.owner,
    ]);
    addresses.SentinelLiquidityMining = await liquidityMining.getAddress();
    console.log(
      '   SentinelLiquidityMining:',
      addresses.SentinelLiquidityMining,
    );
  } else {
    console.log(
      '14. Skipping SentinelLiquidityMining: LP_TOKEN_ADDRESS not provided',
    );
  }

  console.log('15. Deploying SentinelTimelock...');
  const timelockProposers = config.timelockProposers.length
    ? config.timelockProposers
    : [deployerAddress];
  const timelockExecutors = config.timelockExecutors.length
    ? config.timelockExecutors
    : [ethers.ZeroAddress]; // address(0) = anyone can execute
  const timelock = await deployContract('SentinelTimelock', [
    config.timelockMinDelay,
    timelockProposers,
    timelockExecutors,
    config.timelockAdmin,
  ]);
  addresses.SentinelTimelock = await timelock.getAddress();
  console.log('   SentinelTimelock:', addresses.SentinelTimelock);

  console.log('16. Deploying SentinelGovernance...');
  const governance = await deployContract('SentinelGovernance', [
    addresses.SentinelToken,
    addresses.SentinelTimelock,
  ]);
  addresses.SentinelGovernance = await governance.getAddress();
  console.log('   SentinelGovernance:', addresses.SentinelGovernance);

  // Grant PROPOSER_ROLE and CANCELLER_ROLE on the timelock to the governance contract
  if (deployerIsOwner) {
    const ov = await getTxOverrides(deployer.provider);
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
    await (
      await timelock.grantRole(PROPOSER_ROLE, addresses.SentinelGovernance, ov)
    ).wait();
    await (
      await timelock.grantRole(CANCELLER_ROLE, addresses.SentinelGovernance, ov)
    ).wait();
    console.log(
      '   Granted PROPOSER + CANCELLER roles to SentinelGovernance on timelock',
    );
    // Renounce deployer's TIMELOCK_ADMIN_ROLE so timelock is fully governed
    if (config.timelockAdmin.toLowerCase() !== deployerAddress.toLowerCase()) {
      await (
        await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployerAddress, ov)
      ).wait();
      console.log(
        '   Renounced deployer TIMELOCK_ADMIN_ROLE (timelockAdmin is separate account)',
      );
    }
  } else {
    pendingActions.push(
      `SentinelTimelock.grantRole(PROPOSER_ROLE, ${addresses.SentinelGovernance})`,
      `SentinelTimelock.grantRole(CANCELLER_ROLE, ${addresses.SentinelGovernance})`,
    );
  }

  const callerSet = new Set([addresses.AetheronBridge, ...config.callers]);
  const reporterSet = new Set([...config.monitors, ...config.reporters]);
  if (deployerIsOwner) {
    console.log('\nConfiguring post-deploy authorization...');
    const ov2 = await getTxOverrides(deployer.provider);

    await (
      await monitor.authorizeContract(addresses.SentinelInterceptor, ov2)
    ).wait();
    await (
      await monitor.authorizeContract(addresses.AetheronBridge, ov2)
    ).wait();
    await (
      await monitor.authorizeContract(addresses.CircuitBreaker, ov2)
    ).wait();

    for (const chainId of config.trackedChains) {
      await (await monitor.addTrackedChain(chainId, ov2)).wait();
    }

    for (const relayer of config.relayers) {
      await (await bridge.setRelayer(relayer, true, ov2)).wait();
    }

    for (const caller of callerSet) {
      await (await rateLimiter.setCaller(caller, true, ov2)).wait();
    }

    const monitorRole = await interceptor.MONITOR_ROLE();
    for (const monitorAddress of config.monitors) {
      await (
        await interceptor.grantRole(monitorRole, monitorAddress, ov2)
      ).wait();
    }

    for (const reporter of reporterSet) {
      await (await interceptor.addReporter(reporter, ov2)).wait();
    }

    for (const securityReporter of config.grantSecurityReporters) {
      await (
        await sentinelToken.setSecurityReporter(securityReporter, true, ov2)
      ).wait();
    }

    await (await yieldMaximizer.setYieldToken(yieldTokenAddress, ov2)).wait();

    for (const token of config.bridgeTokens) {
      await (await bridge.setTokenSupport(token, true, ov2)).wait();
    }

    for (const { chainId, limit } of config.chainLimits) {
      await (await bridge.setChainLimit(chainId, limit, ov2)).wait();
      await (await rateLimiter.setChainLimit(chainId, limit, ov2)).wait();
    }
  } else {
    pendingActions.push(
      'Run owner-only post-deploy setup from SENTINEL_OWNER or your multisig.',
      `SentinelMonitor.authorizeContract(${addresses.SentinelInterceptor})`,
      `SentinelMonitor.authorizeContract(${addresses.AetheronBridge})`,
      `SentinelMonitor.authorizeContract(${addresses.CircuitBreaker})`,
      ...config.trackedChains.map(
        (chainId) => `SentinelMonitor.addTrackedChain(${chainId})`,
      ),
      ...config.relayers.map(
        (relayer) => `AetheronBridge.setRelayer(${relayer}, true)`,
      ),
      ...Array.from(callerSet).map(
        (caller) => `RateLimiter.setCaller(${caller}, true)`,
      ),
      ...config.monitors.map(
        (monitorAddress) =>
          `SentinelInterceptor.grantRole(MONITOR_ROLE, ${monitorAddress})`,
      ),
      ...Array.from(reporterSet).map(
        (reporter) => `SentinelInterceptor.addReporter(${reporter})`,
      ),
      ...config.grantSecurityReporters.map(
        (securityReporter) =>
          `SentinelToken.setSecurityReporter(${securityReporter}, true)`,
      ),
      `SentinelYieldMaximizer.setYieldToken(${yieldTokenAddress})`,
      ...config.bridgeTokens.map(
        (token) => `AetheronBridge.setTokenSupport(${token}, true)`,
      ),
      ...config.chainLimits.flatMap(({ chainId, limit }) => [
        `AetheronBridge.setChainLimit(${chainId}, ${limit})`,
        `RateLimiter.setChainLimit(${chainId}, ${limit})`,
      ]),
    );
  }

  console.log('17. Deploying SentinelCore...');
  const sentinelCore = await deployContract('SentinelCore', [owner]);
  addresses.SentinelCore = await sentinelCore.getAddress();
  console.log('   SentinelCore:', addresses.SentinelCore);

  console.log('18. Deploying SentinelCoreLoop...');
  const coreLoop = await deployContract('SentinelCoreLoop', [config.owner]);
  addresses.SentinelCoreLoop = await coreLoop.getAddress();
  console.log('   SentinelCoreLoop:', addresses.SentinelCoreLoop);

  console.log('19. Deploying SentinelAMM...');
  const amm = await deployContract('SentinelAMM', [config.owner]);
  addresses.SentinelAMM = await amm.getAddress();
  console.log('   SentinelAMM:', addresses.SentinelAMM);

  console.log('20. Deploying SentinelPredictiveThreatModel...');
  const predictiveThreat = await deployContract(
    'SentinelPredictiveThreatModel',
    [config.owner],
  );
  addresses.SentinelPredictiveThreatModel = await predictiveThreat.getAddress();
  console.log(
    '   SentinelPredictiveThreatModel:',
    addresses.SentinelPredictiveThreatModel,
  );

  console.log('21. Deploying SentinelHomomorphicEncryption...');
  const homomorphic = await deployContract('SentinelHomomorphicEncryption', [
    config.owner,
  ]);
  addresses.SentinelHomomorphicEncryption = await homomorphic.getAddress();
  console.log(
    '   SentinelHomomorphicEncryption:',
    addresses.SentinelHomomorphicEncryption,
  );

  console.log('22. Deploying SentinelQuantumKeyDistribution...');
  const qkd = await deployContract('SentinelQuantumKeyDistribution', [
    config.owner,
  ]);
  addresses.SentinelQuantumKeyDistribution = await qkd.getAddress();
  console.log(
    '   SentinelQuantumKeyDistribution:',
    addresses.SentinelQuantumKeyDistribution,
  );

  console.log('23. Deploying SentinelQuantumNeural...');
  const quantumNeural = await deployContract('SentinelQuantumNeural', [
    config.owner,
  ]);
  addresses.SentinelQuantumNeural = await quantumNeural.getAddress();
  console.log('   SentinelQuantumNeural:', addresses.SentinelQuantumNeural);

  console.log('24. Deploying SentinelZKIdentity...');
  const zkIdentity = await deployContract('SentinelZKIdentity', [config.owner]);
  addresses.SentinelZKIdentity = await zkIdentity.getAddress();
  console.log('   SentinelZKIdentity:', addresses.SentinelZKIdentity);

  console.log('25. Deploying SentinelSocialRecovery...');
  const socialRecovery = await deployContract('SentinelSocialRecovery', [
    addresses.SentinelZKIdentity,
    config.owner,
  ]);
  addresses.SentinelSocialRecovery = await socialRecovery.getAddress();
  console.log('   SentinelSocialRecovery:', addresses.SentinelSocialRecovery);

  console.log('26. Deploying SentinelZKOracle...');
  const zkOracle = await deployContract('SentinelZKOracle', [config.owner]);
  addresses.SentinelZKOracle = await zkOracle.getAddress();
  console.log('   SentinelZKOracle:', addresses.SentinelZKOracle);

  console.log('27. Deploying SentinelInsuranceProtocol...');
  const insuranceProtocol = await deployContract('SentinelInsuranceProtocol', [
    addresses.SentinelCore,
    addresses.SentinelSecurityAuditor,
    config.owner,
  ]);
  addresses.SentinelInsuranceProtocol = await insuranceProtocol.getAddress();
  console.log(
    '   SentinelInsuranceProtocol:',
    addresses.SentinelInsuranceProtocol,
  );

  if (deployerIsOwner) {
    console.log('\nConfiguring SentinelCoreLoop components...');
    const ov3 = await getTxOverrides(deployer.provider);
    const coreLoopComponents = [
      ['sentinelInterceptor', addresses.SentinelInterceptor],
      ['aetheronBridge', addresses.AetheronBridge],
      ['rateLimiter', addresses.RateLimiter],
      ['circuitBreaker', addresses.CircuitBreaker],
      ['quantumGuard', addresses.SentinelQuantumGuard],
      ['yieldMaximizer', addresses.SentinelYieldMaximizer],
      ['oracleNetwork', addresses.SentinelOracleNetwork],
    ].filter(([, address]) => address);

    for (const [name, address] of coreLoopComponents) {
      await (await coreLoop.setSystemComponent(name, address, ov3)).wait();
    }
  } else {
    pendingActions.push(
      ...[
        ['sentinelInterceptor', addresses.SentinelInterceptor],
        ['aetheronBridge', addresses.AetheronBridge],
        ['rateLimiter', addresses.RateLimiter],
        ['circuitBreaker', addresses.CircuitBreaker],
        ['quantumGuard', addresses.SentinelQuantumGuard],
        ['yieldMaximizer', addresses.SentinelYieldMaximizer],
        ['oracleNetwork', addresses.SentinelOracleNetwork],
      ]
        .filter(([, address]) => address)
        .map(
          ([name, address]) =>
            `SentinelCoreLoop.setSystemComponent(${name}, ${address})`,
        ),
    );
  }

  console.log('\n✅ Deployment complete. Contract addresses:');
  console.log(JSON.stringify(addresses, null, 2));
  console.log('\nEnvironment summary:');
  console.log(
    JSON.stringify(
      {
        owner: config.owner,
        relayers: config.relayers,
        callers: Array.from(callerSet),
        monitors: config.monitors,
        reporters: Array.from(reporterSet),
        trackedChains: config.trackedChains.map(String),
        bridgeTokens: config.bridgeTokens,
        chainLimits: config.chainLimits.map((item) => ({
          chainId: item.chainId.toString(),
          limit: item.limit.toString(),
        })),
        stakingTokenAddress,
        rewardTokenAddress,
        yieldTokenAddress,
        timelockMinDelay: config.timelockMinDelay.toString(),
        timelockProposers,
        timelockExecutors,
        timelockAdmin: config.timelockAdmin,
        deployerIsOwner,
        pendingActions,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
