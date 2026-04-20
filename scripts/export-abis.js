/**
 * Export compiled contract ABIs to the top-level abis/ directory.
 *
 * Run after `npx hardhat compile`:
 *   npm run export:abis
 *
 * Reads artifacts from artifacts/contracts/ and writes flattened JSON
 * files to abis/<ContractName>.json for every contract that has an ABI.
 */

const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts', 'contracts');
const OUTPUT_DIR = path.join(__dirname, '..', 'abis');

function walkArtifacts(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkArtifacts(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.json') &&
      !entry.name.endsWith('.dbg.json')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    console.error(
      `Artifacts directory not found: ${ARTIFACTS_DIR}\n` +
        'Run `npx hardhat compile` first.',
    );
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const artifactFiles = walkArtifacts(ARTIFACTS_DIR);
  let exported = 0;
  let skipped = 0;

  for (const filePath of artifactFiles) {
    const artifact = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const { contractName, abi } = artifact;

    if (!contractName || !abi || abi.length === 0) {
      skipped++;
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, `${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));
    console.log(`  Exported ${contractName} → abis/${contractName}.json`);
    exported++;
  }

  console.log(`\nDone. ${exported} ABIs exported, ${skipped} skipped.`);
}

main();
