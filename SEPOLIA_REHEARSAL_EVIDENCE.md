# Sentinel L3 Base Sepolia Rehearsal Evidence Packet

This document tracks the objective evidence required for the institutional audit, governance verification, and Base Mainnet prerequisite safety gates of the Sentinel L3 Base Sepolia rehearsal.

---

## 1. Rehearsal Execution Identity

- **Workflow Run ID:** `31412271952`
- **Workflow Run URL:** [https://github.com/MastaTrill/Aetheron-Sentinel-L3/actions/runs/31412271952](https://github.com/MastaTrill/Aetheron-Sentinel-L3/actions/runs/31412271952)
- **Target Network:** Base Sepolia (Chain ID: `84532`)
- **Release Profile:** `sentinel-guardrails-v1`
- **Release Commit:** `b0c83b4f5f82e0a0e3e2f094f6ff950b8e454eb3`
- **Ephemeral Deployer:** `0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2`
- **Final Owner:** `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB`
- **Release Invariant Status:** `verified-paused`

---

## 2. Core Guardrails Deployed Contracts

| Contract                | Address                                      | Tx Hash                                                              | Block      | Runtime Code Hash                                                    |
| :---------------------- | :------------------------------------------- | :------------------------------------------------------------------- | :--------- | :------------------------------------------------------------------- |
| **SentinelInterceptor** | `0x5459D1398B0d29a758432183B6Fb306B46aD64f3` | `0x80cf50f999dd981345782f0677c205c97662103ee41b3c69bc7b63cd447f6fe7` | `45306820` | `0xbdeee8bd9984d16ba57040828cc9d6815de33524a2d0c21e14a3c8c6d098f9e2` |
| **CircuitBreaker**      | `0x7233e0805d71EEd3632a9E7579C5Fdfd7Fd6b88B` | `0x9a16bdaba70a79aff8a4709f88d81deaf935d4c52c6545e65fd8e8aa35ae8e17` | `45306822` | `0x80d00f7e7dcd98fcb611028a242d3a4fac7b24302d9bae04fdb945f1abad708c` |
| **RateLimiter**         | `0xB84Cc1C36a8a037F56B85d4634fd293e89D59257` | `0xd83e3aecc80ec8fac0a8b096447fe2151e0dc064e508f22d96eb7e68a6d7e75e` | `45306823` | `0x7c9096ae213751b9861629260b3ee0ad2f3258ff062b1fb6ab6cad3f75757165` |

---

## 3. On-Chain Role & Governance Verification

| Invariant Checked            | Result                                                                         | Reference                     |
| :--------------------------- | :----------------------------------------------------------------------------- | :---------------------------- |
| **Emergency Pause**          | ✅ All contracts verified in `paused` state                                    | Verified on-chain             |
| **Ownership Transfer**       | ✅ Ownership handed to final owner `0xA1B9...A0fB`                             | `owner()` check               |
| **Deployer Role Revocation** | ✅ Zero admin/operator/monitor roles retained by deployer                      | Role bitmask check            |
| **Monitor Role Assignment**  | ✅ Monitor `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` granted `MONITOR_ROLE` | Verified on-chain             |
| **Reporter Authorization**   | ✅ Monitor authorized on `SentinelInterceptor`                                 | `authorizedReporters()` check |

---

## 4. Verification Proofs & Manifest

- **Manifest File:** `deployments/baseSepolia-sentinel-guardrails-v1.json`
- **Verification Timestamp:** `2026-08-10T17:12:34.608Z`
- **Release Verification Log:** `RELEASE VERIFICATION: PASS (sentinel-guardrails-v1)`
