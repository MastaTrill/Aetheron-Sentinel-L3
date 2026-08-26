# Sentinel L3 — AI Threat Model Training Report

**Generated:** `2026-07-26T10:53:07.567Z`
**Model Version:** `v2.1.0-sentinel`
**Total Training Samples:** `46,470`
**Training Epochs:** `50`
**Model Hash (SHA-256):** `d81bcc689b154095776ded8bc8d0ff2e39dd0d065387b8aabd5beceec2abf0f3`

---

## 📊 Per-Category Classification Metrics

| Attack Category | Samples | Precision | Recall | F1 Score |
|---|---|---|---|---|
| Flash Loan Manipulation | 8,420 | 98.12% | 97.56% | 97.84% |
| Price Oracle Manipulation | 4,230 | 96.34% | 95.21% | 95.77% |
| Reentrancy Attack | 12,840 | 99.21% | 98.87% | 99.04% |
| Sandwich Attack | 6,750 | 94.45% | 93.12% | 93.78% |
| Governance Exploit | 1,820 | 91.03% | 89.44% | 90.23% |
| Liquidity Drain | 3,290 | 96.88% | 96.01% | 96.44% |
| Approval Phishing | 9,120 | 97.56% | 98.23% | 97.89% |

---

## 🏆 Macro-Averaged Performance
| Metric | Score |
|---|---|
| **Macro Precision** | **96.23%** |
| **Macro Recall** | **95.49%** |
| **Macro F1 Score** | **95.86%** |

---

## ✅ Model Certification
- The trained model meets the Sentinel L3 production deployment threshold (**F1 ≥ 90%** on all categories).
- Model is approved for integration with the live interceptor engine on Base Mainnet.

---
*Generated automatically by Sentinel L3 AI Threat Model Training Simulator.*
