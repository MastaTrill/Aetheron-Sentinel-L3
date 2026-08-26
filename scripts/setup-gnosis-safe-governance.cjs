'use strict';
/**
 * scripts/setup-gnosis-safe-governance.cjs
 *
 * Institutional Gnosis Safe Multisig Governance Configurator for Base Mainnet.
 *
 * Generates:
 *  1. Verification report of Gnosis Safe threshold and owners.
 *  2. Gnosis Safe Transaction Builder JSON payload for 1-click batch ownership migration.
 *
 * Usage:
 *   node scripts/setup-gnosis-safe-governance.cjs --safe 0x... --network base
 */

const { ethers } = require('ethers');
const { parseArgs } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');

const SAFE_ABI = [
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function isOwner(address) view returns (bool)',
];

function parseCommandLine() {
  const { values } = parseArgs({
    options: {
      safe:    { type: 'string' },
      network: { type: 'string', default: 'base' },
      rpc:     { type: 'string' },
    },
    strict: false,
    allowPositionals: false,
  });

  return {
    safeAddress: values.safe || process.env.SENTINEL_OWNER || '0x0000000000000000000000000000000000000000',
    network: values.network,
    rpcUrl: values.rpc || (values.network === 'baseSepolia' ? 'https://sepolia.base.org' : 'https://mainnet.base.org'),
  };
}

async function main() {
  const opts = parseCommandLine();
  const provider = new ethers.JsonRpcProvider(opts.rpcUrl);

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Institutional Gnosis Safe Governance Configurator      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Target Safe:   ${opts.safeAddress}`);
  console.log(`Network:       ${opts.network}`);

  let isSafeContract = false;
  let owners = [];
  let threshold = 0n;

  if (opts.safeAddress !== ethers.ZeroAddress) {
    const code = await provider.getCode(opts.safeAddress);
    if (code !== '0x') {
      try {
        const safe = new ethers.Contract(opts.safeAddress, SAFE_ABI, provider);
        [owners, threshold] = await Promise.all([
          safe.getOwners(),
          safe.getThreshold(),
        ]);
        isSafeContract = true;
        console.log(`\n✅ Validated Gnosis Safe Contract:`);
        console.log(`   Threshold: ${threshold} of ${owners.length} signatures`);
        console.log(`   Signers:`);
        owners.forEach((o, i) => console.log(`     [${i + 1}] ${o}`));
      } catch (e) {
        console.log(`\nℹ️ Address has bytecode but Safe ABI query returned: ${e.message}`);
      }
    } else {
      console.log(`\nℹ️ Address ${opts.safeAddress} is an EOA or not yet deployed.`);
    }
  }

  // Generate Safe Transaction Builder Batch File
  const txBuilderPayload = {
    version: '1.0',
    chainId: opts.network === 'baseSepolia' ? '84532' : '8453',
    createdAt: Date.now(),
    meta: {
      name: 'Aetheron Sentinel L3 — Governance Migration Batch',
      description: 'Transfer contract ownership to Gnosis Safe Multisig',
      txBuilderVersion: '1.16.5',
      createdFromSafeAddress: opts.safeAddress,
    },
    transactions: [
      {
        to: '0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e',
        value: '0',
        data: null,
        contractMethod: {
          inputs: [{ name: 'newOwner', type: 'address' }],
          name: 'transferOwnership',
          payable: false,
        },
        contractInputsValues: {
          newOwner: opts.safeAddress,
        },
      },
    ],
  };

  const outputPath = path.resolve(__dirname, '../config/safe-governance-batch.json');
  fs.writeFileSync(outputPath, JSON.stringify(txBuilderPayload, null, 2));
  console.log(`\n📄 Generated Safe Transaction Builder Payload:`);
  console.log(`   ${outputPath}`);
  console.log(`   (Import directly into Safe Transaction Builder at https://app.safe.global)`);

  return {
    success: true,
    isSafeContract,
    threshold: threshold.toString(),
    owners,
    payloadPath: outputPath,
  };
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
