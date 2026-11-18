# SENTINEL External Gate Execution Runbook (Historical / Legacy Deployment)

> **Superseded:** This runbook applies to the legacy deployment (`0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`, `legacy-non-canonical`) and must not authorize transactions for it. The active path is controlled redeployment under `docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md` and `release-evidence/sentinel-mainnet/redeployment-closure.json`.

This historical runbook documents the three external gates originally tracked by issue #210 prior to the controlled-redeployment decision.

- Beneficiary attestations: #215
- Authorized minimal buy/sell: #216
- Independent review and sign-off: #217

## Non-negotiable safety boundary

Never place a private key, mnemonic, wallet export, API secret, or signing session in this repository, GitHub Actions, an issue, a pull request, chat, or a terminal command. Repository automation must remain read-only with respect to production wallets.

## Historical Gate 1: beneficiary control-and-role attestations

1. Send the appropriate message from `release-evidence/sentinel-mainnet/attestations/SIGNING_REQUESTS.md` to each beneficiary controller.
2. The controller replaces only the identity and UTC-date placeholders.
3. The controller signs the exact final message through its normal wallet interface.
4. Copy the public message and public signature into `release-evidence/sentinel-mainnet/attestations/manifest.json`.
5. Verify all four entries:

```bash
BASE_RPC_URL=https://base-rpc.publicnode.com \
  node scripts/verify-beneficiary-attestations.mjs
```

## Historical Gate 2: separately authorized minimal buy and sell

1. Fill every null field in `release-evidence/sentinel-mainnet/smoke-test/authorization.json`.
2. Post the completed authorization in issue #216 before any transaction is signed.
3. Use a dedicated non-privileged wallet funded only with the authorized principal and gas reserve.
4. Confirm Base chain ID `8453`, legacy SENTINEL `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`, legacy pool ID `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`, route, fee, price impact, and slippage in the wallet interface.
5. Verify and preserve the two receipts via `node scripts/verify-sentinel-smoke-test.mjs`.

## Historical Gate 3: independent review

1. Verify the sign-off structure via `node scripts/verify-sentinel-independent-signoff.mjs`.
