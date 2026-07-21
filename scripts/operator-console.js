import readline from 'readline';
import hardhatModule from 'hardhat';
const hre = hardhatModule.default ?? hardhatModule;
import fs from 'fs';

const addresses = JSON.parse(fs.readFileSync('./DEPLOYED_ADDRESSES.json', 'utf8'));
const contractAddress =
  process.env.SENTINEL_CORE_ADDRESS ||
  addresses.SentinelCore ||
  '0x2102C76C6528ECf7ebBf5102495d7531E823b6B5';

async function getContract() {
  const { ethers } = await hre.network.getOrCreate();
  const SentinelCore = await ethers.getContractFactory('SentinelCore');
  return SentinelCore.attach(contractAddress);
}

async function printStatus() {
  try {
    const sentinel = await getContract();
    const active = await sentinel.heartbeatActive();
    const owner = await sentinel.owner();
    console.log(`\n=== Sentinel Core Status ===`);
    console.log(`Contract: ${contractAddress}`);
    console.log(`Owner:    ${owner}`);
    console.log(
      `Status:   ${active ? '✅ ACTIVE (Heartbeat running)' : '🚨 HALTED (Circuit Breaker Triggered)'}`
    );
    console.log(`============================\n`);
  } catch (err) {
    console.error('Failed to get status:', err.message);
  }
}

async function pulseHeartbeat() {
  try {
    const sentinel = await getContract();
    const { ethers } = await hre.network.getOrCreate();
    const signers = await ethers.getSigners();
    console.log(`Pulsing heartbeat from: ${signers[0].address}`);
    const tx = await sentinel.pulseHeartbeat();
    const receipt = await tx.wait();
    console.log(`✅ Heartbeat pulsed in tx: ${receipt.hash}`);
  } catch (err) {
    console.error('❌ Heartbeat pulse failed:', err.message);
  }
}

async function triggerCircuitBreaker() {
  try {
    const sentinel = await getContract();
    console.log(`Triggering circuit breaker...`);
    const tx = await sentinel.triggerCircuitBreaker();
    const receipt = await tx.wait();
    console.log(`🚨 Circuit breaker triggered in tx: ${receipt.hash}`);
  } catch (err) {
    console.error('❌ Circuit breaker trigger failed:', err.message);
  }
}

async function main() {
  const arg = process.env.CONSOLE_ACTION || process.argv[2];
  if (arg === 'status') {
    await printStatus();
  } else if (arg === 'pulse') {
    await pulseHeartbeat();
  } else if (arg === 'halt') {
    await triggerCircuitBreaker();
  } else {
    // Interactive Mode
    console.log('--- Sentinel Operator Console ---');
    console.log('1. View Status');
    console.log('2. Pulse Heartbeat');
    console.log('3. Trigger Circuit Breaker');
    console.log('4. Exit');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('\nSelect an option: ', async answer => {
      rl.close();
      if (answer === '1') {
        await printStatus();
      } else if (answer === '2') {
        await pulseHeartbeat();
      } else if (answer === '3') {
        await triggerCircuitBreaker();
      } else {
        console.log('Exiting console.');
      }
    });
  }
}

main().catch(console.error);
