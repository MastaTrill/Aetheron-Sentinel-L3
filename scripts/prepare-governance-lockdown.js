#!/usr/bin/env node
'use strict';

/**
 * Generates a deterministic governance + relayer lockdown plan
 * WITHOUT executing anything on-chain.
 *
 * You take the output and execute via your multisig (Safe, etc).
 */

const fs = require('node:fs');
const path = require('node:path');

const NOW = new Date().toISOString();

// ===== INPUTS (override via env) =====
const CONFIG = {
  multisig: process.env.MULTISIG_ADDRESS || 'SET_MULTISIG_ADDRESS',
  ownerEOA: process.env.OWNER_EOA || 'SET_OWNER_EOA',

  contracts: {
    vault: process.env.VAULT_ADDRESS || '',
    sentinel: process.env.SENTINEL_ADDRESS || '',
    core: process.env.CORE_CONTRACT_ADDRESS || '',
  },

  relayers: (process.env.RELAYER_ADDRESSES || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean),

  newRelayerSet: (process.env.NEW_RELAYER_ADDRESSES || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean),
};

function step(id, title, description, actions) {
  return { id, title, description, actions };
}

function action(contract, method, args, notes) {
  return { contract, method, args, notes };
}

const plan = {
  generatedAt: NOW,
  summary: 'Sentinel L3 governance + relayer lockdown sequence',
  criticalInvariant: 'After execution, no single EOA has unilateral control',
  multisig: CONFIG.multisig,

  steps: [
    step('G1', 'Transfer ownership to multisig', 'All contracts must be owned by multisig', [
      action(
        CONFIG.contracts.vault,
        'transferOwnership',
        [CONFIG.multisig],
        'Vault ownership → multisig'
      ),
      action(
        CONFIG.contracts.sentinel,
        'transferSteward',
        [CONFIG.multisig],
        'Sentinel steward → multisig'
      ),
    ]),

    step('G2', 'Remove owner EOA privileges', 'Owner EOA must not retain any privileged role', [
      action(CONFIG.contracts.core, 'revokeRole', [CONFIG.ownerEOA], 'Revoke admin roles'),
    ]),

    step('G3', 'Set relayer set explicitly', 'Only approved relayers should be active', [
      action(CONFIG.contracts.core, 'setRelayers', [CONFIG.newRelayerSet], 'Replace relayer set'),
    ]),

    step('G4', 'Disable break-glass paths', 'Emergency owner powers must be removed or gated', [
      action(CONFIG.contracts.core, 'disableEmergencyAdmin', [], 'Disable break-glass'),
    ]),

    step('G5', 'Final audit check', 'Verify ownership + roles are correct post-change', [
      action('READ', 'owner()', [], 'Should equal multisig'),
      action('READ', 'getRelayers()', [], 'Should equal approved set'),
    ]),
  ],
};

const outPath = path.join('docs', `governance-lockdown-plan-${NOW.slice(0, 10)}.json`);
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(plan, null, 2));

console.log('Generated governance lockdown plan:');
console.log(outPath);
console.log('\nNEXT: Execute each step via multisig UI (Safe) or script.');
