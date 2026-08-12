import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hardhatCli = fileURLToPath(
  new URL('../node_modules/hardhat/dist/src/cli.js', import.meta.url)
);
const researchArtifacts = fileURLToPath(
  new URL('../artifacts/contracts/research', import.meta.url)
);

function runHardhat(args) {
  const result = spawnSync(process.execPath, [hardhatCli, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Compile the complete source tree first so research contracts still receive
// compile coverage. Then remove only their generated artifacts so unqualified
// test factory lookups resolve deterministically to production contracts.
runHardhat(['compile']);
rmSync(researchArtifacts, { recursive: true, force: true });
runHardhat(['test', '--no-compile', ...process.argv.slice(2)]);
