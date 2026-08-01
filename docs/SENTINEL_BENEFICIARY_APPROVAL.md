# SENTINEL beneficiary identity and approval

The four observed shares exactly match Bankr's published default partner launch split for the 1.2% swap fee.

## Critical wallet mismatch

The established Aetheron treasury is:

`0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

The deployed Base SENTINEL pool instead reports this 57% beneficiary:

`0x7e3D11f70084D667295710E6b7FF50C3b0487a45`

Repository evidence does not establish that William McCoy, MastaTrill, or the Aetheron treasury controls the deployed 57% beneficiary.

**2026-08-01: Project owner confirmed they do not control `0x7e3D...7a45`.** The in-place `updateBeneficiary` remediation path is permanently closed.

| Beneficiary | Share | Intended economic role | Control technology | Approval state |
|---|---:|---|---|---|
| `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` | 57% | Creator fee recipient (Aetheron treasury) | EOA | **Pending attestation — owner controls; sign after redeployment** |
| `0xF60633D02690e2A15A54AB919925F3d038Df163e` | 36.1% | Bankr platform/integrator | EIP-7702 EOA using Calibur | Bankr attestation required |
| `0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1` | 1.9% | Bankr ecosystem (`alt`) fund | EOA | Bankr attestation required |
| `0x21E2ce70511e4FE542a97708e89520471DAa7A66` | 5% | Doppler protocol owner | Safe 1.4.1, 3-of-6 | Safe/EIP-1271 attestation required |

Public role documentation establishes the intended allocation, but it does not prove that a named person or organization currently controls an address. Cryptographic attestations close that gap.

## Required remediation — controlled redeployment

~~Path 1 (in-place updateBeneficiary) is permanently closed~~ — project owner confirmed non-control on 2026-08-01.

The only remaining path:

1. An approved migration or pool redeployment replaces the incorrect beneficiary configuration, deploying with `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` as the 57% creator beneficiary from inception. All mandatory gates in [ADR-2026-07-29](decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md) must pass.

## Required message

Each verified beneficiary signs the exact UTF-8 message below, replacing bracketed values only:

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: 0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
Pool ID: 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d
Beneficiary address: [ADDRESS]
Configured share: [PERCENT]
Intended economic role: [ROLE]
Controlling person or organization: [IDENTITY]

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the beneficiary may transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: [YYYY-MM-DD]
```

Never place a private key, mnemonic, API key, or wallet session in the repository. Store only the public message, signature, signer address, verification mode, UTC timestamp, and organizational role.

The EOA and EIP-7702 accounts use `eip191`. The Safe uses `eip1271`. Populate `release-evidence/sentinel-mainnet/attestations/manifest.json`, then run:

```bash
node scripts/verify-beneficiary-attestations.mjs
```
