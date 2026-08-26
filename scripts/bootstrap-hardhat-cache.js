#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

console.log('Bootstrapping Hardhat compiler cache (network-enabled environment required)...');
const run = spawnSync('npx', ['hardhat', 'compile'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (run.status !== 0) {
  console.error(
    'Failed to bootstrap compiler cache. Ensure outbound access to binaries.soliditylang.org.'
  );
  process.exit(run.status || 1);
}
console.log('Hardhat compile succeeded; compiler cache is now populated on this runner.');
