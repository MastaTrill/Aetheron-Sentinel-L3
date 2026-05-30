const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Well-known storage slot for ERC1967Proxy admin (EIP-1967)
const ERC1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

async function main() {
  const args = process.argv;

  const getFlagValue = flag => {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  };

  const name = getFlagValue('--name');
  const address = getFlagValue('--contract');
  const func = getFlagValue('--function');
  const rawArgs = getFlagValue('--args');
  const maxGasGwei = getFlagValue('--max-gas');

  if (!address || !func || !name) {
    console.error(
      "Usage: npx hardhat run scripts/initialize.js --name <Name> --contract <Addr> --function <Func> --args '<Args>'"
    );
    process.exit(1);
  }

  // Optional Gas Price Check with Retry Mechanism
  if (maxGasGwei) {
    const maxGasWei = hre.ethers.parseUnits(maxGasGwei, 'gwei');
    const maxAttempts = 5;
    const retryDelay = 30000; // 30 seconds
    let ready = false;

    for (let i = 0; i < maxAttempts; i++) {
      const feeData = await hre.ethers.provider.getFeeData();
      const currentGasPrice = feeData.gasPrice || feeData.maxFeePerGas;

      if (currentGasPrice <= maxGasWei) {
        ready = true;
        break;
      }

      console.log(
        `⚠️  Gas too expensive (${hre.ethers.formatUnits(currentGasPrice, 'gwei')} gwei). Threshold: ${maxGasGwei}. Attempt ${i + 1}/${maxAttempts}...`
      );
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!ready) {
      console.error(`❌ Gas remained too high after ${maxAttempts} attempts. Aborting.`);
      process.exit(1);
    }
  }

  // Connect to the contract using the provided name and address
  const contract = await hre.ethers.getContractAt(name, address);

  // Split the args string and handle type conversion (specifically booleans)
  const parsedArgs = rawArgs
    ? rawArgs.split(/\s+/).map(arg => {
        if (arg.toLowerCase() === 'true') return true;
        if (arg.toLowerCase() === 'false') return false;
        // Detect and parse array format: [0x123...,0x456...]
        if (arg.startsWith('[') && arg.endsWith(']')) {
          return arg
            .slice(1, -1)
            .split(',')
            .map(item => item.trim());
        }
        return arg;
      })
    : [];

  // Verify the function exists on the contract interface
  const fragment = contract.interface.getFunction(func);
  if (!fragment) {
    console.error(`❌ Error: Function "${func}" not found on contract "${name}".`);
    process.exit(1);
  }

  // Optional: Verify argument count matches
  if (parsedArgs.length !== fragment.inputs.length) {
    console.error(
      `❌ Error: Argument count mismatch for "${func}". Expected ${fragment.inputs.length}, got ${parsedArgs.length}.`
    );
    process.exit(1);
  }

  // Idempotency check: Skip if value is already correctly set
  try {
    const getterName = func.startsWith('set') ? func.charAt(3).toLowerCase() + func.slice(4) : null;

    // Special handling for AccessControl roles (grantRole/revokeRole)
    if (func === 'grantRole' || func === 'revokeRole') {
      const role = parsedArgs[0];
      const account = parsedArgs[1];
      const hasRole = await contract.hasRole(role, account);

      if (func === 'grantRole' && hasRole) {
        console.log(`⏭️  Skipping: ${account} already has role ${role} on ${name}.`);
        return;
      }
      if (func === 'revokeRole' && !hasRole) {
        console.log(`⏭️  Skipping: ${account} already lacks role ${role} on ${name}.`);
        return;
      }
    }

    // Safety Check: Prevent setting ZeroAddress as a relayer
    if (func === 'setRelayer' && parsedArgs[0] === hre.ethers.ZeroAddress) {
      console.error(`❌ Error: Cannot set ZeroAddress as a relayer on ${name}.`);
      process.exit(1);
    }

    const getter = getterName ? contract.interface.getFunction(getterName) : null;

    // Check if a corresponding view function exists with one less argument (common setter/getter pattern)
    if (getter && getter.inputs.length === fragment.inputs.length - 1) {
      const getterArgs = parsedArgs.slice(0, getter.inputs.length);
      const targetValue = parsedArgs[parsedArgs.length - 1];
      const currentValue = await contract[getterName](...getterArgs);

      const normalize = v => {
        if (Array.isArray(v)) return v.map(normalize).join(',').toLowerCase();
        if (typeof v === 'boolean') return v;
        return typeof v === 'string' && v.startsWith('0x') ? v.toLowerCase() : String(v);
      };

      if (normalize(currentValue) === normalize(targetValue)) {
        console.log(`⏭️  Skipping: ${name}.${func} already set to desired value.`);
        return true;
      }
    }
  } catch (e) {
    // Heuristic failed or getter reverted; proceed with transaction safely
  }

  // Pause check: Verify the contract is not paused before attempting state change
  try {
    const pausedFragment = contract.interface.getFunction('paused');
    if (pausedFragment && pausedFragment.inputs.length === 0) {
      const isPaused = await contract.paused();
      if (isPaused) {
        console.error(
          `❌ Error: Contract "${name}" is paused. Cannot proceed with initialization.`
        );
        process.exit(1);
      }
    }
  } catch (e) {
    // paused() function not supported or call failed; proceed safely
  }

  // Access control check: Verify the signer has permission (heuristic)
  try {
    const [signer] = await hre.ethers.getSigners();

    // --- NEW: Proxy Admin Check ---
    // Attempt to read the ERC1967 proxy admin slot
    const storageValue = await hre.ethers.provider.getStorage(address, ERC1967_ADMIN_SLOT);
    // Extract the address from the bytes32 storage slot (last 20 bytes)
    const proxyAdminAddress = hre.ethers.getAddress(hre.ethers.dataSlice(storageValue, 12));

    if (proxyAdminAddress !== hre.ethers.ZeroAddress) {
      // If a proxy admin is found (i.e., it's likely an ERC1967 proxy)
      if (proxyAdminAddress.toLowerCase() !== signer.address.toLowerCase()) {
        console.warn(
          `⚠️  Warning: Contract "${name}" at ${address} appears to be a proxy. ` +
            `The proxy admin is ${proxyAdminAddress}, but the current signer is ${signer.address}. ` +
            `Ensure the signer has control over the proxy for upgrades and critical administrative actions.`
        );
      } else {
        console.log(`✅ Signer (${signer.address}) is the admin of proxy ${name} at ${address}.`);
      }
    }
    // --- END NEW: Proxy Admin Check ---

    // Check for Ownable pattern
    const ownerFragment = contract.interface.getFunction('owner');
    if (ownerFragment && ownerFragment.inputs.length === 0) {
      const currentOwner = await contract.owner();
      if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.warn(
          `⚠️  Warning: Signer (${signer.address}) is not the owner of ${name} (${currentOwner}).`
        );
      }
    }

    // Check for AccessControl pattern (DEFAULT_ADMIN_ROLE)
    const hasRoleFragment = contract.interface.getFunction('hasRole');
    if (hasRoleFragment && hasRoleFragment.inputs.length === 2) {
      const rolesToCheck = [
        {
          name: 'DEFAULT_ADMIN_ROLE',
          hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
        { name: 'RELAYER_ROLE', hash: hre.ethers.id('RELAYER_ROLE') },
        { name: 'OPERATOR_ROLE', hash: hre.ethers.id('OPERATOR_ROLE') },
        { name: 'MONITOR_ROLE', hash: hre.ethers.id('MONITOR_ROLE') },
      ];

      let hasAnyRole = false;
      for (const role of rolesToCheck) {
        try {
          if (await contract.hasRole(role.hash, signer.address)) {
            console.log(`✅ Signer verified with role: ${role.name}`);
            // Specific feedback for bridge operations
            if (role.name === 'RELAYER_ROLE' && name.toLowerCase().includes('bridge')) {
              console.log(`   (Confirmed relayer permission for bridge operations)`);
            }
            hasAnyRole = true;
            break;
          }
        } catch (e) {
          /* Role might not exist in this contract interface */
        }
      }

      if (!hasAnyRole) {
        console.warn(
          `⚠️  Warning: Signer (${signer.address}) lacks standard administrative or operational roles on ${name}.`
        );
      }
    }
  } catch (e) {
    /* ignore if these functions don't exist */
  }

  console.log(`▶ Initializing ${name} at ${address}...`);
  console.log(`  Function: ${func}`);
  console.log(`  Arguments: [${parsedArgs.join(', ')}]`);

  // Pre-flight balance check: Verify enough ETH for gas
  const [signer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(signer.address);
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;

  // Estimate gas for cost calculation (with a safe fallback if estimation fails)
  const estimatedGas = await contract[func].estimateGas(...parsedArgs).catch(() => 1000000n);
  const totalCost = estimatedGas * gasPrice;

  if (balance < totalCost) {
    console.error(
      `❌ Error: Insufficient ETH. Estimated cost: ~${hre.ethers.formatEther(totalCost)} ETH. Available balance: ${hre.ethers.formatEther(balance)} ETH.`
    );
    process.exit(1);
  }

  const tx = await contract[func](...parsedArgs);
  console.log(`  Transaction Hash: ${tx.hash}`);
  const receipt = await tx.wait(1); // Wait for 1 confirmation

  if (!receipt || receipt.status === 0) {
    console.error(`❌ Error: Transaction failed (reverted) on-chain. Hash: ${tx.hash}`);
    process.exit(1);
  }

  console.log(
    `✅ Success! Transaction confirmed in block ${receipt.blockNumber} (Gas Used: ${receipt.gasUsed.toString()}). Hash: ${tx.hash}\n`
  );

  // Logging system: save initialization transaction hashes
  const logPath = path.join(__dirname, '../deployment-log.json');
  const logEntry = {
    network: hre.network.name,
    contract: name,
    address: address,
    function: func,
    args: parsedArgs,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date().toISOString(),
  };

  let logs = [];
  if (fs.existsSync(logPath)) {
    try {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    } catch (e) {
      // If file exists but is invalid JSON, start fresh
    }
  }
  logs.push(logEntry);
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  console.log(`📝 Transaction hash saved to deployment-log.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
