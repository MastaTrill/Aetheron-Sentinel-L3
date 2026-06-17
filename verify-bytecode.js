import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const { ethers } = hre;
    const DEPLOYED_ADDRESSES_PATH = path.join(__dirname, "..", "DEPLOYED_ADDRESSES.json");

    let coreAddress;
    if (fs.existsSync(DEPLOYED_ADDRESSES_PATH)) {
        const addresses = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_PATH, "utf8"));
        coreAddress = addresses.SentinelCore;
    } else {
        // Fallback to known rehearsal address if JSON is missing
        coreAddress = "0x5C85D36529D1217189faf9E48C956d51e5de6211";
    }

    console.log(`Checking bytecode for SentinelCore at: ${coreAddress} on network: ${hre.network.name}`);

    const onChainBytecode = await ethers.provider.getCode(coreAddress);
    if (onChainBytecode === "0x") {
        console.error("❌ Error: No bytecode found at this address. Check your RPC/Network.");
        return;
    }

    const artifact = await hre.artifacts.readArtifact("SentinelCore");
    const localBytecode = artifact.deployedBytecode;

    if (onChainBytecode === localBytecode) {
        console.log("✅ SUCCESS: Local bytecode matches the on-chain contract exactly!");
    } else {
        console.log("⚠️ WARNING: Bytecode mismatch detected.");
        console.log("This is common if the contract uses immutable variables (which are baked into the bytecode at deploy time) or if the compiler versions differ slightly.");
        console.log(`Local Length: ${localBytecode.length} | On-Chain Length: ${onChainBytecode.length}`);
    }
}

main().catch(console.error);