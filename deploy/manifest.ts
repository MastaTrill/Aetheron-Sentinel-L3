import fs from 'fs';

export type DeploymentRecord = {
  tag: string;
  network: string;
  chainId: number;
  timestamp: number;
  contracts: Record<string, string>;
};

const MANIFEST_PATH = 'deployments/base-mainnet.json';

export function loadManifest(): DeploymentRecord[] {
  if (!fs.existsSync(MANIFEST_PATH)) return [];
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

export function saveManifest(records: DeploymentRecord[]) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(records, null, 2));
}
