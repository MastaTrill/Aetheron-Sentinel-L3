async function main() {
  const url = 'https://api-sepolia.etherscan.io/v2/api?chainid=11155111&module=contract&action=getabi&address=0x3154Cf16ccdb4C6d922629664174b904d80F2C35';
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Etherscan Sepolia V2 ABI Response:', data);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

main().catch(console.error);
