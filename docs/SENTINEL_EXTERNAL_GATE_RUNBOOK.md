# SENTINEL External Gate Execution Runbook

This runbook completes the three remaining external gates tracked by issue #210.

- Beneficiary attestations: #215
- Authorized minimal buy/sell: #216
- Independent review and sign-off: #217

The repository, CI, read-only state reproduction, authority analysis, historical routing evidence, and closure validators are complete. These final gates require real wallet controllers, explicit spending authorization, and a genuinely independent reviewer.

## Non-negotiable safety boundary

Never place a private key, mnemonic, wallet export, API secret, or signing session in this repository, GitHub Actions, an issue, a pull request, chat, or a terminal command. Repository automation must remain read-only with respect to production wallets.

No ownership, minting, metadata, migration, fee, beneficiary, liquidity, or treasury action is part of this runbook.

## Gate 1: beneficiary control-and-role attestations

1. Send the appropriate message from `release-evidence/sentinel-mainnet/attestations/SIGNING_REQUESTS.md` to each beneficiary controller.
2. The controller replaces only the identity and UTC-date placeholders.
3. The controller signs the exact final message through its normal wallet interface.
4. Copy the public message and public signature into `release-evidence/sentinel-mainnet/attestations/manifest.json`.
5. Change that entry from `pending` to `signed`.
6. Verify all four entries:

```bash
BASE_RPC_URL=https://base-rpc.publicnode.com \
  node scripts/verify-beneficiary-attestations.mjs
```

The 5% Safe must return the EIP-1271 magic value. The three EIP-191 signatures must recover exactly to their beneficiary addresses.

A valid signature proves address control. The independent reviewer must separately verify the stated person, organization, and economic role.

## Gate 2: separately authorized minimal buy and sell

1. Fill every null field in `release-evidence/sentinel-mainnet/smoke-test/authorization.json`.
2. Post the completed authorization in issue #216 before any transaction is signed.
3. Use a dedicated non-privileged wallet funded only with the authorized principal and gas reserve.
4. Confirm Base chain ID `8453`, SENTINEL `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3`, canonical pool ID `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d`, route, fee, price impact, and slippage in the wallet interface.
5. Sign exactly one authorized WETH-to-SENTINEL buy.
6. Sign exactly one authorized SENTINEL-to-WETH sell.
7. Verify and preserve the two receipts:

```bash
export BASE_RPC_URL="https://base-rpc.publicnode.com"
export SENTINEL_SMOKE_TEST_WALLET="<AUTHORIZED_TEST_WALLET>"
export SENTINEL_BUY_TX_HASH="<BUY_TX_HASH>"
export SENTINEL_SELL_TX_HASH="<SELL_TX_HASH>"

node scripts/verify-sentinel-smoke-test.mjs
```

The verifier writes `smoke-test-receipts.json` and confirms successful canonical-pool events in both directions. It never signs or broadcasts.

## Gate 3: independent review

1. Give the reviewer issue #217 and the complete repository at the exact candidate commit.
2. The reviewer independently reproduces material claims and reviews the beneficiary attestations and smoke-test receipts.
3. The reviewer fills `release-evidence/sentinel-mainnet/independent-review/signoff.json`.
4. Verify the sign-off structure:

```bash
node scripts/verify-sentinel-independent-signoff.mjs
```

Only an unconditional `approve` decision can satisfy final-release mode. `approve-with-conditions` and `reject` remain blocking outcomes.

## Final evidence-only pull request

After all three gates pass:

1. Change the three corresponding statuses in `release-evidence/sentinel-mainnet/release-closure.json` from `pending` to `complete`.
2. Run:

```bash
BASE_RPC_URL=https://base-rpc.publicnode.com \
  node scripts/verify-beneficiary-attestations.mjs

BASE_RPC_URL=https://base-rpc.publicnode.com \
  node scripts/verify-sentinel-smoke-test.mjs

node scripts/verify-sentinel-independent-signoff.mjs
node scripts/validate-sentinel-release-closure.mjs --mode=final
```

3. Open an evidence-only pull request referencing #210, #215, #216, and #217.
4. Require every repository workflow and the manually dispatched `Sentinel Final Release Verification` workflow to pass.
5. Merge, create the immutable checksum package and release tag, then close all four issues.
