'use strict';

const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_POLICY_PATH = path.join(ROOT, 'config', 'dependency-audit-exceptions.json');
const HIGH_SEVERITIES = new Set(['high', 'critical']);

function parseArgs(argv) {
  const args = { scope: 'toolchain', reportPath: null, policyPath: DEFAULT_POLICY_PATH };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--scope') {
      args.scope = argv[++index];
    } else if (value === '--report') {
      args.reportPath = argv[++index];
    } else if (value === '--policy') {
      args.policyPath = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!new Set(['production', 'toolchain']).has(args.scope)) {
    throw new Error(`Unsupported audit scope: ${args.scope}`);
  }

  return args;
}

function advisoryId(url = '') {
  const match = String(url).match(/GHSA-[0-9a-z-]+/i);
  return match ? match[0].toUpperCase() : null;
}

function collectHighSeverityAdvisories(report) {
  const vulnerabilities = report.vulnerabilities || {};
  const advisories = [];

  function visit(name, inheritedSeverity, visited) {
    if (visited.has(name)) return;

    const vulnerability = vulnerabilities[name];
    if (!vulnerability) {
      advisories.push({
        advisory: null,
        package: name,
        severity: inheritedSeverity,
        title: `Unresolved vulnerability dependency: ${name}`
      });
      return;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(name);
    const severity = vulnerability.severity || inheritedSeverity;
    let foundLeaf = false;

    for (const via of vulnerability.via || []) {
      if (typeof via === 'string') {
        visit(via, severity, nextVisited);
        foundLeaf = true;
      } else if (via && typeof via === 'object') {
        const leafSeverity = via.severity || severity;
        if (!HIGH_SEVERITIES.has(leafSeverity)) continue;

        advisories.push({
          advisory: advisoryId(via.url),
          package: via.dependency || via.name || name,
          severity: leafSeverity,
          title: via.title || 'Unnamed npm advisory',
          url: via.url || null
        });
        foundLeaf = true;
      }
    }

    if (!foundLeaf && HIGH_SEVERITIES.has(severity)) {
      advisories.push({
        advisory: null,
        package: name,
        severity,
        title: `High-severity vulnerability without an advisory leaf: ${name}`
      });
    }
  }

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (HIGH_SEVERITIES.has(vulnerability.severity)) {
      visit(name, vulnerability.severity, new Set());
    }
  }

  const unique = new Map();
  for (const finding of advisories) {
    const key = [
      finding.advisory || 'unknown',
      finding.package,
      finding.severity,
      finding.title
    ].join('|');
    unique.set(key, finding);
  }

  return [...unique.values()];
}

function validateAuditReport(report, policy, scope, now = new Date()) {
  if (report.error) {
    throw new Error(`npm audit failed to produce a valid report: ${report.error.summary || report.error}`);
  }

  const findings = collectHighSeverityAdvisories(report);
  const approved = [];
  const rejected = [];

  for (const finding of findings) {
    if (finding.severity === 'critical') {
      rejected.push({ finding, reason: 'critical findings cannot be excepted' });
      continue;
    }

    const exception = (policy.exceptions || []).find(
      (entry) =>
        entry.advisory === finding.advisory &&
        entry.package === finding.package &&
        entry.scopes.includes(scope)
    );

    if (!exception) {
      rejected.push({ finding, reason: 'no matching exception' });
      continue;
    }

    const expiry = Date.parse(`${exception.expiresOn}T00:00:00Z`);
    if (!Number.isFinite(expiry) || now.getTime() >= expiry) {
      rejected.push({ finding, reason: `exception expired on ${exception.expiresOn}` });
      continue;
    }

    approved.push({ finding, exception });
  }

  if (rejected.length > 0) {
    const details = rejected
      .map(
        ({ finding, reason }) =>
          `${finding.severity.toUpperCase()} ${finding.advisory || 'UNKNOWN'} ${finding.package}: ${reason}`
      )
      .join('\n');
    throw new Error(`Dependency audit rejected:\n${details}`);
  }

  return { findings, approved };
}

function runNpmAudit(scope) {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['audit', '--json', '--audit-level=high'];

  if (scope === 'production') {
    args.push('--omit=dev');
  }

  const result = spawnSync(npmExecutable, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });

  if (!result.stdout) {
    throw new Error(`npm audit produced no JSON output: ${result.stderr || 'unknown error'}`);
  }

  return JSON.parse(result.stdout);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(readFileSync(args.policyPath, 'utf8'));
  const report = args.reportPath
    ? JSON.parse(readFileSync(path.resolve(args.reportPath), 'utf8'))
    : runNpmAudit(args.scope);
  const result = validateAuditReport(report, policy, args.scope);

  if (result.findings.length === 0) {
    console.log(`DEPENDENCY AUDIT: PASS (${args.scope}; no high or critical findings)`);
    return;
  }

  console.log(`DEPENDENCY AUDIT: PASS (${args.scope}; explicit temporary exceptions)`);
  for (const { finding, exception } of result.approved) {
    console.log(
      `- ${finding.advisory} ${finding.package}: expires ${exception.expiresOn}; ${exception.reason}`
    );
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  advisoryId,
  collectHighSeverityAdvisories,
  parseArgs,
  validateAuditReport
};
