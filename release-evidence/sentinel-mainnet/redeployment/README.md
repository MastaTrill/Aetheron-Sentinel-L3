# SENTINEL Controlled Redeployment Evidence Packet

This directory is the only accepted evidence location for the replacement SENTINEL release. The legacy token and pool cannot satisfy any gate here.

## Fixed release constants

- Chain: Base Mainnet (`8453`)
- Rehearsal chain: Base Sepolia (`84532`)
- Required 57% Creator beneficiary: `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`
- Required Creator share: `570000000000000000` wad
- Legacy token: `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` (non-canonical)
- Governing decision: `docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md`

## Execution order

1. Complete `deployment-manifest.json` with no placeholder or null release fields.
2. Run a protected Base Sepolia rehearsal without a Base Mainnet broadcast and write `base-sepolia-rehearsal.json`.
3. Record explicit project-owner risk acceptance and a separate, expiring Base Mainnet authorization in `mainnet-authorization.json`.
4. Deploy and preserve `deployment-receipt.json`.
5. Reproduce state through two independent providers in `base-mainnet-rpc-a.json` and `base-mainnet-rpc-b.json`.
6. Record treasury, share, ownership, initializer, and emergency-control checks in `authority-beneficiary-verification.json`.
7. Obtain separate smoke-test authorization, execute one minimal buy and one minimal sell, and preserve both authorization and receipts.
8. Generate `SHA256SUMS`, update the closure manifest, and run `node scripts/validate-sentinel-redeployment-closure.mjs --mode=final`.

Any byte change to `deployment-manifest.json` invalidates digest-bound simulation, rehearsal, and authorization evidence. Reset affected gates to pending and regenerate that evidence; never rewrite a historical receipt to reference the new digest.

## Non-negotiable safety rules

- No production private key, mnemonic, wallet export, or signing session belongs in this repository or CI.
- Preparation and simulation do not authorize Base Mainnet deployment, liquidity movement, or trading.
- The project owner must explicitly accept the risk of proceeding without an independent security review in the exact, expiring Mainnet authorization.
- Never mark a gate complete before the exact required evidence exists and is reproducible.
