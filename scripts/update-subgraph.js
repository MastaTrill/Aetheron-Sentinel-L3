/**
 * Patch subgraph.yaml with real deployed addresses and startBlock.
 *
 * Usage after a testnet/mainnet deploy:
 *   DEPLOYED_ADDRESSES='{"SentinelInterceptor":"0x...","AetheronBridge":"0x...","RateLimiter":"0x...","CircuitBreaker":"0x..."}' \
 *   START_BLOCK=12345678 \
 *   node scripts/update-subgraph.js
 *
 * Reads DEPLOYED_ADDRESSES as the JSON map printed by deploy.js.
 * START_BLOCK should be the block number of the earliest deployed contract.
 * Writes the result back to subgraph.yaml in place.
 */

const fs = require('fs');
const path = require('path');

const SUBGRAPH_PATH = path.join(__dirname, '..', 'subgraph.yaml');

function main() {
  const rawAddresses = process.env.DEPLOYED_ADDRESSES;
  if (!rawAddresses) {
    console.error(
      'Error: DEPLOYED_ADDRESSES env var is required.\n' +
        'Set it to the JSON output printed by deploy.js.\n' +
        'Example:\n' +
        '  DEPLOYED_ADDRESSES=\'{"SentinelInterceptor":"0x...", ...}\' node scripts/update-subgraph.js',
    );
    process.exit(1);
  }

  const addresses = JSON.parse(rawAddresses);
  const startBlock = parseInt(process.env.START_BLOCK || '0', 10);

  const contractToDataSource = {
    SentinelInterceptor: 'SentinelInterceptor',
    AetheronBridge: 'AetheronBridge',
    RateLimiter: 'RateLimiter',
    CircuitBreaker: 'CircuitBreaker',
  };

  let yaml = fs.readFileSync(SUBGRAPH_PATH, 'utf8');
  let patchCount = 0;

  for (const [contractName, dataSourceName] of Object.entries(
    contractToDataSource,
  )) {
    const address = addresses[contractName];
    if (!address) {
      console.warn(
        `  ⚠️  No address for ${contractName} in DEPLOYED_ADDRESSES — skipping`,
      );
      continue;
    }

    // Replace address lines for this data source block.
    // Strategy: locate the data source by name, then replace the next address line.
    const dataSourceRegex = new RegExp(
      `(name:\\s*${dataSourceName}[\\s\\S]*?address:\\s*")[^"]*("\\s*#[^\\n]*)`,
    );
    const updated = yaml.replace(dataSourceRegex, (match, pre, post) => {
      return `${pre}${address}${post.replace(
        /#[^\n]*/,
        `# updated by update-subgraph.js`,
      )}`;
    });

    if (updated === yaml) {
      console.warn(
        `  ⚠️  Could not find address placeholder for ${dataSourceName}`,
      );
    } else {
      yaml = updated;
      patchCount++;
      console.log(`  ✅ ${contractName}: ${address}`);
    }
  }

  // Patch all startBlock occurrences
  yaml = yaml.replace(/startBlock:\s*\d+/g, `startBlock: ${startBlock}`);
  console.log(`  ✅ startBlock: ${startBlock}`);

  fs.writeFileSync(SUBGRAPH_PATH, yaml, 'utf8');
  console.log(
    `\nPatched ${patchCount} data source addresses in subgraph.yaml.`,
  );
}

main();
