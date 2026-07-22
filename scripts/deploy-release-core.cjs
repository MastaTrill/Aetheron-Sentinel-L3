const fs = require('node:fs');
const {
  PUBLIC_NETWORKS,
  RELEASE_CONFIG,
  assertExactContractScope,
  manifestPath,
  normalizePrivateKey,
  parseAddressList,
  writeManifest,
} = require('./lib/release-core.cjs');

async function main() {
  const hardhatModule = await import('hardhat');
  const hre = hardhatModule.default ?? hardhatModule;
  const connection = await hre.network.getOrCreate();
  const ethers = connection.ethers;
  const provider = ethers.provider;
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) throw new Error('The active Hardhat network did not provide a deployer signer');

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const publicNetwork = PUBLIC_NETWORKS[chainId];
  const isSimulation = chainId === 31337;
  if (!publicNetwork && !isSimulation) {
    throw new Error(`Release deployment is not permitted on chain ${chainId}`);
  }

  const networkName = publicNetwork?.name ?? 'hardhat';
  const deployerAddress = await deployer.getAddress();
  const owner = process.env.SENTINEL_OWNER || (isSimulation ? signers[1]?.address : '');
  if (!owner || !ethers.isAddress(owner) || owner === ethers.ZeroAddress) {
    throw new Error('SENTINEL_OWNER must be a non-zero Safe or timelock address');
  }
  if (owner.toLowerCase() === deployerAddress.toLowerCase()) {
    throw new Error('The final owner must be different from the ephemeral deployer');
  }

  if (publicNetwork) {
    if (process.env.DEPLOY_CONFIRMATION !== publicNetwork.confirmation) {
      throw new Error(`DEPLOY_CONFIRMATION must equal ${publicNetwork.confirmation}`);
    }
    if (!/^[0-9a-f]{40}$/i.test(process.env.RELEASE_COMMIT || '')) {
      throw new Error('RELEASE_COMMIT must be the 40-character reviewed Git commit');
    }
    if (!/^0x[0-9a-f]{64}$/i.test(normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY))) {
      throw new Error('DEPLOYER_PRIVATE_KEY must be a 32-byte hexadecimal private key');
    }
    if (
      publicNetwork.auditRequired &&
      !/^[0-9a-f]{64}$/i.test(process.env.AUDIT_REPORT_SHA256 || '')
    ) {
      throw new Error('AUDIT_REPORT_SHA256 must identify the independent audit for mainnet');
    }
    if (
      publicNetwork.auditRequired &&
      !/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(process.env.RELEASE_TAG || '')
    ) {
      throw new Error('RELEASE_TAG must be an immutable audited release tag');
    }
    if (
      publicNetwork.auditRequired &&
      !/^[1-9][0-9]{0,19}$/.test(process.env.BASE_SEPOLIA_RUN_ID || '')
    ) {
      throw new Error('BASE_SEPOLIA_RUN_ID must identify the successful rehearsal run');
    }
    if (
      publicNetwork.auditRequired &&
      !/^[0-9a-f]{64}$/i.test(process.env.BASE_SEPOLIA_MANIFEST_SHA256 || '')
    ) {
      throw new Error('BASE_SEPOLIA_MANIFEST_SHA256 must identify the verified rehearsal manifest');
    }
    if (publicNetwork.auditRequired && (await provider.getCode(owner)) === '0x') {
      throw new Error('Base mainnet owner must be a deployed Safe or timelock');
    }
  }

  const monitors = parseAddressList(process.env.MONITOR_ADDRESSES);
  if (publicNetwork && monitors.length === 0) {
    throw new Error('MONITOR_ADDRESSES must contain at least one monitored signer');
  }
  for (const monitor of monitors) {
    if (!ethers.isAddress(monitor) || monitor === ethers.ZeroAddress) {
      throw new Error(`Invalid MONITOR_ADDRESSES entry: ${monitor}`);
    }
    if (monitor.toLowerCase() === deployerAddress.toLowerCase()) {
      throw new Error('The ephemeral deployer cannot remain a monitor');
    }
  }

  const configuredMinimum =
    process.env.MIN_DEPLOYER_BALANCE_ETH ||
    (publicNetwork ? RELEASE_CONFIG.defaults[publicNetwork.minBalanceKey] : '0');
  const minimumBalance = ethers.parseEther(configuredMinimum);
  const balance = await provider.getBalance(deployerAddress);
  if (balance < minimumBalance) {
    throw new Error(
      `Deployer balance ${ethers.formatEther(balance)} ETH is below the ${configuredMinimum} ETH minimum`
    );
  }

  const outputPath = manifestPath(networkName);
  if (fs.existsSync(outputPath) && process.env.ALLOW_MANIFEST_OVERWRITE !== 'true') {
    throw new Error(`Refusing to overwrite existing deployment manifest: ${outputPath}`);
  }

  const manifest = {
    schemaVersion: RELEASE_CONFIG.schemaVersion,
    releaseProfile: RELEASE_CONFIG.profile,
    status: 'deploying',
    network: networkName,
    chainId,
    releaseCommit: process.env.RELEASE_COMMIT || 'local-simulation',
    releaseTag: process.env.RELEASE_TAG || null,
    auditReportSha256: process.env.AUDIT_REPORT_SHA256 || null,
    baseSepoliaRehearsalRunId: process.env.BASE_SEPOLIA_RUN_ID || null,
    baseSepoliaRehearsalManifestSha256: process.env.BASE_SEPOLIA_MANIFEST_SHA256 || null,
    deployer: deployerAddress,
    owner,
    startedAt: new Date().toISOString(),
    completedAt: null,
    safety: {
      paused: true,
      autonomousMode: false,
      custodyEnabled: false,
      pendingActions: [],
    },
    configuration: {
      monitors,
      anomalyThreshold: RELEASE_CONFIG.defaults.anomalyThreshold,
      tvlThresholdEth: RELEASE_CONFIG.defaults.tvlThresholdEth,
    },
    contracts: {},
  };
  writeManifest(outputPath, manifest);

  async function deploy(name, constructorArguments) {
    const Factory = await ethers.getContractFactory(name, deployer);
    const contract = await Factory.deploy(...constructorArguments);
    await contract.waitForDeployment();
    const receipt = await contract.deploymentTransaction().wait();
    const address = await contract.getAddress();
    const runtimeCode = await provider.getCode(address);
    manifest.contracts[name] = {
      address,
      constructorArguments,
      deploymentTransaction: receipt.hash,
      deploymentBlock: receipt.blockNumber,
      runtimeCodeHash: ethers.keccak256(runtimeCode),
    };
    writeManifest(outputPath, manifest);
    return contract;
  }

  console.log(`Deploying ${RELEASE_CONFIG.profile} to ${networkName} (${chainId})`);
  console.log(`Ephemeral deployer: ${deployerAddress}`);
  console.log(`Final owner: ${owner}`);

  const interceptor = await deploy('SentinelInterceptor', [
    RELEASE_CONFIG.defaults.anomalyThreshold,
    ethers.parseEther(RELEASE_CONFIG.defaults.tvlThresholdEth),
    false,
    deployerAddress,
  ]);
  const circuitBreaker = await deploy('CircuitBreaker', [deployerAddress]);
  const rateLimiter = await deploy('RateLimiter', [deployerAddress]);
  assertExactContractScope(Object.keys(manifest.contracts));

  const interceptorMonitorRole = await interceptor.MONITOR_ROLE();
  const circuitMonitorRole = await circuitBreaker.MONITOR_ROLE();
  const rateMonitorRole = await rateLimiter.MONITOR_ROLE();
  for (const monitor of monitors) {
    await (await interceptor.grantRole(interceptorMonitorRole, monitor)).wait();
    await (await interceptor.addReporter(monitor)).wait();
    await (await circuitBreaker.grantRole(circuitMonitorRole, monitor)).wait();
    await (await rateLimiter.grantRole(rateMonitorRole, monitor)).wait();
  }

  for (const contract of [interceptor, circuitBreaker, rateLimiter]) {
    await (await contract.emergencyPause()).wait();
    await (await contract.transferOwnership(owner)).wait();
  }

  for (const [name, contract] of [
    ['SentinelInterceptor', interceptor],
    ['CircuitBreaker', circuitBreaker],
    ['RateLimiter', rateLimiter],
  ]) {
    if ((await contract.owner()).toLowerCase() !== owner.toLowerCase()) {
      throw new Error(`${name} ownership handoff failed`);
    }
    if (!(await contract.paused())) throw new Error(`${name} was not left paused`);
    if (!(await contract.hasRole(ethers.ZeroHash, owner))) {
      throw new Error(`${name} owner is missing DEFAULT_ADMIN_ROLE`);
    }
    if (await contract.hasRole(ethers.ZeroHash, deployerAddress)) {
      throw new Error(`${name} deployer retained DEFAULT_ADMIN_ROLE`);
    }
    for (const roleName of ['OPERATOR_ROLE', 'MONITOR_ROLE']) {
      const role = await contract[roleName]();
      if (!(await contract.hasRole(role, owner))) {
        throw new Error(`${name} owner is missing ${roleName}`);
      }
      if (await contract.hasRole(role, deployerAddress)) {
        throw new Error(`${name} deployer retained ${roleName}`);
      }
    }
  }

  manifest.status = 'ready-for-verification';
  manifest.completedAt = new Date().toISOString();
  writeManifest(outputPath, manifest);
  console.log(`Deployment manifest: ${outputPath}`);
  console.log('Release core deployed paused with no custodial capability.');
}

main().catch(error => {
  console.error('RELEASE DEPLOYMENT FAILED');
  console.error(error);
  process.exitCode = 1;
});
