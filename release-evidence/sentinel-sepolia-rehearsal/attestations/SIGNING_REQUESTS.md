# SENTINEL beneficiary signing requests — replacement deployment

## Context

The legacy Base SENTINEL pool reported `0x7e3D11f70084D667295710E6b7FF50C3b0487a45` as the 57% beneficiary. The project owner confirmed non-control of that address on 2026-08-01. The replacement deployment will configure the Aetheron treasury as the 57% creator beneficiary from inception:

`0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

Never disclose a private key, mnemonic, wallet export, or signing session.

## Primary — 57% creator fee recipient — READY TO SIGN

After the replacement deployment is live, the project owner (William McCoy / MastaTrill) signs the following message from `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` using EIP-191 `personal_sign`:

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: <REPLACEMENT_TOKEN_ADDRESS>
Pool ID: <REPLACEMENT_POOL_ID>
Beneficiary address: 0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa
Configured share: 57%
Intended economic role: Creator fee recipient (Aetheron treasury)
Controlling person or organization: William McCoy / MastaTrill

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the beneficiary may transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: <YYYY-MM-DD>
```

> **Note:** Replace `<REPLACEMENT_TOKEN_ADDRESS>` and `<REPLACEMENT_POOL_ID>` with the actual deployed addresses after redeployment. Do not sign until the replacement deployment is confirmed on-chain and verified through two independent RPC providers.

## External beneficiaries

| Address | Share | Role |
|---------|-------|------|
| `0x21E2ce70511e4FE542a97708e89520471DAa7A66` | 5% | Doppler protocol owner (Safe) |
| `0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1` | 1.9% | Bankr ecosystem fund |
| `0xF60633D02690e2A15A54AB919925F3d038Df163e` | 36.1% | Bankr platform/integrator |

## Legacy audit trail

The following challenge message targeted the legacy beneficiary `0x7e3D...7a45`. It was never signed because the project owner does not control that address.

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: 0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
Pool ID: 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d
Beneficiary address: 0x7e3D11f70084D667295710E6b7FF50C3b0487a45
Configured share: 57%
Intended economic role: On-chain creator-fee slot; intended Aetheron recipient is 0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa
Controlling person or organization: <VERIFIED CONTROLLER OF 0x7e3D...7a45 ONLY>

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the current beneficiary can transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: <UTC_DATE>
```
