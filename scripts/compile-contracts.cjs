#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

process.stdout.write('Compiling Solidity contracts with Hardhat...\n');

const run =
  process.platform === 'win32'
    ? spawnSync('npx hardhat compile', {
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync('npx', ['hardhat', 'compile'], {
        stdio: 'inherit',
      });

if (run.error) {
  process.stderr.write(`${run.error.message}\n`);
  process.exitCode = 2;
  return;
}

if (run.status === 0) {
  process.exitCode = 0;
  return;
}

process.stderr.write(`
Hardhat compile failed.

If you see HH502 or HHE905 (compiler download errors), this environment is blocking
the compiler metadata or binary fetch (commonly proxy/tunneling policy).

Fail-fast guidance:
  1) Pre-populate Hardhat compiler cache in a network-enabled environment.
  2) Reuse that cache in CI/local ephemeral runners.
  3) Ensure outbound access to binaries.soliditylang.org if direct downloads are required.

Until then, compile cannot proceed in this environment.
`);

process.exitCode = 2;
