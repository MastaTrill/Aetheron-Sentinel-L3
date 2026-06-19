import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEPLOYED_ADDRESSES_PATH = path.join(__dirname, "DEPLOYED_ADDRESSES.json");

async function main() {
    const { ethers } = hre;

    // Chainlink addresses — network-aware
    const chainId = hre.network.config.chainId;
    const CHAINLINK_ADDRESSES = {
        11155111: { // Sepolia
            LINK_TOKEN: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
            REGISTRAR: "0xb0E49d57C7690477839650A7fBC669777caE0331"
        },
        1: { // Ethereum Mainnet
            LINK_TOKEN: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
            REGISTRAR: "0x6593c7De001fC8542bB1703532EE1E5aA0D458fD"
        },
        8453: { // Base Mainnet
            LINK_TOKEN: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196",
            REGISTRAR: "0x6593c7De001fC8542bB1703532EE1E5aA0D458fD"
        }
    };
    const addrs = CHAINLINK_ADDRESSES[chainId];
    if (!addrs) {
        throw new Error(`Unsupported network chainId: ${chainId}. Add Chainlink addresses for this network.`);
    }
    const { LINK_TOKEN, REGISTRAR } = addrs;

    // Read deployed addresses
    if (!fs.existsSync(DEPLOYED_ADDRESSES_PATH)) {
        throw new Error(`DEPLOYED_ADDRESSES.json not found at ${DEPLOYED_ADDRESSES_PATH}. Run orchestrator first.`);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_PATH, "utf8"));
    const CORE_ADDRESS = deployedAddresses.SentinelCore || deployedAddresses.contracts?.SentinelCore?.address;
    if (!CORE_ADDRESS) {
        throw new Error("SentinelCore address not found in DEPLOYED_ADDRESSES.json");
    }

    const [deployer] = await ethers.getSigners();
    console.log(`Executing deployment with: ${deployer.address}`);
    console.log(`Network: ${hre.network.name} (ChainId: ${chainId})`);
    console.log(`SentinelCore: ${CORE_ADDRESS}`);

    // 1. Deploy Keeper
    // Note: We pass address(0) for the forwarder initially as we'll set it after registration
    const KeeperFactory = await ethers.getContractFactory("SentinelChainlinkKeeper");
    const keeper = await KeeperFactory.deploy(CORE_ADDRESS);
    await keeper.waitForDeployment();
    const keeperAddress = await keeper.getAddress();
    console.log(`Keeper deployed to: ${keeperAddress}`);

    // 2. Approve LINK for Registrar
    const link = await ethers.getContractAt(["function approve(address, uint256) public returns (bool)"], LINK_TOKEN);
    const registrationAmount = ethers.parseUnits("5", 18); // Fund with 5 LINK
    console.log("Approving LINK for Registrar...");
    await (await link.approve(REGISTRAR, registrationAmount)).wait();

    // 3. Register Upkeep
    // Minimal ABI for the Registrar
    const registrar = await ethers.getContractAt([
        "function registerUpkeep((string name, bytes encryptedEmail, address upkeepContract, uint32 gasLimit, address adminAddress, bytes triggerConfig, bytes offchainConfig, uint96 amount)) external returns (uint256)"
    ], REGISTRAR);

    const params = {
        name: "Aetheron-Sentinel-L3-Mainnet",
        encryptedEmail: "0x", // Optional
        upkeepContract: keeperAddress,
        gasLimit: 2000000, // Matching MAX_PERFORM_GAS
        adminAddress: deployer.address,
        triggerConfig: "0x",
        offchainConfig: "0x",
        amount: registrationAmount
    };

    console.log("Registering Upkeep...");
    const tx = await registrar.registerUpkeep(params);
    const receipt = await tx.wait();

    // Define the interface to parse the UpkeepRegistered event
    const registrarInterface = new ethers.Interface([
        "event UpkeepRegistered(uint256 indexed id, uint32 remainingGold, address forwarder)"
    ]);

    // Find and parse the log
    const log = receipt.logs.find(x => x.topics[0] === registrarInterface.getEventTopic("UpkeepRegistered"));
    let forwarderAddress = ethers.ZeroAddress;

    if (log) {
        const parsedLog = registrarInterface.parseLog(log);
        forwarderAddress = parsedLog.args.forwarder;
        console.log(`Detected Forwarder Address: ${forwarderAddress}`);
    } else {
        console.log("Warning: UpkeepRegistered event not found in logs. You may need to fetch the Forwarder manually from the dashboard.");
    }

    console.log("Upkeep registered. Transaction Hash:", receipt.hash);

    // 4. Update local addresses
    const addresses = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_PATH, "utf8"));
    addresses.SentinelChainlinkKeeper = keeperAddress;
    addresses.SentinelForwarder = forwarderAddress;
    fs.writeFileSync(DEPLOYED_ADDRESSES_PATH, JSON.stringify(addresses, null, 2));

    // 5. Automatically call setForwarder on the Keeper
    if (forwarderAddress !== ethers.ZeroAddress) {
        console.log(`\nAutomatically calling setForwarder(${forwarderAddress}) on Keeper (${keeperAddress})...`);
        await (await keeper.setForwarder(forwarderAddress)).wait();
        console.log(`✅ Keeper's authorizedForwarder set to ${forwarderAddress}.`);
    } else {
        console.log("⚠️ Warning: Forwarder address is ZeroAddress. Manual setForwarder call may be required.");
    }

    console.log("\nNext Steps:");
    console.log(`1. Run 'node handover-to-keeper.cjs' to grant keeper permissions (ownership of SentinelCore).`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});