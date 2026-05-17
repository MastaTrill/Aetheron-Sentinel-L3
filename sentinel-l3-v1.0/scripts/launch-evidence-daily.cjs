#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const runDay = process.env.RUN_DAY || new Date().toISOString().slice(0, 10);
const logDir = path.join('logs', 'verification', runDay);
const relayers = process.env.RELAYER_ADDRESSES || '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB';
const fullRun = args.has('--full');
const skipNpmCi = args.has('--skip-npm-ci');
const dryRun = args.has('--dry-run');

fs.mkdirSync(logDir, { recursive: true });

function nowIso() {
  return new Date().toISOString();
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(logDir, name), JSON.stringify(data, null, 2) + '\n');
}

function runStep(name, command, options = {}) {
  const logPath = path.join(logDir, `${name}.log`);
  const startedAt = nowIso();

  if (dryRun) {
    const body = `[dry-run] ${command}\n`;
    fs.writeFileSync(logPath, body);
    return { name, command, exitCode: 0, startedAt, finishedAt: nowIso(), logPath };
  }

  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    maxBuffer: 50 * 1024 * 1024,
  });

  const output = [
    `$ ${command}`,
    '',
    '## stdout',
    result.stdout || '',
    '',
    '## stderr',
    result.stderr || '',
    '',
    `exitCode=${result.status}`,
  ].join('\n');

  fs.writeFileSync(logPath, output);

  return {
    name,
    command,
    exitCode: result.status,
    signal: result.signal,
    startedAt,
    finishedAt: nowIso(),
    logPath,
  };
}

function tryReadJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { parse_error: error.message, raw };
  }
}

async function fetchSubgraphSnapshot() {
  const url = process.env.SUBGRAPH_QUERY_URL || process.env.SUBGRAPH_URL;
  if (!url || dryRun) return null;

  const query =
    process.env.SUBGRAPH_HEALTH_QUERY ||
    `
    query SentinelEvidenceSnapshot {
      _meta { block { number hash timestamp } deployment }
    }
  `;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.SUBGRAPH_TIMEOUT_MS || 15000)
  );

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    return {
      url,
      ok: response.ok,
      status: response.status,
      capturedAt: nowIso(),
      response: parsed,
    };
  } catch (error) {
    return { url, ok: false, capturedAt: nowIso(), error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function statusFromExit(code) {
  return code === 0 ? 'PASS' : 'FAIL';
}

function markdownTableRows(rows, emptyRow) {
  if (rows.length === 0) return emptyRow;
  return rows.map(row => row.join(' | ')).join('\n');
}

function formatTxRows(transactions) {
  const rows = Array.isArray(transactions) ? transactions : [];
  return markdownTableRows(
    rows.map(tx => [
      tx.utc_time || '',
      tx.action || '',
      tx.tx_hash || tx.hash || '',
      tx.contract || '',
      tx.result || '',
      tx.gas_used || '',
      tx.confirmations || '',
      tx.notes || '',
    ]),
    ' |  |  |  |  |  |  |  |'
  );
}

function formatFailureRows(failures) {
  const rows = Array.isArray(failures) ? failures : [];
  return markdownTableRows(
    rows.map(failure => [
      failure.utc_time || '',
      failure.component || '',
      failure.severity || '',
      failure.symptom || '',
      failure.tx_hash || failure.log_link || '',
      failure.root_cause || '',
      failure.remediation || '',
      failure.status || '',
    ]),
    ' |  |  |  |  |  |  |  |'
  );
}

function formatIndexingRows(indexing) {
  const rows = Array.isArray(indexing) ? indexing : [];
  return markdownTableRows(
    rows.map(entry => [
      entry.tx_hash || entry.event || '',
      entry.block || '',
      entry.event_emitted_at || '',
      entry.subgraph_indexed_at || '',
      entry.dashboard_visible_at || '',
      entry.index_latency || '',
      entry.ui_latency || '',
      entry.notes || '',
    ]),
    ' |  |  |  |  |  |  |  |'
  );
}

function formatRelayerRows(relayerBehavior) {
  const rows = Array.isArray(relayerBehavior) ? relayerBehavior : [];
  if (rows.length > 0) {
    return markdownTableRows(
      rows.map(entry => [
        entry.relayer_address || entry.address || '',
        entry.expected_role || '',
        entry.observed_action || '',
        entry.last_seen || '',
        entry.success_count || '',
        entry.failure_count || '',
        entry.notes || '',
      ]),
      ''
    );
  }

  return (
    relayers
      .split(',')
      .map(address => address.trim())
      .filter(Boolean)
      .map(
        address =>
          `${address} | Approved Sepolia relayer | See verify-bridge-relayers.log |  |  |  | Auto-filled from RELAYER_ADDRESSES`
      )
      .join('\n') || ' |  |  |  |  |  |'
  );
}

(async function main() {
  const manifest = {
    runDay,
    logDir,
    fullRun,
    dryRun,
    startedAt: nowIso(),
    environment: {
      network: process.env.HARDHAT_NETWORK || process.env.NETWORK || 'sepolia',
      relayers,
      subgraphConfigured: Boolean(process.env.SUBGRAPH_QUERY_URL || process.env.SUBGRAPH_URL),
      dashboardUrl: process.env.DASHBOARD_URL || '',
      commit: process.env.GITHUB_SHA || process.env.COMMIT_SHA || '',
    },
    steps: [],
  };

  if (fullRun && !skipNpmCi) manifest.steps.push(runStep('npm-ci', 'npm ci'));
  if (fullRun) manifest.steps.push(runStep('compile', 'npm run compile'));
  if (fullRun) manifest.steps.push(runStep('hardhat-test', 'npm test'));
  if (fullRun)
    manifest.steps.push(
      runStep(
        'python-unittest',
        'PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py" -v'
      )
    );
  if (fullRun) manifest.steps.push(runStep('graph-codegen', 'npm run codegen'));
  if (fullRun) manifest.steps.push(runStep('graph-build', 'npm run build'));
  if (fullRun) manifest.steps.push(runStep('dashboard-build', 'npm run dashboard:build'));

  manifest.steps.push(runStep('section7-final-sweep', 'node scripts/section7-final-sweep.cjs'));
  manifest.steps.push(runStep('audit-allowlists', 'node scripts/audit-allowlists.cjs'));
  manifest.steps.push(
    runStep('verify-bridge-relayers', 'node scripts/verify-bridge-relayers.cjs', {
      env: { RELAYER_ADDRESSES: relayers },
    })
  );

  const subgraphSnapshot = await fetchSubgraphSnapshot();
  if (subgraphSnapshot) writeJson('subgraph-snapshot.json', subgraphSnapshot);

  const manualEvidence = {
    transactions: tryReadJsonEnv('EVIDENCE_TRANSACTIONS_JSON', []),
    failures: tryReadJsonEnv('EVIDENCE_FAILURES_JSON', []),
    indexing: tryReadJsonEnv('EVIDENCE_INDEXING_JSON', []),
    relayerBehavior: tryReadJsonEnv('EVIDENCE_RELAYER_BEHAVIOR_JSON', []),
  };

  const failedSteps = manifest.steps.filter(step => step.exitCode !== 0);
  const overall = failedSteps.length === 0 ? 'PASS' : 'FAIL';

  const notes = `# Sentinel L3 Sepolia Daily Notes — ${runDay}

## Summary
- Run date: ${runDay}
- Operator: ${process.env.OPERATOR || process.env.USER || ''}
- Environment: ${manifest.environment.network}
- Deployment/version/commit: ${manifest.environment.commit}
- Overall result: ${overall}

## Automated checks
| Check | Result | Log |
| --- | --- | --- |
${manifest.steps.map(step => `| ${step.name} | ${statusFromExit(step.exitCode)} | \`${path.basename(step.logPath)}\` |`).join('\n')}

## Transactions
| UTC time | Action | Tx hash | Contract | Result | Gas used | Confirmations | Notes |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
${formatTxRows(manualEvidence.transactions)}

## Failures / anomalies
| UTC time | Component | Severity | Symptom | Tx hash/log link | Root cause | Remediation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
${formatFailureRows(manualEvidence.failures)}

## Indexing latency
| Tx hash/event | Block | Event emitted at | Subgraph indexed at | Dashboard visible at | Index latency | UI latency | Notes |
| --- | ---: | --- | --- | --- | ---: | ---: | --- |
${formatIndexingRows(manualEvidence.indexing)}

## Relayer behavior
| Relayer address | Expected role | Observed action | Last seen | Success count | Failure count | Notes |
| --- | --- | --- | --- | ---: | ---: | --- |
${formatRelayerRows(manualEvidence.relayerBehavior)}

## Stability data
| Metric | Value | Evidence link |
| --- | ---: | --- |
| Section 7 sweep pass/fail | ${statusFromExit(manifest.steps.find(s => s.name === 'section7-final-sweep')?.exitCode)} | \`section7-final-sweep.log\` |
| Allowlist audit pass/fail | ${statusFromExit(manifest.steps.find(s => s.name === 'audit-allowlists')?.exitCode)} | \`audit-allowlists.log\` |
| Relayer verification pass/fail | ${statusFromExit(manifest.steps.find(s => s.name === 'verify-bridge-relayers')?.exitCode)} | \`verify-bridge-relayers.log\` |
| Subgraph latest indexed block | ${subgraphSnapshot?.response?.data?._meta?.block?.number || ''} | \`subgraph-snapshot.json\` |
| Dashboard data freshness | ${process.env.DASHBOARD_VISIBLE_AT || ''} | ${process.env.DASHBOARD_URL || ''} |

## Required manual follow-up
- [ ] Add real Sepolia bridge transfer tx hash if not already provided through EVIDENCE_TRANSACTIONS_JSON.
- [ ] Add governance/timelock tx hash if not already provided through EVIDENCE_TRANSACTIONS_JSON.
- [ ] Add staking/CoreLoop tx hash if not already provided through EVIDENCE_TRANSACTIONS_JSON.
- [ ] Confirm subgraph/dashboard visibility after traffic session.
- [ ] Review failed automated checks and add remediation notes.
`;

  fs.writeFileSync(path.join(logDir, 'DAILY_NOTES.md'), notes);

  manifest.finishedAt = nowIso();
  manifest.overall = overall;
  manifest.failedSteps = failedSteps.map(step => step.name);
  writeJson('run-manifest.json', manifest);

  console.log(`Wrote ${path.join(logDir, 'DAILY_NOTES.md')}`);
  console.log(`Wrote ${path.join(logDir, 'run-manifest.json')}`);
  process.exit(failedSteps.length === 0 ? 0 : 1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
