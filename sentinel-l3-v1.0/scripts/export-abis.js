import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');
const abisDir = path.join(__dirname, '..', 'abis');

// Ensure abis directory exists
if (!fs.existsSync(abisDir)) {
  fs.mkdirSync(abisDir, { recursive: true });
}

// Find all contract artifacts
function findContractArtifacts(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Look for .sol directories
      if (item.endsWith('.sol')) {
        const contractFiles = fs.readdirSync(fullPath);
        for (const file of contractFiles) {
          if (file.endsWith('.json') && !file.endsWith('.dbg.json')) {
            files.push(path.join(fullPath, file));
          }
        }
      } else {
        // Recurse into subdirectories
        files.push(...findContractArtifacts(fullPath));
      }
    }
  }

  return files;
}

const artifacts = findContractArtifacts(artifactsDir);

console.log(`Found ${artifacts.length} contract artifacts`);

for (const artifactPath of artifacts) {
  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const contractName = path.basename(artifactPath, '.json');
    const abiPath = path.join(abisDir, `${contractName}.json`);

    // Write ABI to abis directory
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`Exported ABI for ${contractName}`);
  } catch (error) {
    console.error(`Error processing ${artifactPath}:`, error.message);
  }
}

console.log('ABI export completed');
