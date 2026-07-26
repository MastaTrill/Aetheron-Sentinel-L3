# Sentinel L3 Release Execution

**Canonical token:** `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`  
**Network:** Base Mainnet (`8453`)  
**Release state:** BLOCKED until every required gate below is evidenced.  
**Current operator evidence:** `docs/evidence/SENTINEL_MAINNET_LIVE_STATE_2026-07-26.md`

## Release boundary

No document, frontend, announcement, liquidity action, listing request, or partner integration may describe SENTINEL as fully launched until all required gates are complete.

The canonical deployment does not currently match the repository's earlier assumption that an Aetheron-controlled wallet can directly transfer token ownership to a Safe. The observed token owner is a launch-controller contract. Release decisions must follow the deployed architecture rather than a generic ownership-transfer template.

## Gate 1 — Reproducible live-state verification

- [x] Run `scripts/verify-canonical-token.sh` against a public Base Mainnet RPC and preserve operator output.
- [x] Record token metadata, total supply, owner, pool fields, mint rate, vesting fields, token URI, and runtime bytecode hash.
- [x] Record the controller's asset data, V4 pool key, pool ID, positions, beneficiaries, fee schedule, and accounting getters.
- [x] Save RPC block numbers and UTC timestamps in the operator evidence record.
- [ ] Reproduce all material reads through a second trusted RPC provider.
- [ ] Compare the reproduced values against `deployments/base-mainnet.json` and update the manifest only from reproducible reads.
- [ ] Fail the release if any material value differs without an explained chain-state transition.

## Gate 2 — Authority, privilege, and economic inventory

Document every contract and address capable of influencing the token, launch controller, pool, hook, fees, or beneficiaries.

At minimum, record:

- token owner and every owner-only token method;
- launch-controller owner and every controller-only method relevant to this asset;
- initializer, hook, migrator, pool manager, governance, and timelock addresses;
- upgradeability or immutability of every privileged component;
- minting and supply-change authority;
- metadata, pool-lock, migration, liquidity, fee-collection, and recovery authority;
- every beneficiary address, raw share, verified identity, and intended economic role;
- every externally callable method that can trigger migration, fee collection, or irreversible state changes.

For every privilege, record the holder, method selector, preconditions, intended controller, and whether the authority can be transferred, renounced, disabled, or is permanently external to Aetheron.

## Gate 3 — Deployed governance-model decision

Do not prepare or broadcast a direct token `transferOwnership` transaction unless exact deployed-source and call-path verification proves the current owner can and should execute it.

- [ ] Verify the exact deployed source and runtime bytecode for the token owner/controller.
- [ ] Verify the exact deployed source and runtime bytecode for the initializer, hook, migrator, and pool manager.
- [ ] Confirm whether any supported ownership-transition, migration, recovery, or governance path exists for this asset.
- [ ] Confirm the semantic and security consequences of dead-address governance and timelock fields.
- [ ] Confirm whether the observed mint-rate configuration can be changed, invoked, or permanently remains under external controller authority.
- [ ] Produce a written architecture decision choosing one of the following outcomes:
  - accept the deployed controller model with explicit risk disclosure and independent review;
  - execute a verified supported transition to an approved Safe/timelock;
  - migrate or redeploy to a replacement token under approved governance;
  - reject the deployment as the production token.
- [ ] Record approvers, rationale, UTC timestamp, and supporting evidence.

> Repository automation may read state, prepare unsigned data, and validate calldata. A repository workflow must never possess a production private key or autonomously broadcast a production governance transaction.

## Gate 4 — Pool, trading, fee, and beneficiary evidence

The token's `pool()` and `isPoolUnlocked()` getters must not be interpreted in isolation as proof that the associated Uniswap V4 market is enabled or disabled.

- [ ] Confirm the exact meaning of initializer raw status `2` from the deployed implementation.
- [ ] Confirm the exact dynamic-fee units and schedule semantics from the deployed hook.
- [ ] Preserve independently decoded successful swap-event evidence for the canonical pool ID.
- [ ] Verify current quoting and routing through the intended public interface.
- [ ] Perform an explicitly authorized minimal buy-and-sell smoke test and preserve transaction receipts.
- [ ] Determine whether cumulative accounting getters represent pending, claimable, or historical amounts.
- [ ] Verify the fee-collection path without collecting or redirecting production assets during review.
- [ ] Identify and approve every beneficiary and confirm that configured shares match the intended allocation.
- [ ] Document whether liquidity is withdrawable, migratable, permanently retained, or otherwise constrained.

No public statement may claim unrestricted trading, locked liquidity, burned liquidity, protocol-owned liquidity, or immutable fees without evidence specific to this pool architecture.

## Gate 5 — Security evidence

- [ ] Foundry build succeeds with locked compiler settings.
- [ ] Unit, fuzz, invariant, and integration tests succeed for repository-owned release code.
- [ ] Secret scan succeeds.
- [ ] Static-analysis findings are triaged.
- [ ] Exact external deployed components are reviewed against verified source and runtime bytecode.
- [ ] Independent review is complete or all unaudited risks are explicitly disclosed.
- [ ] Emergency and incident procedures reflect the actual authority model and do not assume unavailable owner powers.

## Gate 6 — Launch evidence package

Create an immutable release directory containing:

- raw verification output from at least two RPC providers;
- source and runtime-bytecode hashes;
- deployment-manifest digest;
- controller, privilege, and beneficiary inventories;
- pool key, pool ID, positions, fee schedule, swap evidence, and accounting evidence;
- governance-model decision and any supported transition receipt;
- CI run URLs and artifact digests;
- independent reviewer sign-off;
- final release decision and UTC timestamp.

## Prohibited actions while blocked

- Do not broadcast the repository's direct ownership-transfer template based only on token ABI availability.
- Do not call migration, fee collection, pool-management, minting, or metadata functions during verification without separate written authorization.
- Do not enable or promote public liquidity or trading based only on repository status or a single getter.
- Do not claim the separate `contracts/SentinelToken.sol` is verified source for the canonical deployed address.
- Do not publish ownership-renounced, multisig-controlled, audited, fixed-supply, immutable-liquidity, or production-complete claims without corresponding evidence.
- Do not store a production private key, mnemonic, authenticated RPC credential, or wallet session in GitHub.

## Definition of done

The release is complete only when an independent reviewer can reproduce the canonical Base Mainnet state, verify the exact deployed authority and market architecture, identify all material beneficiaries and privileges, reproduce swap and fee evidence, and confirm that the written release decision explicitly accepts or remediates every material governance and economic risk.
