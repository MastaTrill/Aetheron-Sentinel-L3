# SENTINEL 57% beneficiary remediation runbook

**Network:** Base Mainnet (`8453`)  
**Initializer:** `0xD59cE43E53D69F190E15d9822Fb4540dCcc91178`  
**Pool ID:** `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`  
**Current 57% beneficiary:** `0x7e3D11f70084D667295710E6b7FF50C3b0487a45`  
**Intended Aetheron treasury:** `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

## Purpose

Move the existing 57% creator-fee share to the established Aetheron treasury without falsely claiming control, losing the fee cutoff, or allowing repository automation to sign or broadcast a transaction.

This runbook prepares and verifies the remediation. It does not authorize it.

## Verified contract behavior

The verified initializer inherits `FeesManager`, which exposes:

- `collectFees(bytes32 poolId)` — collects current pool fees, increments cumulative accounting, and releases the caller's beneficiary share;
- `updateBeneficiary(bytes32 poolId,address newBeneficiary)` — releases already-accounted fees, initializes the new beneficiary checkpoint when needed, transfers all of `msg.sender`'s shares, zeros the old share, and emits `UpdateBeneficiary`.

`updateBeneficiary` does not call the pool-fee collection routine. To create an unambiguous economic cutoff, the current beneficiary must call `collectFees` before transferring the share.

## Hard prerequisites

All conditions must be satisfied before any signing request is presented:

- [ ] A public cryptographic proof establishes control of `0x7e3D...7a45` by the person or organization authorizing remediation.
- [ ] Control of the intended treasury `0xA473...C1Fa` is independently confirmed.
- [ ] Two independent Base RPC providers agree on the pinned block, current 57% share, target zero share, fee accounting, and both read-only simulations.
- [ ] Exact maximum gas cost and expiry are written into the authorization record.
- [ ] The unsigned transaction `to`, `data`, `value`, chain ID, and execution order are independently reviewed.
- [ ] No private key, mnemonic, wallet export, session key, or authenticated RPC credential appears in GitHub, chat, CI output, or shell history.

## Read-only preflight

Run:

```bash
BASE_RPC_URLS="https://mainnet.base.org,https://base-rpc.publicnode.com" \
  node scripts/prepare-sentinel-beneficiary-remediation.mjs \
  | tee /tmp/sentinel-beneficiary-remediation-preflight.json
```

The script fails closed unless:

1. both RPC providers reproduce the same pinned state;
2. the current address owns exactly `0.57e18` shares;
3. the intended treasury owns zero shares before remediation;
4. `collectFees(poolId)` succeeds under a read-only call from the current beneficiary; and
5. `updateBeneficiary(poolId,treasury)` succeeds under a read-only call from the current beneficiary.

A successful simulation proves only that the contract would accept the stated caller. It does not prove that the operator controls that caller.

## Required transaction order

### Transaction 1 — establish fee cutoff

The current beneficiary calls:

```solidity
collectFees(/* poolId */ 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d)
```

Wait for a confirmed receipt. Verify the `Collect` event and any `Release` event for the current beneficiary before proceeding.

### Transaction 2 — transfer the 57% share

After Transaction 1 confirms, the same current beneficiary calls:

```solidity
updateBeneficiary(
  /* poolId */ 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d,
  0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa
)
```

Wait for a confirmed receipt and verify the `UpdateBeneficiary` event.

Do not batch the calls unless the exact smart-account execution path and atomic failure behavior are independently reviewed.

## Post-transaction verification

Pin the update receipt block and reproduce through two independent RPC providers:

- [ ] old beneficiary shares equal `0`;
- [ ] Aetheron treasury shares equal `570000000000000000`;
- [ ] pool ID and initializer match the canonical deployment;
- [ ] `UpdateBeneficiary` identifies the exact old and new addresses;
- [ ] both transaction receipts succeeded;
- [ ] block hashes and transaction hashes match across providers;
- [ ] no unrelated ownership, liquidity, migration, minting, metadata, or fee-recipient state changed.

Store only public evidence: authorization record, transaction hashes, receipts, block identifiers, event decoding, two-RPC reads, and reviewer sign-off.

## Failure paths

Stop and retain the release block when:

- control of `0x7e3D...7a45` cannot be proven;
- either simulation reverts;
- the target treasury already has an unexpected share;
- RPC providers disagree;
- the fee-collection receipt fails or cannot be decoded;
- transaction parameters differ from the reviewed authorization; or
- an independent reviewer identifies an unresolved material risk.

If control is unavailable, the only acceptable next path is an explicitly approved replacement launch or redeployment with the correct treasury configured from inception. Repository edits cannot repair the deployed state.
