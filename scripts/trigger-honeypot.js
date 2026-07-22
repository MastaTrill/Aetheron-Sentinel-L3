import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';

async function main() {
  const addresses = JSON.parse(fs.readFileSync('DEPLOYED_ADDRESSES_simulation.json', 'utf8'));
  const decoyAddress = addresses.DecoyHoneypot;
  const decoy = await ethers.getContractAt('DecoyHoneypot', decoyAddress);

  const [owner, , attacker] = await ethers.getSigners();

  console.log('Simulating exploit attempt on decoy honeypot from attacker:', attacker.address);
  const tx = await decoy.connect(attacker).triggerHoneypotDrain();
  await tx.wait();
  console.log('Trapped exploit in Honeypot! Tx hash:', tx.hash);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
