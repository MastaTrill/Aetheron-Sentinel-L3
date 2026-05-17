import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying with account:", deployer.address);

  // 1. Deploy AetherX Token
  const AetherX = await ethers.getContractFactory("AetherX");
  const aetherx = await AetherX.deploy(deployer.address);
  await aetherx.waitForDeployment();
  const aetherxAddress = await aetherx.getAddress();
  console.log("✅ AetherX deployed to:", aetherxAddress);

  // 2. Deploy AetherXSale
  const AetherXSale = await ethers.getContractFactory("AetherXSale");
  const sale = await AetherXSale.deploy(aetherxAddress, deployer.address);
  await sale.waitForDeployment();
  const saleAddress = await sale.getAddress();
  console.log("✅ AetherXSale deployed to:", saleAddress);

  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("AetherX Token :", aetherxAddress);
  console.log("AetherXSale   :", saleAddress);
  console.log("Deployer      :", deployer.address);
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
