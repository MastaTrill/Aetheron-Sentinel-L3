import { loadManifest } from './manifest';
import { run } from 'hardhat';

async function main() {
  const tag = process.env.DEPLOY_TAG;
  if (!tag) throw new Error('DEPLOY_TAG not set');

  const manifest = loadManifest();
  const record = manifest.find(m => m.tag === tag);
  if (!record) throw new Error(`No manifest record for tag=${tag}`);

  console.log(`Verifying contracts for tag=${tag}`);

  // SentinelCore
  await run('verify:verify', {
    address: record.contracts.SentinelCore,
    constructorArguments: [process.env.OWNER_ADDRESS || ''],
  });

  // SentinelToken
  await run('verify:verify', {
    address: record.contracts.SentinelToken,
    constructorArguments: [process.env.OWNER_ADDRESS || ''],
  });

  // SentinelStaking
  await run('verify:verify', {
    address: record.contracts.SentinelStaking,
    constructorArguments: [
      record.contracts.SentinelToken,
      record.contracts.SentinelToken,
      process.env.OWNER_ADDRESS || '',
    ],
  });

  // SentinelRewardAggregator
  await run('verify:verify', {
    address: record.contracts.SentinelRewardAggregator,
    constructorArguments: [
      record.contracts.SentinelStaking,
      '0x0000000000000000000000000000000000000000',
      record.contracts.SentinelToken,
      '0x0000000000000000000000000000000000000000',
    ],
  });

  // SentinelInsuranceProtocol
  await run('verify:verify', {
    address: record.contracts.SentinelInsuranceProtocol,
    constructorArguments: [
      record.contracts.SentinelCore,
      '0x0000000000000000000000000000000000000000',
      process.env.OWNER_ADDRESS || '',
    ],
  });

  // SentinelAMM
  await run('verify:verify', {
    address: record.contracts.SentinelAMM,
    constructorArguments: [process.env.OWNER_ADDRESS || ''],
  });

  // AetheronBridge
  await run('verify:verify', {
    address: record.contracts.AetheronBridge,
    constructorArguments: [process.env.OWNER_ADDRESS || ''],
  });

  console.log('Verification complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
