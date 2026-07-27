# SENTINEL beneficiary signing requests

Each controller must replace `<CONTROLLING PERSON OR ORGANIZATION>` and `<UTC_DATE>` before signing. The exact final message and public signature must then be copied verbatim into `manifest.json`.

Never disclose a private key, mnemonic, wallet export, or signing session.

## 5% Doppler protocol owner — EIP-1271 Safe

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: 0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
Pool ID: 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d
Beneficiary address: 0x21E2ce70511e4FE542a97708e89520471DAa7A66
Configured share: 5%
Intended economic role: Doppler protocol owner
Controlling person or organization: <CONTROLLING PERSON OR ORGANIZATION>

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the current beneficiary can transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: <UTC_DATE>
```

The Safe message must complete its normal threshold-controlled approval process and be exported as EIP-1271-compatible signature bytes.

## 1.9% Bankr ecosystem fund — EIP-191

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: 0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
Pool ID: 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d
Beneficiary address: 0x2Cdd33d6FF2a897180c7F4e5a20F018Bf0c16fD1
Configured share: 1.9%
Intended economic role: Bankr ecosystem fund
Controlling person or organization: <CONTROLLING PERSON OR ORGANIZATION>

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the current beneficiary can transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: <UTC_DATE>
```

## 57% creator fee recipient — EIP-191

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: 0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
Pool ID: 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d
Beneficiary address: 0x7e3D11f70084D667295710E6b7FF50C3b0487a45
Configured share: 57%
Intended economic role: Creator fee recipient
Controlling person or organization: <CONTROLLING PERSON OR ORGANIZATION>

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the current beneficiary can transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: <UTC_DATE>
```

The underlying delegated EOA must sign this message. Do not sign through an unrelated session key or module.

## 36.1% Bankr platform/integrator — EIP-191

```text
SENTINEL BENEFICIARY CONTROL ATTESTATION

Chain ID: 8453
Token: 0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3
Pool ID: 0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d
Beneficiary address: 0xF60633D02690e2A15A54AB919925F3d038Df163e
Configured share: 36.1%
Intended economic role: Bankr platform/integrator
Controlling person or organization: <CONTROLLING PERSON OR ORGANIZATION>

I confirm that I control, or am authorized to represent, the beneficiary address above. I approve its configured SENTINEL fee share and acknowledge that the current beneficiary can transfer its share through updateBeneficiary after settling accrued fees.

Issue: MastaTrill/Aetheron-Sentinel-L3#210
UTC date: <UTC_DATE>
```

The underlying delegated EOA must sign this message. Do not sign through an unrelated session key or module.
