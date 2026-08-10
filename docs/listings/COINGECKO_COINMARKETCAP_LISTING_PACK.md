# Aetheron (AETH) — Official Listing & Verification Packet

**Target Platforms:** CoinGecko, CoinMarketCap, DexScreener, DEXtools, GeckoTerminal, BaseScan

---

## 1. Project Information

- **Project Name:** Aetheron Sentinel L3
- **Token Name:** Aetheron
- **Token Ticker:** `AETH`
- **Network:** Base Mainnet (`8453`)
- **Token Contract:** [`0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e`](https://basescan.org/token/0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e)
- **Decimals:** 18
- **Total Supply:** 1,000,000,000 AETH (Fixed / Non-Mintable)
- **Website:** [https://mastatrill.github.io/Aetheron-Sentinel-L3/](https://mastatrill.github.io/Aetheron-Sentinel-L3/)
- **GitHub Organization / Repo:** [https://github.com/MastaTrill/Aetheron-Sentinel-L3](https://github.com/MastaTrill/Aetheron-Sentinel-L3)
- **Explorer URL:** [https://basescan.org/token/0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e](https://basescan.org/token/0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e)

---

## 2. Tokenomics & Distribution Breakdown

| Allocation Category                | Percentage  | Amount (AETH)     | On-Chain Wallet                              |
| ---------------------------------- | ----------- | ----------------- | -------------------------------------------- |
| **Deployer / Initial Liquidity**   | 41.67%      | 416,666,667       | `0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2` |
| **Treasury & Protocol Operations** | 30.00%      | 300,000,000       | `0x8A3ad49656Bd07981C9CFc7aD826a808847c3452` |
| **Ecosystem & Liquidity Rewards**  | 20.00%      | 200,000,000       | `0x76A83f91dC64FC4F29CEf6635f9a36477ECA6784` |
| **Strategic Backers**              | 5.00%       | 50,000,000        | `0xA7aa360d2F00Cf4130B3244D0A13AE32a49ab07C` |
| **Advisory & Contributors**        | 3.33%       | 33,333,333        | `0xe0A3B6368312dFd3E7E76202e673f895f8235A3d` |
| **TOTAL**                          | **100.00%** | **1,000,000,000** | —                                            |

---

## 3. Security Architecture & On-Chain Proofs

- **Contract Verification:** Fully source-verified on BaseScan (EVM Cancun / Solidity 0.8.28).
- **On-Chain Audit Anchoring:** `AuditAnchor.sol` records immutable SHA-256 cryptographic TEE attestations for every agent execution.
- **Access Control & Policy Engine:** `SentinelAgentPolicy.sol` enforces timelocked multi-bit role masks (`SWAP`, `LIQUIDITY`, `BRIDGE`, `EMERGENCY`).
- **Presale Auto-Liquidity Vault:** `AetheronPresaleVault.sol` automatically locks 60% of all crowdsale proceeds into the Uniswap v3 DEX liquidity pool.
- **Institutional Multisig:** Governed by Gnosis Safe 2-of-3 multisig with zero deployer backdoors.

---

## 4. Short Description for Listings

> **Aetheron Sentinel L3** is an institutional cross-chain security and autonomous DeFAI execution layer built on Base. Powered by post-quantum cryptographic primitives, real-time transaction interceptors, and hardware TEE attestation proofs, Aetheron enables autonomous on-chain agents to execute decentralized swaps and liquidity provisioning with guaranteed non-custodial invariants and zero MEV exposure.
