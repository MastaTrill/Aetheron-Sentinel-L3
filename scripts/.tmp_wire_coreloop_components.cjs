/**
 * Wire deployed optional CoreLoop components:
 *   - multiSigVault
 *   - securityAuditor
 *   - stakingSystem
 *
 * Leaves intentional zeroes for:
 *   - liquidityMining (not deployed in this phase)
 *   - rewardAggregator (not deployed in this phase)
 */
const { ethers } = require('ethers');
const fs = require('fs');
const vm = require('vm');

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

if (!PRIVATE_KEY || PRIVATE_KEY.length < 60) {
  console.error('OWNER_PRIVATE_KEY not set or too short.');
  process.exit(1);
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('site/contracts.js', 'utf8'), ctx);
  const c = ctx.window.SENTINEL_CONTRACTS;

  const coreLoop = new ethers.Contract(
    c.SentinelCoreLoop.address,
    [
      'function setSystemComponent(string memory componentName, address contractAddress) external',
      'function multiSigVault() view returns (address)',
      'function securityAuditor() view returns (address)',
      'function stakingSystem() view returns (address)',
      'function liquidityMining() view returns (address)',
      'function rewardAggregator() view returns (address)',
    ],
    signer,
  );

  const components = [
    { name: 'multiSigVault', addr: c.SentinelMultiSigVault?.address },
    { name: 'securityAuditor', addr: c.SentinelSecurityAuditor?.address },
    { name: 'stakingSystem', addr: c.SentinelStaking?.address },
  ];

  console.log(`CoreLoop: ${c.SentinelCoreLoop.address}`);
  console.log(`Signer: ${signer.address}\n`);

  const txs = [];
  for (const comp of components) {
    if (!comp.addr) {
      console.log(`⚠ Skipping ${comp.name}: no address in contracts.js`);
      continue;
    }
    console.log(`Wiring ${comp.name}...`);
    const tx = await coreLoop.setSystemComponent(comp.name, comp.addr);
    console.log(`  Tx: ${tx.hash}`);
    txs.push(tx);
  }

  console.log('\nWaiting for confirmations...\n');
  for (let i = 0; i < txs.length; i++) {
    const receipt = await txs[i].wait();
    console.log(
      `Tx[${i}] mined in block ${receipt.blockNumber} — status: ${receipt.status === 1 ? '✅' : '❌'}`,
    );
    if (receipt.status !== 1) process.exit(1);
  }

  console.log('\nFinal component state:');
  console.log(`  multiSigVault: ${await coreLoop.multiSigVault()}`);
  console.log(`  securityAuditor: ${await coreLoop.securityAuditor()}`);
  console.log(`  stakingSystem: ${await coreLoop.stakingSystem()}`);
  console.log(
    `  liquidityMining: ${await coreLoop.liquidityMining()} (intentional zero — not deployed in this phase)`,
  );
  console.log(
    `  rewardAggregator: ${await coreLoop.rewardAggregator()} (intentional zero — not deployed in this phase)`,
  );
})();
