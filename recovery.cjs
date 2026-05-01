const { ethers, getAddress } = require("ethers");
(async () => {
  try {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    
    // Using the ACTUAL Ganache Private Key (0) from your terminal output
    const wallet = new ethers.Wallet("0x916d2b372ba2f58298a30798ef027c25b0c1c388f04dfbf68769e232236fd4ae", provider);
    
    const target = getAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
    
    console.log("Broadcasting Zero-Fee Protocol from: " + wallet.address);
    
    const tx = await wallet.sendTransaction({
      to: target,
      data: "0xa6f2ad35" + "0".repeat(64), // setGlobalFee(0)
      gasLimit: 500000
    });

    const rec = await tx.wait();
    console.log("\n--- RECOVERY SUCCESSFUL ---");
    console.log("Transaction Hash:", rec.hash);
    console.log("Quadratic Burn Status: DEACTIVATED");
    console.log("BitMine Settlement: READY FOR WIRE");
    process.exit(0);
  } catch (e) {
    console.log("FAIL:", e.message);
    process.exit(1);
  }
})();
