# Sentinel L3 Release Execution

**Canonical token:** `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`  
**Network:** Base Mainnet (`8453`)  
**Release state:** BLOCKED until every required gate below is evidenced.

## Release boundary

No document, frontend, announcement, liquidity action, or partner integration may describe SENTINEL as fully launched until all required gates are complete.

## Gate 1 — Live-state verification

- [ ] Run `scripts/verify-canonical-token.sh` against an independent Base RPC.
- [ ] Record token name, symbol, decimals, total supply, owner/admin, proxy status, implementation address, and privileged roles.
- [ ] Save RPC block number and UTC timestamp.
- [ ] Compare results against `deployments/base-mainnet.json`.
- [ ] Fail the release if any value differs.

## Gate 2 — Privilege inventory

Document every address capable of:

- minting or changing supply;
- pausing, blacklisting, restricting, taxing, or redirecting transfers;
- upgrading an implementation;
- changing liquidity or treasury configuration;
- assigning roles or transferring ownership.

For every privilege, record the holder, method selector, intended final controller, and removal or transfer transaction.

## Gate 3 — Governance hardening

- [ ] Confirm the destination multisig or timelock address on Base Mainnet.
- [ ] Verify signer membership and threshold out of band.
- [ ] Generate the unsigned ownership/role-transfer transaction.
- [ ] Independently decode calldata before signing.
- [ ] Execute from the current authorized wallet.
- [ ] Verify the receipt and final on-chain owner/roles.
- [ ] Record transaction hash, block number, calldata, sender, destination, and post-state.

> Repository automation may prepare and validate the transaction, but a repository workflow must never possess the production private key.

## Gate 4 — Security evidence

- [ ] Foundry build succeeds with locked compiler settings.
- [ ] Unit, fuzz, invariant, and integration tests succeed.
- [ ] Secret scan succeeds.
- [ ] Static analysis findings are triaged.
- [ ] Independent review is complete or all unaudited risks are explicitly disclosed.
- [ ] Emergency pause and recovery procedures are rehearsed without production keys in CI.

## Gate 5 — Launch evidence package

Create an immutable release directory containing:

- verification output;
- source/bytecode hashes;
- deployment manifest digest;
- governance transfer receipt;
- final privilege inventory;
- CI run URLs and artifact digests;
- reviewer sign-off;
- release decision and UTC timestamp.

## Prohibited actions while blocked

- Do not enable public liquidity or trading based only on repository status.
- Do not claim the separate `contracts/SentinelToken.sol` is verified source for the canonical deployed address.
- Do not publish ownership-renounced, multisig-controlled, audited, or production-complete claims without corresponding evidence.
- Do not store a production private key, mnemonic, or authenticated RPC credential in GitHub.

## Definition of done

The release is complete only when a reviewer can reproduce the canonical token state from Base Mainnet and verify that all production privileges terminate at the documented governance controller.