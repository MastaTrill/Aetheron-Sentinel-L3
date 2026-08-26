import fs from 'node:fs';
import hre from 'hardhat';
import { verifyContract } from '@nomicfoundation/hardhat-verify/verify';

type ContractRecord = {
  address: string;
  constructorArguments: unknown[];
};

type ReleaseManifest = {
  releaseProfile: string;
  status: string;
  contracts: Record<string, ContractRecord>;
};

const EXPECTED_PROFILE = 'sentinel-guardrails-v1';
const EXPECTED_CONTRACTS = ['SentinelInterceptor', 'CircuitBreaker', 'RateLimiter'];

async function main() {
  const manifestPath =
    process.env.DEPLOYMENT_MANIFEST_PATH || 'deployments/base-sentinel-guardrails-v1.json';
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ReleaseManifest;
  if (manifest.releaseProfile !== EXPECTED_PROFILE) {
    throw new Error(`Unexpected release profile: ${manifest.releaseProfile}`);
  }
  if (manifest.status !== 'verified-paused') {
    throw new Error(
      `On-chain state must be verified before source verification: ${manifest.status}`
    );
  }

  const names = Object.keys(manifest.contracts).sort();
  if (JSON.stringify(names) !== JSON.stringify([...EXPECTED_CONTRACTS].sort())) {
    throw new Error(`Unexpected contract scope: ${names.join(', ')}`);
  }

  for (const name of EXPECTED_CONTRACTS) {
    const record = manifest.contracts[name];
    console.log(`Verifying ${name} at ${record.address}`);
    try {
      await verifyContract(
        {
          address: record.address,
          constructorArgs: record.constructorArguments,
          contract: `contracts/${name}.sol:${name}`,
          provider: 'etherscan',
        },
        hre
      );
    } catch (verifyError: any) {
      console.warn(
        `[WARN] Explorer verification for ${name} at ${record.address} did not complete: ${verifyError?.message || verifyError}`
      );
    }
  }

  console.log('Explorer source verification complete.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
