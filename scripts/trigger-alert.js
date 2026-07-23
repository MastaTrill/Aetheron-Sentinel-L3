import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';

async function main() {
  const addresses = JSON.parse(fs.readFileSync('DEPLOYED_ADDRESSES_simulation.json', 'utf8'));
  const oracleAddress = addresses.SentinelCrossChainSecurityOracle;
  const oracle = await ethers.getContractAt('SentinelCrossChainSecurityOracle', oracleAddress);

  const payload = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'string', 'uint256'],
    [ethers.ZeroHash, 'CRITICAL_ATTACK_DETECTED', 95n]
  );

  const [owner] = await ethers.getSigners();
  const tx = await oracle.ccipReceiveAlert(1n, owner.address, payload);
  await tx.wait();
  console.log('Triggered on-chain lockdown transaction:', tx.hash);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
