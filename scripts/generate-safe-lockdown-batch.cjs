#!/usr/bin/env node
'use strict';

/**
 * Generate a Safe Transaction Builder batch for Sentinel L3 governance lockdown.
 *
 * This script DOES NOT sign or submit transactions. It only encodes calldata and
 * writes a Safe-compatible JSON batch that can be imported into the Safe UI.
 *
 * Required env:
 *   SAFE_ADDRESS
 *   CHAIN_ID
 *
 * Recommended env:
 *   OWNER_EOA
 *   MULTISIG_ADDRESS or SAFE_ADDRESS
 *   VAULT_ADDRESS
 *   SENTINEL_ADDRESS
 *   CORE_CONTRACT_ADDRESS
 *   NEW_RELAYER_ADDRESSES=0x...,0x...
 *
 * Optional env:
 *   LOCKDOWN_ACTIONS_JSON='[{"to":"0x...","signature":"transferOwnership(address)","args":["0x..."]}]'
 *
 * If LOCKDOWN_ACTIONS_JSON is provided, it fully replaces the default actions.
 */

const fs = require('node:fs');
const path = require('node:path');

async function loadEthers() {
  try {
    return await import('ethers');
  } catch (error) {
    console.error(
      'Missing dependency: ethers. Install dependencies with npm install before running this script.'
    );
    throw error;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith('SET_')) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

function splitAddresses(value) {
  return (value || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

function parseActions() {
  if (process.env.LOCKDOWN_ACTIONS_JSON) {
    const parsed = JSON.parse(process.env.LOCKDOWN_ACTIONS_JSON);
    if (!Array.isArray(parsed)) throw new Error('LOCKDOWN_ACTIONS_JSON must be an array');
    return parsed;
  }

  const safe = optional('MULTISIG_ADDRESS', optional('SAFE_ADDRESS'));
  const ownerEOA = optional('OWNER_EOA');
  const vault = optional('VAULT_ADDRESS');
  const sentinel = optional('SENTINEL_ADDRESS');
  const core = optional('CORE_CONTRACT_ADDRESS');
  const relayers = splitAddresses(
    process.env.NEW_RELAYER_ADDRESSES || process.env.RELAYER_ADDRESSES
  );

  const actions = [];

  if (vault && safe) {
    actions.push({
      label: 'Vault ownership to Safe',
      to: vault,
      signature: 'transferOwnership(address)',
      args: [safe],
    });
  }

  if (sentinel && safe) {
    actions.push({
      label: 'Sentinel steward to Safe',
      to: sentinel,
      signature: 'transferSteward(address)',
      args: [safe],
    });
  }

  if (core && ownerEOA) {
    actions.push({
      label: 'Revoke owner EOA admin role',
      to: core,
      signature: 'revokeRole(bytes32,address)',
      args: [
        process.env.ADMIN_ROLE ||
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ownerEOA,
      ],
    });
  }

  if (core && relayers.length > 0) {
    actions.push({
      label: 'Replace relayer set',
      to: core,
      signature: process.env.SET_RELAYERS_SIGNATURE || 'setRelayers(address[])',
      args: [relayers],
    });
  }

  if (core && process.env.DISABLE_BREAK_GLASS !== 'false') {
    actions.push({
      label: 'Disable break-glass / emergency admin',
      to: core,
      signature: process.env.DISABLE_BREAK_GLASS_SIGNATURE || 'disableEmergencyAdmin()',
      args: [],
    });
  }

  return actions;
}

function validateAddress(ethers, value, label) {
  if (!ethers.isAddress(value)) throw new Error(`Invalid address for ${label}: ${value}`);
  return ethers.getAddress(value);
}

(async function main() {
  const ethers = await loadEthers();

  const chainId = Number(required('CHAIN_ID'));
  const safeAddress = validateAddress(ethers, required('SAFE_ADDRESS'), 'SAFE_ADDRESS');
  const createdAt = Date.now();
  const actions = parseActions();

  if (actions.length === 0) {
    throw new Error('No actions generated. Provide contract addresses or LOCKDOWN_ACTIONS_JSON.');
  }

  const transactions = actions.map((item, index) => {
    const to = validateAddress(ethers, item.to, `actions[${index}].to`);
    const signature = item.signature;
    const args = item.args || [];
    const fnName = signature.slice(0, signature.indexOf('('));
    const iface = new ethers.Interface([`function ${signature}`]);
    const data = iface.encodeFunctionData(fnName, args);

    return {
      to,
      value: item.value || '0',
      data,
      contractMethod: {
        inputs: iface.getFunction(fnName).inputs.map(input => ({
          internalType: input.format('full').split(' ')[0],
          name: input.name || '',
          type: input.type,
        })),
        name: fnName,
        payable: false,
      },
      contractInputsValues: Object.fromEntries(
        iface
          .getFunction(fnName)
          .inputs.map((input, argIndex) => [
            input.name || `arg${argIndex}`,
            Array.isArray(args[argIndex]) ? args[argIndex].join(',') : String(args[argIndex]),
          ])
      ),
      meta: {
        label: item.label || `Lockdown action ${index + 1}`,
        signature,
      },
    };
  });

  const batch = {
    version: '1.0',
    chainId: String(chainId),
    createdAt,
    meta: {
      name: `Sentinel L3 Governance Lockdown ${new Date(createdAt).toISOString().slice(0, 10)}`,
      description:
        'Safe Transaction Builder batch for Sentinel L3 ownership, relayer, and break-glass lockdown. Review every transaction before signing.',
      txBuilderVersion: '1.18.0',
      createdFromSafeAddress: safeAddress,
      createdFromOwnerAddress: safeAddress,
      checksum: '',
    },
    transactions,
  };

  const outDir = path.join('docs', 'safe-batches');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `sentinel-l3-governance-lockdown-${new Date(createdAt).toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(outPath, JSON.stringify(batch, null, 2) + '\n');

  const summaryPath = path.join(
    outDir,
    `sentinel-l3-governance-lockdown-${new Date(createdAt).toISOString().slice(0, 10)}.md`
  );
  fs.writeFileSync(
    summaryPath,
    [
      `# Sentinel L3 Governance Lockdown Safe Batch`,
      '',
      `Generated: ${new Date(createdAt).toISOString()}`,
      `Chain ID: ${chainId}`,
      `Safe: ${safeAddress}`,
      '',
      '## Transactions',
      '',
      ...transactions.map((tx, i) =>
        [
          `### ${i + 1}. ${tx.meta.label}`,
          '',
          `- To: \`${tx.to}\``,
          `- Method: \`${tx.meta.signature}\``,
          `- Value: \`${tx.value}\``,
          `- Data: \`${tx.data}\``,
          '',
        ].join('\n')
      ),
      '## Import instructions',
      '',
      '1. Open the Safe UI for the configured Safe address.',
      '2. Use Transaction Builder / Batch transactions.',
      '3. Import the JSON file generated by this script.',
      '4. Review each target address, method, argument, and calldata before signing.',
      '5. After execution, run the evidence logger and attach transaction hashes to the daily notes.',
      '',
    ].join('\n')
  );

  console.log(`Wrote Safe batch: ${outPath}`);
  console.log(`Wrote summary: ${summaryPath}`);
})().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
