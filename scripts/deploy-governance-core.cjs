'use strict';
/**
 * scripts/deploy-governance-core.cjs
 *
 * Deploys the companion governance & TEE audit contracts:
 *  - AuditAnchor: on-chain cryptographic anchor for TEE execution proofs
 *  - SentinelAgentPolicy: agent permissions & timelocked policy management
 *
 * Enforces immediate ownership transfer to SENTINEL_OWNER with zero deployer residual roles.
 */

const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const releaseModule = require('./lib/release-core.cjs');

const { normalizePrivateKey, resolveDeployerSigner, resolveRpcUrl, validateGovernanceOwner } =
  releaseModule;

const DEFAULT_MIN_DELAY_HOURS = 1;

async function deployContract(factory, name, args = []) {
  process.stdout.write(`Deploying ${name}... `);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`deployed at ${address}`);
  return { contract, address };
}

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || process.env.NETWORK || 'baseSepolia';
  const rpcUrl = resolveRpcUrl(networkName);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = resolveDeployerSigner(provider);
  const deployerAddress = await deployer.getAddress();

  const finalOwner = process.env.SENTINEL_OWNER || deployerAddress;
  validateGovernanceOwner(finalOwner);

  console.log('────────────────────────────────────────────────────────');
  console.log(`Deploying Governance & TEE Core to ${networkName}`);
  console.log(`Deployer:   ${deployerAddress}`);
  console.log(`Final Owner: ${finalOwner}`);
  console.log('────────────────────────────────────────────────────────');

  // Load compiled artifacts
  const auditAnchorArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../artifacts/contracts/sentinel/AuditAnchor.sol/AuditAnchor.json'),
      'utf8'
    )
  );
  const policyArtifact = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../artifacts/contracts/sentinel/SentinelAgentPolicy.sol/SentinelAgentPolicy.json'
      ),
      'utf8'
    )
  );

  const AuditAnchorFactory = new ethers.ContractFactory(
    auditAnchorArtifact.abi,
    auditAnchorArtifact.bytecode,
    deployer
  );
  const PolicyFactory = new ethers.ContractFactory(
    policyArtifact.abi,
    policyArtifact.bytecode,
    deployer
  );

  // 1. Deploy AuditAnchor
  const { contract: auditAnchor, address: auditAnchorAddress } = await deployContract(
    AuditAnchorFactory,
    'AuditAnchor',
    [deployerAddress]
  );

  // 2. Deploy SentinelAgentPolicy
  const minDelaySeconds =
    (parseInt(process.env.POLICY_MIN_DELAY_HOURS, 10) || DEFAULT_MIN_DELAY_HOURS) * 3600;
  const { contract: policy, address: policyAddress } = await deployContract(
    PolicyFactory,
    'SentinelAgentPolicy',
    [deployerAddress, minDelaySeconds]
  );

  // 3. Transfer ownership if finalOwner differs from deployer
  if (finalOwner.toLowerCase() !== deployerAddress.toLowerCase()) {
    console.log(`Transferring AuditAnchor ownership to ${finalOwner}...`);
    const tx1 = await auditAnchor.transferOwnership(finalOwner);
    await tx1.wait();

    console.log(`Transferring SentinelAgentPolicy ownership to ${finalOwner}...`);
    const tx2 = await policy.transferOwnership(finalOwner);
    await tx2.wait();
  }

  const manifest = {
    network: networkName,
    deployedAt: new Date().toISOString(),
    owner: finalOwner,
    deployer: deployerAddress,
    contracts: {
      AuditAnchor: {
        address: auditAnchorAddress,
        constructorArguments: [deployerAddress],
      },
      SentinelAgentPolicy: {
        address: policyAddress,
        minDelaySeconds,
        constructorArguments: [deployerAddress, minDelaySeconds],
      },
    },
  };

  const outputPath =
    process.env.GOVERNANCE_MANIFEST_PATH ||
    path.join(__dirname, `../deployments/${networkName}-sentinel-governance.json`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Governance manifest saved to: ${outputPath}`);
  console.log('Deployment complete.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
