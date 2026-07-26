#!/usr/bin/env node
/**
 * Sentinel L3 — On-Chain Event Indexer
 * Indexes simulated on-chain events (swaps, deposits, attacks, governance)
 * and outputs a structured JSON report + markdown summary.
 * Output: docs/EVENT_INDEX_REPORT.md
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateTxHash() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const EVENT_TYPES = [
  { type: 'SWAP', contract: 'SentinelAMM', description: 'ETH → SENTINEL swap executed', valueUSD: () => randomBetween(500, 120000) },
  { type: 'DEPOSIT', contract: 'SentinelVaultStrategy', description: 'User deposited SENTINEL into yield vault', valueUSD: () => randomBetween(1000, 500000) },
  { type: 'ATTACK_INTERCEPTED', contract: 'SentinelCore', description: 'Flash loan attack vector blocked by interceptor', valueUSD: () => randomBetween(10000, 800000) },
  { type: 'GOVERNANCE_VOTE', contract: 'SentinelGovernance', description: 'DAO governance vote cast on proposal', valueUSD: () => 0 },
  { type: 'STAKE', contract: 'SentinelStaking', description: 'User staked SENTINEL tokens', valueUSD: () => randomBetween(5000, 1000000) },
  { type: 'CLAIM_REWARDS', contract: 'SentinelStaking', description: 'Staking rewards claimed', valueUSD: () => randomBetween(100, 25000) },
  { type: 'INSURANCE_CLAIM', contract: 'SentinelInsurancePool', description: 'Insurance claim approved and paid out', valueUSD: () => randomBetween(50000, 500000) },
];

function indexEvents(count = 100) {
  console.log('📡 Starting Sentinel L3 On-Chain Event Indexer...\n');
  console.log(`📊 Indexing ${count} simulated on-chain events...\n`);

  const events = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const template = EVENT_TYPES[i % EVENT_TYPES.length];
    events.push({
      index: i + 1,
      type: template.type,
      contract: template.contract,
      description: template.description,
      txHash: generateTxHash(),
      blockNumber: 22_400_000 + i,
      timestamp: new Date(now - (count - i) * 60000).toISOString(),
      valueUSD: template.valueUSD(),
    });
  }

  // Summarize
  const byType = {};
  let totalValue = 0;
  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    totalValue += e.valueUSD;
  }

  const timestamp = new Date().toISOString();
  const typeRows = Object.entries(byType)
    .map(([type, cnt]) => `| \`${type}\` | ${cnt} |`)
    .join('\n');

  const recentRows = events.slice(-10).reverse()
    .map(e => `| #${e.blockNumber} | \`${e.type}\` | \`${e.contract}\` | $${e.valueUSD.toLocaleString()} | \`${e.txHash.slice(0, 18)}...\` |`)
    .join('\n');

  const report = `# Sentinel L3 — On-Chain Event Index Report

**Generated:** \`${timestamp}\`
**Total Events Indexed:** \`${count}\`
**Block Range:** \`22,400,000 – ${(22_400_000 + count - 1).toLocaleString()}\`
**Total Value Processed:** \`$${totalValue.toLocaleString()}\`

---

## 📊 Event Type Breakdown
| Event Type | Count |
|---|---|
${typeRows}

---

## 🔍 Last 10 Events (Most Recent First)
| Block | Type | Contract | Value | Tx Hash |
|---|---|---|---|---|
${recentRows}

---
*Generated automatically by Sentinel L3 On-Chain Event Indexer.*
`;

  const outputDir = path.join(__dirname, '../docs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'EVENT_INDEX_REPORT.md'), report);

  console.log('====================================================');
  console.log(`✅ INDEXING COMPLETE`);
  console.log(`📊 Events Indexed:     ${count}`);
  console.log(`💰 Total Value:        $${totalValue.toLocaleString()}`);
  console.log(`📄 Report saved to:    docs/EVENT_INDEX_REPORT.md`);
  console.log('====================================================\n');
}

if (require.main === module) {
  indexEvents(100);
}

module.exports = { indexEvents };
