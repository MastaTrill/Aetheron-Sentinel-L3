const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function main() {
  const root = process.cwd();
  const verifyDir = path.join(root, '.verify-tools');
  const packageJsonPath = path.join(verifyDir, 'package.json');

  const packageJson = {
    name: 'aetheron-sentinel-l3-verify-tools',
    private: true,
    version: '1.0.0',
    license: 'UNLICENSED',
    devDependencies: {
      '@nomicfoundation/hardhat-verify': '^3.0.0',
      dotenv: '^16.4.5',
      hardhat: '^3.4.0',
    },
  };

  await fs.mkdir(verifyDir, { recursive: true });
  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );

  if (process.platform === 'win32') {
    await execFileAsync(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm', 'install', '--prefix', verifyDir],
      {
        cwd: root,
        env: process.env,
      },
    );
  } else {
    await execFileAsync('npm', ['install', '--prefix', verifyDir], {
      cwd: root,
      env: process.env,
    });
  }

  console.log('Verify tooling is ready at .verify-tools/');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
