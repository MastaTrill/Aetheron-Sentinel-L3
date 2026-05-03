#!/usr/bin/env node

/**
 * OpenZeppelin Defender Integration Script
 * Prepares transactions for secure execution via Defender Relayer
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Configuration for Defender
const DEFENDER_API_KEY = process.env.DEFENDER_API_KEY;
const DEFENDER_SECRET = process.env.DEFENDER_SECRET;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB';

/**
 * Generate Safe transaction payload for Defender execution
 */
function generateSafePayload(contractAddress, functionName, params, value = 0) {
  // This would integrate with Defender API to create and sign transactions
  const payload = {
    to: contractAddress,
    value: value.toString(),
    data: '0x' + ethers.utils.defaultAbiCoder.encode(
      ['string', ...params.map(p => p.type)],
      [functionName, ...params.map(p => p.value)]
    ).slice(10), // Remove function selector
    operation: 0, // Call
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ethers.constants.AddressZero,
    refundReceiver: ethers.constants.AddressZero,
    nonce: 0
  };

  return payload;
}

/**
 * Prepare ownership handoff transaction for Defender
 */
function prepareOwnershipHandoff(contracts) {
  const transactions = [];

  contracts.forEach(contract => {
    if (contract.address !== RELAYER_ADDRESS) {
      transactions.push(generateSafePayload(
        contract.address,
        'transferOwnership',
        [{ type: 'address', value: RELAYER_ADDRESS }]
      ));
    }
  });

  return transactions;
}

/**
 * Export transactions for Defender import
 */
function exportForDefender(transactions, filename = 'defender-transactions.json') {
  fs.writeFileSync(filename, JSON.stringify({
    transactions,
    metadata: {
      name: 'Sentinel L3 Ownership Handoff',
      description: 'Transfer ownership to Defender Relayer',
      network: 'base'
    }
  }, null, 2));

  console.log(`Exported ${transactions.length} transactions to ${filename}`);
}

// Example usage
if (require.main === module) {
  // Load contracts from site/contracts.js
  const contracts = [
    { name: 'SentinelTimelock', address: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82' },
    { name: 'SentinelGovernance', address: '0x9A676e781A523b5d0C0e43731313A708CB607508' },
    // Add more...
  ];

  const transactions = prepareOwnershipHandoff(contracts);
  exportForDefender(transactions);
}

module.exports = {
  generateSafePayload,
  prepareOwnershipHandoff,
  exportForDefender
};