# SENTINEL owner-controlled replacement launch — readiness record

**Status: HOLD — preparation only.** No signing, broadcast, deployment, or trade is authorized by this document.

## Owner designation
- Proposed owner / administration wallet: `0xa6ea4285070A5ac5AaBbee3Cd8c0EfC90d669211` (owner self-attested).
- Base Mainnet account inspection: no deployed bytecode (`0x`), nonce 0 at inspection; this does not prove control or ownership of any token.
- Sole human release authority: project owner. No external human approval gate.
- The historical `mainnet-authorization.json` expired 2026-09-05 and names a different sender; **do not reuse** it.

## Historical evidence, not current certification
- `base-sepolia-rehearsal.json` records a historical confirmed testnet deployment and 57% beneficiary allocation. Its manifest digest and sender predate this owner designation. It cannot certify a changed manifest.
- The deployment manifest currently has `execution.authorizedBaseMainnetSender: null`; do not fill this with an address merely because the owner nominated a wallet. Deployment sender and final token owner may differ under the Airlock architecture.
- `authority-beneficiary-verification.json` is a template with no replacement token/pool identifiers and no read-only verified owner/beneficiary/timelock state.

## Release gates
1. Validate actual deployment architecture: whether token ownership remains with Airlock, how the owner wallet controls governance, and the beneficiary's independently readable on-chain allocation. Do not assume `owner()` must equal the nominated wallet.
2. Prepare a new manifest revision and preserve its exact digest. Changing deployment-bearing fields invalidates old simulation/rehearsal/authorization evidence.
3. Complete a new protected Base Sepolia rehearsal **only with explicit testnet broadcast and gas authorization**; otherwise simulation only. Preserve transaction receipt and read-only token/beneficiary state.
4. Verify proposed Mainnet replacement token and pool against authoritative deployment receipts and at least two independent RPC reads. Do not reuse the legacy token/pool.
5. Obtain a fresh, expiring, exact-manifest owner authorization for any Mainnet broadcast. Deployment approval does not approve trading.
6. Run exact-head CI, Security, dependency checks, quote-signature and anchor verification. Any change requires fresh checks.

**No Mainnet launch or smoke trade until all applicable gates are genuinely satisfied.**

## Exact-head automated certification (2026-11-07 UTC)
- Commit `b9423822c25424482f688bb4ef4ceb9bfa9dc78d`: GitHub CI run `42333932250` completed successfully; Security run `42333932120` completed successfully.
- These workflow verdicts certify the tested repository head only, **not** deployment authority, an updated manifest, a fresh testnet rehearsal, or live beneficiary state.

## New manifest and rehearsal preflight
- Manifest revision prepared at commit `06cd7f29f1291c370bc9ef3c4bcd3473b7b74dcf`: owner designation metadata and owner-only review policy; signing and broadcast remain disabled.
- **Architecture check unresolved:** historical Base Sepolia token `owner` is Airlock (`0x3411306Ce66c9469BFF1535BA955503c4Bde1C6e`), not the signer. Owner wallet's authority must be demonstrated through actual governance/roles before declaring administrative control.
- **Fresh rehearsal status:** not executed. Previous confirmed testnet receipt applies only to its pinned historical manifest; do not rewrite it or claim a new transaction.
- **Safe next preflight:** validate exact revised manifest digest and run a new unsigned simulation with the current deployment scripts; preserve reproducible calldata, gas estimate and beneficiary outputs. Testnet broadcast requires explicit separate approval and gas source.
