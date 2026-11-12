# SENTINEL fixed-supply / single-wallet candidate — review only

Branch: `draft/sentinel-fixed-supply-single-wallet-20261112`

## Proposed changes
- Token yearly mint rate: `20000000000000000` (2% WAD) to `0`.
- Proposed Base Mainnet sender: `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`.
- Same address remains the 57% Aetheron treasury beneficiary.
- Existing no-op governance and no-op migration retained **for comparison only**.

## Explicit limits
- Mainnet HOLD. No signing, broadcasting, deployment, merge, liquidity movement, or trading.
- Current digest-bound simulation, Sepolia rehearsal, prepared receipt and expired authorization refer to the **prior manifest** and must not be treated as valid evidence for this candidate.
- Zero configured yearly mint rate does **not** by itself prove immutable supply. Audit token factory, roles, mint paths, proxies and emergency controls.
- Verify whether the selected sender can execute the Airlock call and has adequate gas funding without sharing secrets.
- Verify governance ownership, role reachability, beneficiaries and fee settings through independent read-only checks.
- Recompute manifest digest and deployment calldata; run exact-head offline regression tests and fresh Sepolia simulation/rehearsal as appropriate.
- Obtain fresh explicitly scoped owner authorization only after all release gates pass.

## Decisions still pending
1. Accept the absence of administrative governance or select another supported model after code review.
2. Confirm fixed-supply semantics and intended initial supply.
3. Confirm sender control and fresh gas cap.
4. Independently review replacement address/pool predictions and ownership model.
