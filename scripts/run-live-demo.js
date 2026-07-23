import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('=== Launching Aetheron Sentinel L3 Live Defense Demo ===');

  // 1. Start Hardhat Node
  console.log('\n1. Starting Hardhat Node...');
  const hhNode = spawn('npx', ['hardhat', 'node'], { shell: true });

  await delay(5000); // Wait for node to boot

  // 2. Deploy contracts
  console.log('\n2. Deploying Sentinel contracts to local network...');
  await new Promise((resolve, reject) => {
    const deploy = spawn(
      'npx',
      ['hardhat', 'run', 'scripts/deploy.cjs', '--network', 'localhost'],
      { shell: true }
    );
    deploy.stdout.pipe(process.stdout);
    deploy.stderr.pipe(process.stderr);
    deploy.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error('Deployment failed'));
    });
  });

  // 3. Start threat gateway prototype
  console.log('\n3. Starting Sentinel threat analysis gateway...');
  const gateway = spawn('python', ['sentinel_gateway_prototype.py'], { shell: true });
  gateway.stdout.on('data', data => {
    console.log(`[Gateway] ${data.toString().trim()}`);
  });

  // 4. Start React dashboard dev server
  console.log('\n4. Starting dashboard frontend dev server...');
  const dashboard = spawn('npm', ['run', 'dashboard:dev'], { shell: true });
  dashboard.stdout.on('data', data => {
    if (data.toString().includes('Local:') || data.toString().includes('5173')) {
      console.log(`[Dashboard] ${data.toString().trim()}`);
    }
  });

  await delay(3000);
  console.log('\n=== Setup Complete! ===');
  console.log('Dashboard is running. Open http://localhost:5173 to view.');
  console.log('Trigger an attack simulation using: python scripts/simulate-attacks.py');
  console.log('Press Ctrl+C to stop all processes.');

  process.on('SIGINT', () => {
    console.log('\nCleaning up background processes...');
    hhNode.kill();
    gateway.kill();
    dashboard.kill();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Demo launch failed:', err);
});
