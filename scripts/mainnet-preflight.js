import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();
dotenv.config({ path: '.env.mainnet', override: true });
const shellOwnerKey = process.env.OWNER_PRIVATE_KEY;
if (shellOwnerKey !== undefined) process.env.OWNER_PRIVATE_KEY = shellOwnerKey;
else delete process.env.OWNER_PRIVATE_KEY;

function parseAddressList(value) {
  return (value || '').split(',').map(s => s.trim()).filter(Boolean);
}
function parseUint(v, fb) { return (v === undefined || v === null || v === '') ? fb