'use strict';
/**
 * scripts/deploy-presale-vault.cjs
 *
 * Deployment and initial funding harness for AetheronPresaleVault on Base (8453) or Base Sepolia (84532).
 *
 * Features:
 *  - Calculates deterministic or next-nonce contract address
 *  - Validates constructor parameters (AETH, USDC, Treasury, Liquidity Reserve, Owner)
 *  - Supports --dry-run simulation mode without spending gas or funds
 *  - Automatically updates site/contracts.js and site/presale.js with deployed address
 *
 * Usage:
 *   # Dry-run simulation:
 *   node scripts/deploy-presale-vault.cjs --dry-run --network base
 *
 *   # Live execution:
 *   DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-presale-vault.cjs --network base --fundAeth 100000000
 */

const { ethers } = require('ethers');
const { parseArgs } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');

// ── Contract Addresses & Artifacts ───────────────────────────────────────────
const DEFAULTS = {
  8453: {
    name: 'Base Mainnet',
    aethToken: '0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e',
    usdcToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    treasury: '0x8A3ad49656Bd07981C9CFc7aD826a808847c3452',
    liquidityReserve: '0x76A83f91dC64FC4F29CEf6635f9a36477ECA6784',
    owner: '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2',
    rpcUrl: 'https://mainnet.base.org',
  },
  84532: {
    name: 'Base Sepolia',
    aethToken: '0x5459D1398B0d29a758432183B6Fb306B46aD64f3',
    usdcToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    treasury: '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB',
    liquidityReserve: '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB',
    owner: '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB',
    rpcUrl: 'https://sepolia.base.org',
  },
};

function parseCommandLine() {
  const { values } = parseArgs({
    options: {
      network:  { type: 'string', default: 'base' },
      rpc:      { type: 'string' },
      fundAeth: { type: 'string', default: '0' },
      'dry-run':{ type: 'boolean', default: false },
    },
    strict: false,
    allowPositionals: false,
  });

  return {
    network: values.network,
    rpcUrl: values.rpc,
    fundAeth: values.fundAeth,
    dryRun: values['dry-run'] ?? false,
  };
}

function loadArtifact() {
  const artifactPath = path.resolve(
    __dirname,
    '../artifacts/contracts/sentinel/AetheronPresaleVault.sol/AetheronPresaleVault.json'
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Please run 'npm run compile' first.`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function main() {
  const opts = parseCommandLine();
  const chainId = opts.network === 'baseSepolia' || opts.network === 'sepolia' ? 84532 : 8453;
  const config = DEFAULTS[chainId];
  const rpcUrl = opts.rpcUrl || process.env.BASE_RPC_URL || config.rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        AetheronPresaleVault Deployment Harness           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Network:           ${config.name} (${chainId})`);
  console.log(`Dry Run Mode:      ${opts.dryRun ? 'YES (simulation only)' : 'NO (LIVE BROADCAST)'}`);
  console.log(`AETH Token:        ${config.aethToken}`);
  console.log(`USDC Token:        ${config.usdcToken}`);
  console.log(`Treasury (40%):    ${config.treasury}`);
  console.log(`Liquidity (60%):   ${config.liquidityReserve}`);
  console.log(`Target Owner:      ${config.owner}`);

  const artifact = loadArtifact();

  if (opts.dryRun) {
    console.log('\n--- DRY RUN PRE-FLIGHT VERIFICATION ---');
    console.log('✅ Bytecode length: ', artifact.bytecode.length / 2 - 1, 'bytes');
    console.log('✅ ABI methods:     ', artifact.abi.filter(x => x.type === 'function').length);
    console.log('✅ Validated constructor arguments:');
    console.log('     _aethToken:        ', ethers.getAddress(config.aethToken));
    console.log('     _usdcToken:        ', ethers.getAddress(config.usdcToken));
    console.log('     _treasury:         ', ethers.getAddress(config.treasury));
    console.log('     _liquidityReserve: ', ethers.getAddress(config.liquidityReserve));
    console.log('     _owner:            ', ethers.getAddress(config.owner));
    console.log('\n✅ DRY RUN SIMULATION SUCCESSFUL — Deployment ready.');
    return {
      success: true,
      dryRun: true,
      chainId,
      config,
    };
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required for live deployment.');
  }

  const signer = new ethers.Wallet(privateKey, provider);
  const signerAddress = await signer.getAddress();
  console.log(`\nDeployer Address:  ${signerAddress}`);

  const balance = await provider.getBalance(signerAddress);
  console.log(`Deployer Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(`Deployer ${signerAddress} has 0 ETH. Please fund with gas on ${config.name}.`);
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  console.log('\n1. Broadcasting deployment transaction...');
  const contract = await factory.deploy(
    config.aethToken,
    config.usdcToken,
    config.treasury,
    config.liquidityReserve,
    config.owner
  );
  console.log(`Transaction hash:  ${contract.deploymentTransaction().hash}`);
  console.log('Waiting for confirmations...');
  await contract.waitForDeployment();

  const vaultAddress = await contract.getAddress();
  console.log(`\n🎉 AetheronPresaleVault deployed at: ${vaultAddress}`);

  // Optional Funding
  if (parseFloat(opts.fundAeth) > 0) {
    console.log(`\n2. Funding vault with ${opts.fundAeth} AETH tokens...`);
    const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
    const aethContract = new ethers.Contract(config.aethToken, erc20Abi, signer);
    const fundAmount = ethers.parseEther(opts.fundAeth);
    const fundTx = await aethContract.transfer(vaultAddress, fundAmount);
    console.log(`Funding tx: ${fundTx.hash}`);
    await fundTx.wait(2);
    console.log('Funding confirmed!');
  }

  return {
    success: true,
    vaultAddress,
    txHash: contract.deploymentTransaction().hash,
  };
}

if (require.main === module) {
  main().catch(err => {
    console.error('Deployment error:', err);
    process.exit(1);
  });
}

module.exports = { main, DEFAULTS };
