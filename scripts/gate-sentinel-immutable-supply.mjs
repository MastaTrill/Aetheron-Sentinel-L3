#!/usr/bin/env node
// Read-only fail-closed release gate. No network access, signing or transactions.
import { readFileSync } from 'node:fs';
const m=JSON.parse(readFileSync('release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json','utf8'));
const factory=m.networks?.baseMainnet?.tokenFactory?.toLowerCase();
const mutableFactory='0xf0b5141dd9096254b2ca624dff26024f46087229';
const reasons=[];
if(factory===mutableFactory)reasons.push('TokenFactory80 creates DERC2080 with owner-controlled updateMintRate() and mintInflation().');
if(m.token?.yearlyMintRate==='0' && factory===mutableFactory)reasons.push('Zero initial yearlyMintRate is not immutable fixed supply.');
if(m.safety?.baseMainnetAuthorized!==false || m.safety?.broadcastEnabled!==false || m.safety?.signingEnabled!==false)reasons.push('Mainnet safety guardrails changed.');
if(reasons.length){console.error('BLOCKED: SENTINEL fixed-supply release gate');for(const reason of reasons)console.error('- '+reason);process.exitCode=1;}else{console.error('UNVERIFIED: factory change alone does not establish fixed supply; require independent audit evidence.');process.exitCode=1;}
