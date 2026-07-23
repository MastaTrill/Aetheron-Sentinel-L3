import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';

async function main() {
  const addresses = JSON.parse(fs.readFileSync('DEPLOYED_ADDRESSES_simulation.json', 'utf8'));
  const breakerAddress = addresses.CircuitBreaker;
  const breaker = await ethers.getContractAt('CircuitBreaker', breakerAddress);

  const [owner] = await ethers.getSigners();

  // Unpause if paused
  const isPaused = await breaker.paused();
  if (isPaused) {
    const unpauseTx = await breaker.emergencyUnpause();
    await unpauseTx.wait();
    console.log('Unpaused CircuitBreaker:', unpauseTx.hash);
  }

  // Close circuit for chain 1
  const tx = await breaker.closeCircuit(1n);
  await tx.wait();
  console.log('Closed CircuitBreaker for chain 1:', tx.hash);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
