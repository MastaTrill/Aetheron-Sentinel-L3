// hre is injected by hardhat run
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_DATA_PATH = path.join(__dirname, '..', 'mainnet-deployment-data.json');

// Chainlink Automation Config (Sepolia example - update for Mainnet)
const LINK_TOKEN = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const REGISTRAR = "0xb0E49d57C7690477839650A7fBC669777caE0331";
const UPKEEP_GAS_LIMIT = 2000000;

async function main() {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();

    console.log(`\n🚀 Starting Mainnet Deployment Orchestration with deployer: ${deployer.address}`);
    console.log(`Network: ${hre.network.name} (Chain ID: ${hre.network.config.chainId})`);

    const deploymentData = {
        contracts: {},
        actions: {},
        timestamp: new Date().toISOString(),
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        deployer: deployer.address
    };

    // --- Simulate Contract Deployments ---
    console.log("\n--- Deploying Core Contracts ---");

    // SentinelCore
    const SentinelCoreFactory = await ethers.getContractFactory("SentinelCore");
    const sentinelCore = await SentinelCoreFactory.deploy(deployer.address);
    await sentinelCore.waitForDeployment();
    const sentinelCoreAddress = await sentinelCore.getAddress();
    const sentinelCoreReceipt = await sentinelCore.deploymentTransaction().wait();
    console.log(`SentinelCore deployed to: ${sentinelCoreAddress} (Tx: ${sentinelCoreReceipt.hash})`);
    deploymentData.contracts.SentinelCore = {
        address: sentinelCoreAddress,
        hash: sentinelCoreReceipt.hash,
        block: sentinelCoreReceipt.blockNumber
    };

    // SentinelCoreLoop (constructor takes single address — initialOwner)
    const SentinelCoreLoopFactory = await ethers.getContractFactory("SentinelCoreLoop");
    const sentinelCoreLoop = await SentinelCoreLoopFactory.deploy(deployer.address);
    await sentinelCoreLoop.waitForDeployment();
    const sentinelCoreLoopAddress = await sentinelCoreLoop.getAddress();
    const sentinelCoreLoopReceipt = await sentinelCoreLoop.deploymentTransaction().wait();
    console.log(`SentinelCoreLoop deployed to: ${sentinelCoreLoopAddress} (Tx: ${sentinelCoreLoopReceipt.hash})`);
    deploymentData.contracts.SentinelCoreLoop = {
        address: sentinelCoreLoopAddress,
        hash: sentinelCoreLoopReceipt.hash,
        block: sentinelCoreLoopReceipt.blockNumber
    };

    // AetheronBridge
    const AetheronBridgeFactory = await ethers.getContractFactory("AetheronBridge");
    const aetheronBridge = await AetheronBridgeFactory.deploy(deployer.address);
    await aetheronBridge.waitForDeployment();
    const aetheronBridgeAddress = await aetheronBridge.getAddress();
    const aetheronBridgeReceipt = await aetheronBridge.deploymentTransaction().wait();
    console.log(`AetheronBridge deployed to: ${aetheronBridgeAddress} (Tx: ${aetheronBridgeReceipt.hash})`);
    deploymentData.contracts.AetheronBridge = {
        address: aetheronBridgeAddress,
        hash: aetheronBridgeReceipt.hash,
        block: aetheronBridgeReceipt.blockNumber
    };

    // --- Deploy and Register SentinelChainlinkKeeper ---
    console.log("\n--- Deploying & Registering SentinelChainlinkKeeper ---");

    const KeeperFactory = await ethers.getContractFactory("SentinelChainlinkKeeper");
    const keeper = await KeeperFactory.deploy(sentinelCoreAddress);
    await keeper.waitForDeployment();
    const keeperAddress = await keeper.getAddress();
    console.log(`Keeper deployed to: ${keeperAddress}`);

    // Approve LINK for registration
    const link = await ethers.getContractAt(["function approve(address, uint256) public returns (bool)"], LINK_TOKEN);
    const registrationAmount = ethers.parseUnits("5", 18);
    console.log("Approving 5 LINK for Automation Registrar...");
    await (await link.approve(REGISTRAR, registrationAmount)).wait();

    // Register Upkeep
    const registrar = await ethers.getContractAt([
        "function registerUpkeep((string name, bytes encryptedEmail, address upkeepContract, uint32 gasLimit, address adminAddress, bytes triggerConfig, bytes offchainConfig, uint96 amount)) external returns (uint256)"
    ], REGISTRAR);

    const registrarInterface = new ethers.Interface([
        "event UpkeepRegistered(uint256 indexed id, uint32 remainingGold, address forwarder)"
    ]);

    console.log("Registering Upkeep with Chainlink...");
    const registerTx = await registrar.registerUpkeep({
        name: "Aetheron-Sentinel-L3-Orchestrated",
        encryptedEmail: "0x",
        upkeepContract: keeperAddress,
        gasLimit: UPKEEP_GAS_LIMIT,
        adminAddress: deployer.address,
        triggerConfig: "0x",
        offchainConfig: "0x",
        amount: registrationAmount
    });
    const registerReceipt = await registerTx.wait();

    // Parse Forwarder Address
    const log = registerReceipt.logs.find(x => x.topics[0] === registrarInterface.getEventTopic("UpkeepRegistered"));
    let forwarderAddress = ethers.ZeroAddress;
    if (log) {
        const parsedLog = registrarInterface.parseLog(log);
        forwarderAddress = parsedLog.args.forwarder;
        console.log(`Detected Forwarder: ${forwarderAddress}`);

        console.log("Setting Forwarder on Keeper...");
        const forwarderTx = await (await keeper.setForwarder(forwarderAddress)).wait();
        deploymentData.actions["setForwarder (Chainlink)"] = forwarderTx.hash;
    }

    deploymentData.contracts.SentinelChainlinkKeeper = {
        address: keeperAddress,
        hash: keeper.deploymentTransaction()?.hash ?? "0x",
        forwarder: forwarderAddress
    };

    // --- Simulate Key Actions (Ownership Handoff, Wiring, etc.) ---
    console.log("\n--- Executing Post-Deployment Actions ---");

    // Transfer ownership of SentinelCore to the owner/multisig
    const multiSigAddress = "0xa4737aa4b1e8a3c8f221be9e55f5bda307ecc1fa";
    const transferOwnershipTx = await sentinelCore.transferOwnership(multiSigAddress);
    const transferOwnershipReceipt = await transferOwnershipTx.wait();
    console.log(`SentinelCore ownership transferred to MultiSig: ${transferOwnershipReceipt.hash}`);
    deploymentData.actions["transferOwnership to MultiSig"] = transferOwnershipReceipt.hash;

    // Simulate initializeCoreComponents on SentinelCoreLoop
    // This would typically involve passing addresses of other deployed components
    const initializeCoreComponentsTx = await sentinelCoreLoop.initializeCoreComponents(
        aetheronBridgeAddress, // Placeholder for quantumGuard
        sentinelCoreAddress // Placeholder for yieldMaximizer
    );
    const initializeCoreComponentsReceipt = await initializeCoreComponentsTx.wait();
    console.log(`SentinelCoreLoop initialized components: ${initializeCoreComponentsReceipt.hash}`);
    deploymentData.actions["initializeCoreComponents"] = initializeCoreComponentsReceipt.hash;

    // --- Save Deployment Data ---
    fs.writeFileSync(DEPLOYMENT_DATA_PATH, JSON.stringify(deploymentData, null, 2));
    console.log(`\n✅ Deployment data saved to ${DEPLOYMENT_DATA_PATH}`);
    console.log("Next: Run 'npm run evidence:automate' to update documentation.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});