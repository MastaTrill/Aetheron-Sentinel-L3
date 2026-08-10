const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const tokenAddr = '0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e';
  const iface = new ethers.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function balanceOf(address) view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function totalSupply() view returns (uint256)',
    'function owner() view returns (address)',
  ]);
  const token = new ethers.Contract(tokenAddr, iface, provider);

  const startBlock = 48722817;
  const endBlock = await provider.getBlockNumber();
  const step = 9999;
  let allLogs = [];

  console.log(`Scanning Base blocks ${startBlock} -> ${endBlock}...`);
  for (let from = startBlock; from <= endBlock; from += step) {
    const to = Math.min(from + step - 1, endBlock);
    const filter = {
      address: tokenAddr,
      topics: [ethers.id('Transfer(address,address,uint256)')],
      fromBlock: from,
      toBlock: to,
    };
    const logs = await provider.getLogs(filter).catch(() => []);
    if (logs.length > 0) allLogs = allLogs.concat(logs);
  }

  console.log(`\n=== ALL ON-CHAIN AETH TOKEN TRANSFERS (${allLogs.length} total) ===`);
  const uniqueAddresses = new Set();
  for (const log of allLogs) {
    const parsed = iface.parseLog(log);
    const from = parsed.args.from;
    const to = parsed.args.to;
    const val = ethers.formatUnits(parsed.args.value, 18);
    console.log(`Block ${log.blockNumber}: ${from} -> ${to} | ${val} AETH (tx: ${log.transactionHash})`);
    if (from !== ethers.ZeroAddress) uniqueAddresses.add(from);
    if (to !== ethers.ZeroAddress) uniqueAddresses.add(to);
  }

  console.log('\n=== CURRENT HOLDER BALANCES & ON-CHAIN STATE ===');
  for (const addr of uniqueAddresses) {
    const [tokenBal, ethBal] = await Promise.all([
      token.balanceOf(addr),
      provider.getBalance(addr),
    ]);
    console.log(`Address: ${addr}`);
    console.log(`  AETH: ${ethers.formatUnits(tokenBal, 18)} AETH`);
    console.log(`  ETH:  ${ethers.formatEther(ethBal)} ETH`);
  }
}

main().catch(console.error);
