# SENTINEL beneficiary signing requests — BLOCKED

## Release blocker

The established Aetheron treasury wallet is:

`0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

The Base SENTINEL pool currently reports a different 57% beneficiary:

`0x7e3D11f70084D667295710E6b7FF50C3b0487a45`

Control of the deployed beneficiary has not been proven. **William McCoy / MastaTrill must not sign or be listed as the controller of `0x7e3D...7a45` unless that address produces a valid cryptographic signature.**

Never disclose a private key, mnemonic, wallet export, or signing session.

## Primary — 57% on-chain creator-fee slot — BLOCKED

The following message is preserved only as the exact challenge that the current beneficiary would need to sign. It is not prefilled with William McCoy's identity and must not be signed from the `c1fa` treasury because that wallet is not the currently configured beneficiary.

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

## Required remediation before final release

One of the following must occur and be independently verified:

1. The current beneficiary proves control and calls the supported `updateBeneficiary` path to transfer the 57% slot to `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` after settling accrued fees; or
2. An approved pool migration or redeployment replaces the beneficiary configuration.

After remediation, regenerate the attestation package from the resulting on-chain state. Do not edit the manifest to pretend that the deployed state has changed.

## External beneficiaries

| Address | Share | Role |
|---------|-------|------|
| `0x21E2ce70511e4FE542a97708e89520471DAa7A66` | 5% | Doppler protocol owner (Safe) |
| `0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1` | 1.9% | Bankr ecosystem fund |
| `0xF60633D02690e2A15A54AB919925F3d038Df163e` | 36.1% | Bankr platform/integrator |
