'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { collectHighSeverityAdvisories, validateAuditReport } = require('../scripts/validate-dependency-audit.cjs');

const ellipticPolicy = {
  exceptions: [
    {
      advisory: 'GHSA-848j-6mx2-7j84',
      package: 'elliptic',
      scopes: ['toolchain'],
      expiresOn: '2026-09-01',
      reason: 'Development-only verification dependency with no patched release.'
    }
  ]
};

function reportWith(advisory) {
  return {
    vulnerabilities: {
      '@ethersproject/signing-key': {
        severity: advisory.severity,
        via: ['elliptic']
      },
      elliptic: {
        severity: advisory.severity,
        via: [advisory]
      }
    },
    metadata: {
      vulnerabilities: {
        high: advisory.severity === 'high' ? 2 : 0,
        critical: advisory.severity === 'critical' ? 2 : 0
      }
    }
  };
}

test('resolves transitive findings to one advisory leaf', () => {
  const findings = collectHighSeverityAdvisories(
    reportWith({
      dependency: 'elliptic',
      severity: 'high',
      title: 'Risky cryptographic primitive',
      url: 'https://github.com/advisories/GHSA-848j-6mx2-7j84'
    })
  );

  assert.deepEqual(findings, [
    {
      advisory: 'GHSA-848J-6MX2-7J84',
      package: 'elliptic',
      severity: 'high',
      title: 'Risky cryptographic primitive',
      url: 'https://github.com/advisories/GHSA-848j-6mx2-7j84'
    }
  ]);
});

test('accepts the exact unexpired toolchain exception', () => {
  const result = validateAuditReport(
    reportWith({
      dependency: 'elliptic',
      severity: 'high',
      title: 'Risky cryptographic primitive',
      url: 'https://github.com/advisories/GHSA-848j-6mx2-7j84'
    }),
    ellipticPolicy,
    'toolchain',
    new Date('2026-08-15T00:00:00Z')
  );

  assert.equal(result.approved.length, 1);
});

test('rejects an unknown high-severity advisory', () => {
  assert.throws(
    () =>
      validateAuditReport(
        reportWith({
          dependency: 'elliptic',
          severity: 'high',
          title: 'Different advisory',
          url: 'https://github.com/advisories/GHSA-1111-2222-3333'
        }),
        ellipticPolicy,
        'toolchain',
        new Date('2026-08-15T00:00:00Z')
      ),
    /no matching exception/
  );
});

test('rejects an expired exception', () => {
  assert.throws(
    () =>
      validateAuditReport(
        reportWith({
          dependency: 'elliptic',
          severity: 'high',
          title: 'Risky cryptographic primitive',
          url: 'https://github.com/advisories/GHSA-848j-6mx2-7j84'
        }),
        ellipticPolicy,
        'toolchain',
        new Date('2026-09-01T00:00:00Z')
      ),
    /exception expired/
  );
});

test('never permits a critical finding', () => {
  assert.throws(
    () =>
      validateAuditReport(
        reportWith({
          dependency: 'elliptic',
          severity: 'critical',
          title: 'Critical advisory',
          url: 'https://github.com/advisories/GHSA-848j-6mx2-7j84'
        }),
        ellipticPolicy,
        'toolchain',
        new Date('2026-08-15T00:00:00Z')
      ),
    /critical findings cannot be excepted/
  );
});
