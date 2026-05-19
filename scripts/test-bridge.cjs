const { ethers } = require('ethers');

async function check(url, name) {
  try {
    const p = new ethers.JsonRpcProvider(url);
    const net = await p.getNetwork();
    console.log(`=== ${name} (${url}) ===`);
    console.log('Chain ID:', net.chainId.toString());
    const addresses = {
      'L1StandardBridge (Base Sepolia/Mainnet)': '0x3154Cf16ccdb4C6d922629664174b904d80F2C35',
      'OptimismPortal (Base Sepolia/Mainnet)': '0x49048044D57e1C92A77f79988d21Fa8fAF74E97e',
      'L1StandardBridge Proxy (Optimism Sepolia)': '0x12470abde062cd1be25c898fbf1c7501e4a30a10',
    };
    for (const [n, addr] of Object.entries(addresses)) {
      const code = await p.getCode(addr);
      console.log(`${n} (${addr}) Code Length:`, code.length);
    }
  } catch (err) {
    console.error(`Error for ${name}:`, err.message);
  }
}

async function main() {
  await check('https://ethereum-sepolia-rpc.publicnode.com', 'PublicNode Sepolia');
  await check('https://sepolia.drpc.org', 'dRPC Sepolia');
  await check('https://cloudflare-eth.com', 'Cloudflare Ethereum Mainnet');
}

main().catch(console.error);
