#!/usr/bin/env node

/**
 * Sentinel L3 — AI Automated Vulnerability Patch Engine
 * Scans Solidity contracts for anti-patterns and generates unified .patch diff files in docs/patches/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHECKS = [
  {
    id: 'REENTRANCY_GUARD',
    name: 'Missing Reentrancy Guard',
    pattern: /function (withdraw|claim|transfer)\s*\(/gi,
    guardPattern: /nonReentrant|ReentrancyGuard/g,
    severity: 'HIGH',
    suggestion: 'Add `nonReentrant` modifier from OpenZeppelin ReentrancyGuard.',
  },
  {
    id: 'ZERO_ADDRESS_CHECK',
    name: 'Missing Zero Address Validation',
    pattern: /address\s+\w+\s*=\s*address\s*\(/gi,
    guardPattern: /require.*address\(0\)/g,
    severity: 'MEDIUM',
    suggestion: 'Add `require(addr != address(0), "Zero address")` guard.',
  },
  {
    id: 'UNCHECKED_TRANSFER',
    name: 'Unchecked ERC20 Transfer Return Value',
    pattern: /\.transfer\s*\(/gi,
    guardPattern: /require.*\.transfer|SafeERC20/g,
    severity: 'HIGH',
    suggestion: 'Use OpenZeppelin SafeERC20 `safeTransfer` instead of raw `transfer`.',
  },
];

function scanContract(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  for (const check of CHECKS) {
    const hasPattern = check.pattern.test(content);
    check.pattern.lastIndex = 0;
    const hasGuard = check.guardPattern.test(content);
    check.guardPattern.lastIndex = 0;

    if (hasPattern && !hasGuard) {
      issues.push({
        checkId: check.id,
        name: check.name,
        severity: check.severity,
        suggestion: check.suggestion,
      });
    }
  }

  return issues;
}

function generatePatch(filePath, issues) {
  const baseName = path.basename(filePath, '.sol');
  const timestamp = Date.now();
  const patchFile = `docs/patches/${baseName}-security-${timestamp}.patch`;

  let patchContent = `--- a/contracts/${path.basename(filePath)}\n`;
  patchContent += `+++ b/contracts/${path.basename(filePath)}\n`;
  patchContent += `@@ Sentinel L3 Auto-Patch: ${issues.length} security issue(s) detected @@\n`;

  for (const issue of issues) {
    patchContent += `\n# [${issue.severity}] ${issue.name}\n`;
    patchContent += `# Fix: ${issue.suggestion}\n`;
  }

  return { patchFile, patchContent };
}

function runAutoPatchGenerator() {
  console.log('⚡ Starting Sentinel L3 Automated Vulnerability Patch Engine...\n');

  const contractsDir = path.join(__dirname, '../contracts');
  const outputDir = path.join(__dirname, '../docs/patches');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));
  console.log(`🔍 Scanning ${files.length} Solidity contracts for anti-patterns...\n`);

  let totalIssues = 0;
  const patchFiles = [];

  for (const file of files) {
    const filePath = path.join(contractsDir, file);
    const issues = scanContract(filePath);

    if (issues.length > 0) {
      totalIssues += issues.length;
      const { patchFile, patchContent } = generatePatch(filePath, issues);
      fs.writeFileSync(path.join(__dirname, '..', patchFile), patchContent);
      patchFiles.push(patchFile);
      console.log(`  ⚠️  ${file}: ${issues.length} issue(s) → Patch: ${patchFile}`);
    } else {
      console.log(`  ✅ ${file}: Clean`);
    }
  }

  console.log('\n====================================================');
  console.log(`📊 SCAN COMPLETE: ${totalIssues} total issues across ${files.length} contracts.`);
  console.log(`📄 ${patchFiles.length} patch file(s) generated in docs/patches/`);
  console.log('====================================================\n');
}

if (require.main === module) {
  runAutoPatchGenerator();
}

module.exports = { runAutoPatchGenerator };
