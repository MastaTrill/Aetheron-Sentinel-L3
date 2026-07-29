# SENTINEL beneficiary signing requests (solo-creator model)

Under the solo-creator release model only the **Creator fee recipient** attestation is required for final mode. The other three beneficiaries are accepted as residual risk.

Never disclose a private key, mnemonic, wallet export, or signing session.

## Primary — 57% Creator fee recipient (required) — EIP-191

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: 0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
Pool ID: 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d
Beneficiary address: 0x7e3D11f70084D667295710E6b7FF50C3b0487a45
Configured share: 57%
Intended economic role: Creator fee recipient
Controlling person or organization: William McCoy (GitHub: MastaTrill)

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the current beneficiary can transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: 2026-07-29
```

The underlying EOA of this EIP-7702 Kernel account must sign the message. Do not sign through an unrelated session key or module.

After signing, replace the `pending` entry in `manifest.json` with:

- `"status": "signed"`
- the exact message text
- the public signature (65-byte EIP-191)

Then run:

```bash
BASE_RPC_URL=https://base-rpc.publicnode.com node scripts/verify-beneficiary-attestations.mjs
```

## External beneficiaries (residual risk accepted)

The following three addresses are **not** required to sign under the solo-creator model. Their slots remain `residual-risk-accepted` in the manifest.

| Address | Share | Role |
|---------|-------|------|
| `0x21E2ce70511e4FE542a97708e89520471DAa7A66` | 5% | Doppler protocol owner (Safe) |
| `0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1` | 1.9% | Bankr ecosystem fund |
| `0xF60633D02690e2A15A54AB919925F3d038Df163e` | 36.1% | Bankr platform/integrator |

If any of these parties later supply a valid signature, the corresponding entry may be upgraded from `residual-risk-accepted` to `signed` without breaking the package.
