#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

process.stdout.write('Compiling Solidity contracts with Hardhat...\n');

const run = spawnSync('npx', ['hardhat', 'compile'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (run.status === 0) {
  process.exit(0);
}

process.stderr.write(`
Hardhat compile failed.

If you see HH502 (compiler version list download error), this environment is blocking
the compiler metadata fetch (commonly proxy/tunneling policy).

Fail-fast guidance:
  1) Pre-populate Hardhat compiler cache in a network-enabled environment.
  2) Reuse that cache in CI/local ephemeral runners.
  3) Ensure outbound access to binaries.soliditylang.org if direct downloads are required.

Until then, compile cannot proceed in this environment.
`);

process.exit(2);
