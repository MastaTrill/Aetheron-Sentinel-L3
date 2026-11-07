import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, keccak256 } from 'ethers';
import { verifyIndependentQuote } from '../scripts/lib/independent-quote-verifier.mjs';
const types = { PretradeQuote: [
  { name: 'poolId', type: 'bytes32' }, { name: 'token', type: 'address' },
  { name: 'route', type: 'address' }, { name: 'wallet', type: 'address' },
  { name: 'calldataHash', type: 'bytes32' }, { name: 'direction', type: 'string' },
  { name: 'expectedOutputWei', type: 'uint256' }, { name: 'quotedAt', type: 'uint256' },
  { name: 'expiresAt', type: 'uint256' },
] };
const domain = { name: 'SentinelIndependentQuote', version: '1', chainId: 8453 };
const signer = Wallet.createRandom();
const other = Wallet.createRandom();
const authorization = { poolId: '0x' + '12'.repeat(32), token: signer.address, approvedRoute: other.address, testWallet: signer.address };
const transaction = { calldataHash: keccak256('0x1234') };
const direction = 'buy-sentinel-with-weth';
const value = { poolId: authorization.poolId, token: authorization.token, route: authorization.approvedRoute, wallet: authorization.testWallet, calldataHash: transaction.calldataHash, direction, expectedOutputWei: '100', quotedAt: 100, expiresAt: 200 };
const check = (quote, opts = {}) => verifyIndependentQuote({ quote, trustedSigner: signer.address, authorization, transaction, blockTimestamp: 150, direction, actualOutputWei: '99', ...opts });
test('valid independent signed pretrade quote', async () => {
  const signature = await signer.signTypedData(domain, types, value);
  assert.equal(check({value,signature}).verified,true);
});
test('reject missing trusted signer', () => assert.throws(() => check(null, {trustedSigner:''}), /signer/));
test('reject unsigned quote', () => assert.throws(() => check({value}), /Signed/));
test('reject signer substitution', async () => {
  const signature = await other.signTypedData(domain, types, value);
  assert.throws(() => check({value,signature}), /not independently trusted/);
});
test('reject changed transaction calldata', async () => {
  const signature = await signer.signTypedData(domain, types, value);
  assert.throws(() => check({value,signature},{transaction:{calldataHash:keccak256('0xabcd')}}), /does not match/);
});
test('reject expired quote', async () => {
  const signature = await signer.signTypedData(domain, types, value);
  assert.throws(() => check({value,signature},{blockTimestamp:201}), /stale/);
});
test('reject quote timestamp after execution', async () => {
  const signature = await signer.signTypedData(domain, types, value);
  assert.throws(() => check({value,signature},{blockTimestamp:100}), /pretrade/);
});
