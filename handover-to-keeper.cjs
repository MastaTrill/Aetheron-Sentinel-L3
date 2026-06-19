const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, "DEPLOYED_ADDRESSES.json"), "utf8"));
    const coreAddress = addresses.SentinelCore;
    const keeperAddress = addresses.SentinelChainlinkKeeper;
    const forwarderAddress = addresses.SentinelForwarder; // New: Read forwarder address

    if (!coreAddress || !keeperAddress || !forwarderAddress || forwarderAddress === hre.ethers.ZeroAddress) {
        throw new Error("Missing or invalid addresses in DEPLOYED_ADDRESSES.json. Ensure SentinelCore, SentinelChainlinkKeeper, and a valid SentinelForwarder are present.");
    }

    console.log(`\n🚀 Initiating setup for Keeper and ownership handoff: SentinelCore -> SentinelChainlinkKeeper`);

    const [deployer] = await hre.ethers.getSigners();
    const SentinelCore = await hre.ethers.getContractAt("SentinelCore", coreAddress);
    const SentinelChainlinkKeeper = await hre.ethers.getContractAt("SentinelChainlinkKeeper", keeperAddress); // New: Get Keeper instance

    // Pre-check: Verify deployer is the current owner of SentinelChainlinkKeeper
    const currentKeeperOwner = await SentinelChainlinkKeeper.owner();
    if (currentKeeperOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(`❌ Error: Deployer (${deployer.address}) is not the owner of SentinelChainlinkKeeper (${keeperAddress}). Current owner: ${currentKeeperOwner}. Aborting setForwarder call.`);
    }
    console.log(`✅ Deployer (${deployer.address}) confirmed as owner of SentinelChainlinkKeeper.`);

    // 1. Set the Chainlink Forwarder on the Keeper contract
    console.log(`Setting Chainlink Forwarder (${forwarderAddress}) on SentinelChainlinkKeeper (${keeperAddress})...`);
    const setForwarderTx = await SentinelChainlinkKeeper.setForwarder(forwarderAddress);
    await setForwarderTx.wait();
    console.log(`✅ Chainlink Forwarder set. Tx: ${setForwarderTx.hash}`);

    // 2. Transfer ownership of SentinelCore to the Keeper
    console.log(`Transferring ownership of SentinelCore (${coreAddress}) to SentinelChainlinkKeeper (${keeperAddress})...`);
    const transferOwnershipTx = await SentinelCore.transferOwnership(keeperAddress);
    await transferOwnershipTx.wait();
    console.log(`✅ Ownership successfully transferred to Keeper. Tx: ${transferOwnershipTx.hash}`);

    console.log(`\nNote: Future administrative changes for SentinelCore must now go through the SentinelChainlinkKeeper.`);
    console.log(`Note: The SentinelChainlinkKeeper is currently owned by the deployer. Consider transferring its ownership to the SentinelMultiSigVault.`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});