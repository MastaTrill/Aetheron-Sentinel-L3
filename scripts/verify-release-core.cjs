const fs = require('node:fs');
const {
  PUBLIC_NETWORKS,
  RELEASE_CONFIG,
  assertExactContractScope,
  manifestPath,
  writeManifest,
} = require('./lib/release-core.cjs');

async function main() {
  const hardhatModule = await import('hardhat');
  const hre = hardhatModule.default ?? hardhatModule;
  const connection = await hre.network.getOrCreate();
  const ethers = connection.ethers;
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const networkName = PUBLIC_NETWORKS[chainId]?.name ?? (chainId === 31337 ? 'hardhat' : null);
  if (!networkName) throw new Error(`Release verification is not permitted on chain ${chainId}`);

  const filePath = manifestPath(networkName);
  if (!fs.existsSync(filePath)) throw new Error(`Deployment manifest not found: ${filePath}`);
  const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (manifest.releaseProfile !== RELEASE_CONFIG.profile) {
    throw new Error(`Unexpected release profile: ${manifest.releaseProfile}`);
  }
  if (manifest.chainId !== chainId || manifest.network !== networkName) {
    throw new Error('Deployment manifest network does not match the connected RPC');
  }
  if (manifest.status !== 'ready-for-verification') {
    throw new Error(`Deployment is not ready for verification: ${manifest.status}`);
  }
  assertExactContractScope(Object.keys(manifest.contracts || {}));

  if (chainId === 8453) {
    const ownerCode = await provider.getCode(manifest.owner);
    if (ownerCode === '0x')
      throw new Error('Base mainnet owner must be a deployed Safe or timelock');
    if (!/^[0-9a-f]{64}$/i.test(manifest.auditReportSha256 || '')) {
      throw new Error('Base mainnet manifest is missing the independent audit digest');
    }
    if (!/^[1-9][0-9]{0,19}$/.test(manifest.baseSepoliaRehearsalRunId || '')) {
      throw new Error('Base mainnet manifest is missing the Base Sepolia rehearsal run');
    }
    if (!/^[0-9a-f]{64}$/i.test(manifest.baseSepoliaRehearsalManifestSha256 || '')) {
      throw new Error('Base mainnet manifest is missing the Base Sepolia rehearsal digest');
    }
    if (
      process.env.BASE_SEPOLIA_MANIFEST_SHA256 &&
      manifest.baseSepoliaRehearsalManifestSha256 !== process.env.BASE_SEPOLIA_MANIFEST_SHA256
    ) {
      throw new Error(
        'Base mainnet manifest rehearsal digest does not match the validated artifact'
      );
    }
  }

  const defaultAdminRole = ethers.ZeroHash;
  for (const [name, record] of Object.entries(manifest.contracts)) {
    const runtimeCode = await provider.getCode(record.address);
    if (runtimeCode === '0x') throw new Error(`${name} has no runtime bytecode`);
    if (ethers.keccak256(runtimeCode) !== record.runtimeCodeHash) {
      throw new Error(`${name} runtime bytecode hash does not match the manifest`);
    }

    const contract = await ethers.getContractAt(name, record.address);
    if ((await contract.owner()).toLowerCase() !== manifest.owner.toLowerCase()) {
      throw new Error(`${name} ownership was not transferred to the configured owner`);
    }
    if (!(await contract.paused())) throw new Error(`${name} is not paused`);
    if (!(await contract.hasRole(defaultAdminRole, manifest.owner))) {
      throw new Error(`${name} final owner is missing DEFAULT_ADMIN_ROLE`);
    }
    if (await contract.hasRole(defaultAdminRole, manifest.deployer)) {
      throw new Error(`${name} deployer retained DEFAULT_ADMIN_ROLE`);
    }
    for (const roleName of ['OPERATOR_ROLE', 'MONITOR_ROLE']) {
      const role = await contract[roleName]();
      if (!(await contract.hasRole(role, manifest.owner))) {
        throw new Error(`${name} final owner is missing ${roleName}`);
      }
      if (await contract.hasRole(role, manifest.deployer)) {
        throw new Error(`${name} deployer retained ${roleName}`);
      }
    }
  }

  const interceptor = await ethers.getContractAt(
    'SentinelInterceptor',
    manifest.contracts.SentinelInterceptor.address
  );
  const circuitBreaker = await ethers.getContractAt(
    'CircuitBreaker',
    manifest.contracts.CircuitBreaker.address
  );
  const rateLimiter = await ethers.getContractAt(
    'RateLimiter',
    manifest.contracts.RateLimiter.address
  );
  for (const monitor of manifest.configuration.monitors) {
    if (!(await interceptor.hasRole(await interceptor.MONITOR_ROLE(), monitor))) {
      throw new Error(`SentinelInterceptor monitor role missing for ${monitor}`);
    }
    if (!(await interceptor.authorizedReporters(monitor))) {
      throw new Error(`SentinelInterceptor reporter authorization missing for ${monitor}`);
    }
    if (!(await circuitBreaker.hasRole(await circuitBreaker.MONITOR_ROLE(), monitor))) {
      throw new Error(`CircuitBreaker monitor role missing for ${monitor}`);
    }
    if (!(await rateLimiter.hasRole(await rateLimiter.MONITOR_ROLE(), monitor))) {
      throw new Error(`RateLimiter monitor role missing for ${monitor}`);
    }
  }

  manifest.status = 'verified-paused';
  manifest.verifiedAt = new Date().toISOString();
  writeManifest(filePath, manifest);
  console.log(`RELEASE VERIFICATION: PASS (${RELEASE_CONFIG.profile})`);
  console.log(`Manifest: ${filePath}`);
}

main().catch(error => {
  console.error('RELEASE VERIFICATION: FAIL');
  console.error(error);
  process.exitCode = 1;
});
