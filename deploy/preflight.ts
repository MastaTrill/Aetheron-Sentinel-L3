import 'dotenv/config';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function main() {
  requireEnv('BASE_MAINNET_RPC_URL');
  requireEnv('OWNER_PRIVATE_KEY');
  requireEnv('BASESCAN_API_KEY');
  requireEnv('DEPLOY_TAG');

  console.log('Preflight OK');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
