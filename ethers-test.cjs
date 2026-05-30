const ethers = require("ethers");
const url = "https://mainnet.infura.io/v3/216dd7b47d9847e5aa0f37e814402d27";
const p = new ethers.JsonRpcProvider(url, 1);
p.getNetwork().then(n => console.log("OK:", n.chainId.toString())).catch(e => console.error("FAIL:", e.message));
