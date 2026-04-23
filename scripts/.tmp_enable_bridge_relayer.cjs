/**
 * One-off: Enable bridge relayer for owner EOA
 * Uses owner private key to call AetheronBridge.setRelayer(relayer, true)
 */
const { ethers } = require('ethers');
const fs = require('fs');
const vm = require('vm');

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const RELAYER =
  process.env.RELAYER_ADDRESSES || '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB';

if (!PRIVATE_KEY || PRIVATE_KEY.length < 60) {
  console.error('OWNER_PRIVATE_KEY not set or too short.');
  process.exit(1);
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('site/contracts.js', 'utf8'), ctx);
  const c = ctx.window.SENTINEL_CONTRACTS;

  const bridge = new ethers.Contract(
    c.AetheronBridge.address,
    ['function setRelayer(address relayer, bool authorized) external'],
    signer,
  );

  console.log(`Signer: ${signer.address}`);
  console.log(`Bridge: ${c.AetheronBridge.address}`);
  console.log(`Relayer: ${RELAYER}`);
  console.log('Calling setRelayer(relayer, true)...\n');

  const tx = await bridge.setRelayer(RELAYER, true);
  console.log(`Tx hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Mined in block ${receipt.blockNumber}`);
  console.log(`Status: ${receipt.status === 1 ? '✅ success' : '❌ failed'}`);

  if (receipt.status !== 1) process.exit(1);
})();
