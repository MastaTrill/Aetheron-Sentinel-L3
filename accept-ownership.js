import { task } from 'hardhat/config';
import fs from 'fs';

task(
  'accept-ownership',
  'Generates a Gnosis Safe batch to accept ownership for pending contracts'
).setAction(async (taskArgs, hre) => {
  const { ethers } = hre;
  const treasuryAddr =
    process.env.SENTINEL_TREASURY || '0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2';
  const chainId = await hre.getChainId();

  console.log(`Generating Ownership Acceptance Batch...`);
  console.log(`Target Treasury (Safe): ${treasuryAddr}`);
  console.log(`Chain ID: ${chainId}\n`);

  const addresses = JSON.parse(fs.readFileSync('./DEPLOYED_ADDRESSES.json', 'utf8'));

  const TREASURY_ROUTED = [
    'AetheronBridge',
    'SentinelOracleNetwork',
    'SentinelZKOracle',
    'SentinelAMM',
    'SentinelInsuranceProtocol',
    'SentinelReferralSystem',
    'SentinelStaking',
    'SentinelRewardAggregator',
    'SentinelSecurityTokenization',
  ];

  const transactions = [];
  const iface = new ethers.Interface(['function acceptOwnership() external']);

  for (const name of TREASURY_ROUTED) {
    const addr = addresses[name];
    if (!addr) continue;

    const contract = await ethers.getContractAt(
      ['function pendingOwner() view returns (address)'],
      addr
    );

    try {
      const pending = await contract.pendingOwner();
      if (pending.toLowerCase() === treasuryAddr.toLowerCase()) {
        console.log(`  ➕ Adding ${name} (${addr})`);
        transactions.push({
          to: addr,
          value: '0',
          data: iface.encodeFunctionData('acceptOwnership'),
          contractMethod: {
            inputs: [],
            name: 'acceptOwnership',
            payable: false,
          },
          contractInputsValues: {},
        });
      } else {
        console.log(`  ${name.padEnd(25)}: No pending transfer for Treasury`);
      }
    } catch (e) {
      // Not using Ownable2Step or query failed
    }
  }

  if (transactions.length === 0) {
    console.log('\nNo pending transfers for the treasury address found.');
    return;
  }

  const safeBatch = {
    version: '1.0',
    chainId: chainId.toString(),
    createdAt: Date.now(),
    meta: {
      name: 'Treasury Batch Ownership Acceptance',
      description: 'Batch transactions to accept ownership for routed contracts.',
      txBuilderVersion: '1.16.5',
      createdFromSafeAddress: treasuryAddr,
      createdFromOwnerAddress: '',
      checksum: '',
    },
    transactions,
  };

  const outPath = 'scripts/accept-ownership.safe.json';
  fs.writeFileSync(outPath, JSON.stringify(safeBatch, null, 2));

  console.log(`\n✅ Wrote ${transactions.length} transactions to ${outPath}`);
  console.log('Next: Import this file into the Safe Transaction Builder UI.');
});
