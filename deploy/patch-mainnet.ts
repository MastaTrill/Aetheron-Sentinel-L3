import { loadManifest } from './manifest';
import { execSync } from 'child_process';

async function main() {
  const tag = process.env.DEPLOY_TAG;
  if (!tag) throw new Error('DEPLOY_TAG not set');

  const manifest = loadManifest();
  const record = manifest.find(m => m.tag === tag);
  if (!record) throw new Error(`No manifest record for tag=${tag}`);

  const sentinelCoreAddress = record.contracts.SentinelCore;
  if (!sentinelCoreAddress) throw new Error('SentinelCore missing in manifest');

  console.log(`Running patches for tag=${tag}, SentinelCore=${sentinelCoreAddress}`);

  const cmd = [
    'forge script script/patch/101_Permissions.s.sol:PermissionsPatch',
    `--rpc-url ${process.env.BASE_MAINNET_RPC_URL}`,
    '--chain-id 8453',
    '--broadcast',
    '--slow',
    '--verify',
  ].join(' ');

  console.log('Executing:', cmd);
  execSync(cmd, {
    stdio: 'inherit',
    env: {
      ...process.env,
      SENTINEL_CORE: sentinelCoreAddress,
    },
  });

  console.log('Patch sequence complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
