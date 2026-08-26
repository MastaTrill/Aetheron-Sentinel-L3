# SENTINEL beneficiary mismatch remediation — 2026-07-29

## Established Aetheron treasury

The Aetheron Platform repository identifies the cross-project treasury wallet as:

`0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

This wallet is documented as the Aetheron Platform treasury and is also used in Sentinel deployment records as the dedicated bridge relayer.

## Current Base SENTINEL configuration

The deployed SENTINEL Uniswap V4 initializer reports the 57% creator-fee beneficiary as:

`0x7e3D11f70084D667295710E6b7FF50C3b0487a45`

No repository evidence establishes that William McCoy, MastaTrill, or the Aetheron treasury controls that address.

## Required release posture

1. Do not identify `0x7e3D...7a45` as William McCoy or the Aetheron treasury without a valid signature from that address.
2. Do not sign or accept the creator beneficiary attestation while control is unverified.
3. Treat the intended Aetheron recipient as `0xA473...C1Fa` for future deployments and remediation planning.
4. Block final release approval until the current beneficiary either:
   - proves control and executes the supported `updateBeneficiary` path to `0xA473...C1Fa` after settling accrued fees; or
   - the pool is replaced through an approved migration/redeployment process.
5. Preserve the observed on-chain address in evidence records; documentation must not pretend that repository edits changed the deployed contract.

## Safety

No transaction, signature, wallet session, private key, mnemonic, beneficiary update, fee settlement, migration, or redeployment is authorized by this document.
