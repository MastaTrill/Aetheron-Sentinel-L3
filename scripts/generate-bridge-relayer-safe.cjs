const { ethers } = require('ethers');
const fs = require('fs');
const vm = require('vm');

function parseAddressList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((addr) => ethers.getAddress(addr));
}

(function main() {
  const relayers = parseAddressList(process.env.RELAYER_ADDRESSES || '');
  if (relayers.length === 0) {
    console.error(
      'No relayers provided. Set RELAYER_ADDRESSES as comma-separated addresses.',
    );
    console.error(
      'Example: RELAYER_ADDRESSES=0xabc...,0xdef... node scripts/generate-bridge-relayer-safe.cjs',
    );
    process.exit(1);
  }

  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('site/contracts.js', 'utf8'), ctx);
  const contracts = ctx.window.SENTINEL_CONTRACTS;

  const multisig = contracts.SentinelMultiSigVault?.address;
  const bridge = contracts.AetheronBridge?.address;
  if (!multisig || !bridge) {
    console.error(
      'Missing SentinelMultiSigVault or AetheronBridge in site/contracts.js',
    );
    process.exit(1);
  }

  const iface = new ethers.Interface([
    'function setRelayer(address relayer, bool authorized)',
  ]);
  const transactions = relayers.map((relayer) => ({
    to: bridge,
    value: '0',
    data: iface.encodeFunctionData('setRelayer', [relayer, true]),
    contractMethod: {
      inputs: [
        { internalType: 'address', name: 'relayer', type: 'address' },
        { internalType: 'bool', name: 'authorized', type: 'bool' },
      ],
      name: 'setRelayer',
      payable: false,
    },
    contractInputsValues: {
      relayer,
      authorized: 'true',
    },
  }));

  const safe = {
    version: '1.0',
    chainId: '11155111',
    createdAt: Date.now(),
    meta: {
      name: 'AetheronBridge Relayer Enablement (Sepolia)',
      description:
        'Enable approved relayer addresses on AetheronBridge via setRelayer(relayer, true).',
      txBuilderVersion: '1.16.5',
      createdFromSafeAddress: multisig,
      createdFromOwnerAddress: '',
      checksum: '',
    },
    transactions,
  };

  const outPath = 'scripts/bridge-relayer-enablement.sepolia.safe.json';
  fs.writeFileSync(outPath, JSON.stringify(safe, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`Bridge: ${bridge}`);
  console.log(`Multisig: ${multisig}`);
  console.log('Relayers included:');
  relayers.forEach((r) => console.log(`- ${r}`));
})();
