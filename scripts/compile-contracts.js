import { spawnSync } from 'node:child_process';

process.stdout.write('Compiling Solidity contracts with Hardhat...\n');

const result =
  process.platform === 'win32'
    ? spawnSync('npx hardhat compile', {
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync('npx', ['hardhat', 'compile'], {
        stdio: 'inherit',
      });

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(2);
}

if (result.status !== 0) {
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
  process.exit(2);
}
