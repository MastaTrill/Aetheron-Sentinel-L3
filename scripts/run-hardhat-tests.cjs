const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const stashRoot = path.join(root, `.hardhat-test-stash-${process.pid}`);
const moves = [
  [path.join(root, 'contracts', 'research'), path.join(stashRoot, 'contracts-research')],
  [path.join(root, 'artifacts', 'contracts', 'research'), path.join(stashRoot, 'artifacts-contracts-research')],
];

function ensureParent(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function moveIfPresent(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureParent(to);
  fs.renameSync(from, to);
  return true;
}

const moved = [];
let exitCode = 1;

try {
  for (const [from, to] of moves) {
    if (moveIfPresent(from, to)) moved.push([from, to]);
  }

  console.log('Running Hardhat tests with contracts/research mirrors excluded from artifact discovery.');
  const hardhatCli = path.join(root, 'node_modules', 'hardhat', 'dist', 'src', 'cli.js');
  const result = spawnSync(process.execPath, [hardhatCli, 'test', ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} finally {
  for (const [from, to] of moved.reverse()) {
    if (fs.existsSync(to)) {
      ensureParent(from);
      fs.renameSync(to, from);
    }
  }
  if (fs.existsSync(stashRoot)) fs.rmSync(stashRoot, { recursive: true, force: true });
}

process.exit(exitCode);
