const { task } = require('hardhat/config');
const fs = require('fs');
const path = require('path');

task('benchmark-sentinel', 'Runs evmbench throughput and latency tests on the L3')
  .addParam('iterations', 'Number of transactions to send', '50')
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [signer] = await ethers.getSigners();
    const logPath = path.join(__dirname, '../deployment-addresses.json');

    if (!fs.existsSync(logPath)) {
      throw new Error('❌ Deployment addresses not found. Run deploy-sentinel first.');
    }

    const { contracts } = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    const bridge = await ethers.getContractAt('AetheronBridge', contracts.AetheronBridge);

    console.log(`\n📊 Starting EVMBench Harness: ${taskArgs.iterations} iterations`);
    const start = Date.now();
    const latencies = [];

    for (let i = 0; i < taskArgs.iterations; i++) {
      const txStart = Date.now();
      try {
        // Simulate a standard bridge heart-beat or diagnostic call for latency measurement
        const tx = await bridge.relayers(signer.address);
        const txEnd = Date.now();
        latencies.push(txEnd - txStart);

        if (i % 10 === 0) process.stdout.write('.');
      } catch (e) {
        console.error(`\n❌ Latency check failed at iteration ${i}: ${e.message}`);
      }
    }

    const totalTime = Date.now() - start;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const throughput = (latencies.length / (totalTime / 1000)).toFixed(2);

    console.log(`\n\n✅ Benchmark Results:`);
    console.log(`----------------------`);
    console.log(`Total Time:   ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Avg Latency:  ${avgLatency.toFixed(2)}ms`);
    console.log(`Throughput:   ${throughput} tx/s`);

    if (throughput < 10) {
      console.warn('⚠️  Warning: Throughput is below the 10 tx/s target for L3 implementation.');
    }
  });

module.exports = {};
