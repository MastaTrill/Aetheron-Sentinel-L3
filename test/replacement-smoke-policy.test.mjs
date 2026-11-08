import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReplacementBounds, validateReplacementIdentity, validateCanonicalPoolKey, classifyReplacementSwap, BASE_WETH, LEGACY_POOL_ID, LEGACY_TOKEN} from '../scripts/lib/replacement-smoke-policy.mjs';
import { AbiCoder, keccak256 } from 'ethers';
const token='0x1111111111111111111111111111111111111111';
const pool='0x'+'22'.repeat(32);
const auth={status:'authorized',chainId:8453,token,poolId:pool,approvedRoute:'route-1',maxSlippageBps:'100',maxWethPrincipalWei:'1000',buyAmountWethWei:'1000',sellAmountSentinelWei:'1000',maxTotalGasCostWei:'100'};
const quote=(actual)=>({verified:true,route:'route-1',token,poolId:pool,expectedOutputWei:'1000',actualOutputWei:String(actual)});
const observed={token,poolId:pool,buyWethWei:'900',sellSentinelWei:'900',totalGasCostWei:'99',quotes:{buy:quote(995),sell:quote(995)}};
test('accepts complete bounded replacement evidence',()=>assert.equal(validateReplacementBounds(auth,observed),true));
test('rejects legacy token',()=>assert.throws(()=>validateReplacementIdentity({token:LEGACY_TOKEN,poolId:pool,expectedToken:LEGACY_TOKEN,expectedPoolId:pool}),/Legacy/));
test('rejects legacy pool',()=>assert.throws(()=>validateReplacementIdentity({token,poolId:LEGACY_POOL_ID,expectedToken:token,expectedPoolId:LEGACY_POOL_ID}),/Legacy/));
test('rejects missing replacement IDs',()=>assert.throws(()=>validateReplacementIdentity({token:'',poolId:pool,expectedToken:token,expectedPoolId:pool}),/malformed/));
test('rejects excess principal',()=>assert.throws(()=>validateReplacementBounds(auth,{...observed,buyWethWei:'1001'}),/principal/));
test('rejects excess gas',()=>assert.throws(()=>validateReplacementBounds(auth,{...observed,totalGasCostWei:'101'}),/Gas/));
test('rejects excessive buy slippage',()=>assert.throws(()=>validateReplacementBounds(auth,{...observed,quotes:{...observed.quotes,buy:quote(980)}}),/slippage/));
test('rejects missing trusted quote',()=>assert.throws(()=>validateReplacementBounds(auth,{...observed,quotes:{buy:quote(995)}}),/quote/));
test('rejects unapproved status',()=>assert.throws(()=>validateReplacementBounds({...auth,status:'draft'},observed),/authorization/));

const hooks='0x0000000000000000000000000000000000000000';
const poolKey=(address)=>({
  currency0: address.toLowerCase() < BASE_WETH.toLowerCase() ? address : BASE_WETH,
  currency1: address.toLowerCase() < BASE_WETH.toLowerCase() ? BASE_WETH : address,
  fee:3000, tickSpacing:60, hooks
});
const poolIdFor=(key)=>keccak256(AbiCoder.defaultAbiCoder().encode(
  ['address','address','uint24','int24','address'],
  [key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks]
));
test('canonical PoolKey hash validates both WETH currency orientations',()=>{
  const low=poolKey(token), highToken='0x7777777777777777777777777777777777777777', high=poolKey(highToken);
  assert.equal(validateCanonicalPoolKey({poolKey:low,token,poolId:poolIdFor(low)}),false);
  assert.equal(validateCanonicalPoolKey({poolKey:high,token:highToken,poolId:poolIdFor(high)}),true);
});
test('PoolKey evidence fails closed on missing or mismatched data',()=>{
  const key=poolKey(token), poolId=poolIdFor(key);
  assert.throws(()=>validateCanonicalPoolKey({poolKey:null,token,poolId}),/required/);
  assert.throws(()=>validateCanonicalPoolKey({poolKey:{...key,fee:500},token,poolId}),/hash/);
  assert.throws(()=>validateCanonicalPoolKey({poolKey:{...key,currency0:key.currency1,currency1:key.currency0},token,poolId}),/sorted/);
  assert.throws(()=>validateCanonicalPoolKey({poolKey:{...key,currency0:'0x3333333333333333333333333333333333333333'},token,poolId}),/PoolKey/);
});
test('swap directions and amounts support either canonical pool ordering',()=>{
  assert.deepEqual(classifyReplacementSwap(10n,-15n,true),{direction:'buy-sentinel-with-weth',weth:10n,sentinel:-15n});
  assert.deepEqual(classifyReplacementSwap(-15n,10n,true),{direction:'sell-sentinel-for-weth',weth:-15n,sentinel:10n});
  assert.deepEqual(classifyReplacementSwap(-15n,10n,false),{direction:'buy-sentinel-with-weth',weth:10n,sentinel:-15n});
  assert.deepEqual(classifyReplacementSwap(10n,-15n,false),{direction:'sell-sentinel-for-weth',weth:-15n,sentinel:10n});
});
