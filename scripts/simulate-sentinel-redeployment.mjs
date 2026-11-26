#!/usr/bin/env node
// Strictly unsigned, offline preparation. No RPC, signer, wallet, or broadcast.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AbiCoder, Interface, getAddress, keccak256, toUtf8Bytes } from 'ethers';
const path='release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json';
const bytes=await readFile(path);
const m=JSON.parse(bytes.toString('utf8'));
const sha256=createHash('sha256').update(bytes).digest('hex');
const fail=(reason)=>{throw new Error('Unsigned simulation preflight failed: '+reason)};
if(m.safety?.signingEnabled!==false||m.safety?.broadcastEnabled!==false||m.safety?.baseMainnetAuthorized!==false)fail('unsafe manifest switches');
if(m.rehearsal?.mode!=='simulation-only'||m.rehearsal?.protectedBroadcastAuthorized!==false)fail('testnet broadcast must remain disabled');
if(m.networks?.baseSepolia?.chainId!==84532)fail('incorrect testnet chain');
const b=m.rehearsal.beneficiaries;
if(!Array.isArray(b)||b.length!==4||b.reduce((a,x)=>a+BigInt(x.shares),0n)!==1000000000000000000n)fail('beneficiary shares invalid');
if(!b.some(x=>x.role==='aetheron-treasury'&&getAddress(x.beneficiary)===getAddress('0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa')&&x.shares==='570000000000000000'))fail('57% treasury allocation missing');
const abi=AbiCoder.defaultAbiCoder();
const n=m.networks.baseSepolia;
const tokenFactoryData=abi.encode(m.abi.tokenFactoryDataTypes,[m.token.name,m.token.symbol,BigInt(m.token.yearlyMintRate),BigInt(m.token.vestingDuration),m.token.vestingRecipients,m.token.vestingAmounts,m.token.tokenURI]);
const poolData=abi.encode([m.abi.poolInitializerDataType],[{startFee:m.pool.startFee,fee:m.pool.fee,durationSeconds:m.pool.durationSeconds,tickSpacing:m.pool.tickSpacing,curves:m.pool.curves,beneficiaries:b.map(x=>({beneficiary:x.beneficiary,shares:x.shares})),startingTime:m.pool.startingTime}]);
const signature=m.abi.airlockCreateSignature;
const iface=new Interface(['function '+signature]);
const args={initialSupply:m.token.initialSupply,numTokensToSell:m.token.numTokensToSell,numeraire:n.weth,tokenFactory:n.tokenFactory,tokenFactoryData,governanceFactory:n.governanceFactory,governanceFactoryData:m.execution.governanceFactoryData,poolInitializer:n.poolInitializer,poolInitializerData:poolData,liquidityMigrator:n.liquidityMigrator,liquidityMigratorData:m.execution.liquidityMigratorData,integrator:m.execution.integrator,salt:m.execution.salt};
const calldata=iface.encodeFunctionData('create',[args]);
const out={schemaVersion:1,status:'unsigned-preparation-only',network:'baseSepolia',chainId:84532,manifestSha256:sha256,airlock:n.airlock,calldata,calldataKeccak256:keccak256(calldata),beneficiaries:b,predictedAddresses:null,gasEstimate:null,unverified:['contract-address-prediction','rpc-gas-estimate','simulation-call-success','actual-wallet-governance-control'],notice:'Offline ABI encoding only. No eth_call or estimateGas was performed; never present null predictions as certified.'};
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/sentinel-base-sepolia-unsigned-preparation.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({status:out.status,manifestSha256:sha256,calldataKeccak256:out.calldataKeccak256,predictedAddresses:out.predictedAddresses,gasEstimate:out.gasEstimate}));
