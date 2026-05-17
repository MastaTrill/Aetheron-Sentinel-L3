# How to Participate in Our Bug Bounty Program

Aetheron Sentinel maintains an active bug bounty program to identify and fix security vulnerabilities responsibly. This guide explains how to participate, report vulnerabilities, and earn rewards.

## Overview

Our bug bounty program rewards security researchers who discover vulnerabilities in:

- **Smart contracts** (Sentinel L3 core contracts, bridges, yield optimization)
- **API endpoints** (data retrieval, transaction submission, admin functions)
- **Infrastructure** (relayers, oracles, off-chain systems)

**Rewards:** $500–$50,000 based on severity and impact  
**Duration:** Ongoing (no end date)  
**Platforms:** HackenProof (primary), direct email (secondary)

---

## Supported Platforms

### HackenProof (Primary)
Our primary bounty platform with live leaderboard and integrated payouts.

- **Platform:** https://hackenproof.com
- **Program:** "Aetheron Sentinel"
- **Status:** Live now
- **Features:** Leaderboard, automatic payments, verification, researcher reputation

### Direct Email (Secondary)
For researchers who prefer direct communication:

- **Email:** security@aetheron.org
- **Subject:** "Bug Bounty Submission - [Vulnerability Type]"
- **Format:** Detailed vulnerability report (see Step 2 below)

---

## Scope & Eligibility

### In-Scope Targets

✓ **Smart Contracts**
- All Sentinel L3 contracts on Ethereum, Polygon, Arbitrum, Base
- Bridge contracts and cross-chain infrastructure
- Yield optimization smart contracts

✓ **APIs & Infrastructure**
- REST API endpoints (https://api.aetheron.org)
- WebSocket connections for real-time data
- Telemetry relay systems

✓ **Internal Services**
- Operator command handlers
- Oracle price feeds
- Risk assessment engines

### Out-of-Scope

✗ **Third-Party Systems**
- Protocols we integrate with (Uniswap, Curve, Aave, etc.)
- Blockchain infrastructure (Ethereum, Polygon)
- External libraries (report directly to library maintainers)

✗ **General Issues**
- Documentation improvements
- Feature requests
- UI/UX bugs (report via GitHub Issues instead)

✗ **Responsible Disclosure Violations**
- Public disclosure before we remediate
- Selling/trading vulnerability information
- Extortion or threats

---

## Severity & Reward Levels

Rewards are determined by vulnerability severity and impact:

| Severity | Description | Example | Reward |
|----------|-------------|---------|--------|
| **Critical** | Causes total loss of funds or contract compromise | Reentrancy stealing all deposits | $10,000–$50,000 |
| **High** | Partial loss of funds or protocol compromise | Unauthorized fund transfer | $5,000–$10,000 |
| **Medium** | Enables unauthorized actions or denial of service | Access control bypass | $1,000–$5,000 |
| **Low** | Best practice violation or minor issue | Missing event emission | $500–$1,000 |

---

## Step 1: Discover the Vulnerability

Thoroughly test Sentinel L3 for security issues. Focus areas:

### Smart Contracts
- **Access Control:** Can unauthorized addresses execute privileged functions?
- **State Management:** Can contract state be corrupted?
- **External Calls:** Are external calls safe from reentrancy?
- **Input Validation:** Do functions validate inputs properly?
- **Math:** Are there integer overflow/underflow risks?

### APIs & Infrastructure
- **Authentication:** Can unauthorized users access private endpoints?
- **Authorization:** Can users access others' data?
- **Rate Limiting:** Is there DoS protection?
- **Input Validation:** Are API inputs sanitized?

### Testing Tools
- **Static Analysis:** `slither`, `mythril`, `semgrep`
- **Dynamic Analysis:** `echidna`, `foundry`, `hardhat`
- **Manual Testing:** Deploy on testnet and test edge cases

---

## Step 2: Prepare Your Report

Write a clear, detailed vulnerability report including:

### Report Template

```markdown
# Vulnerability Report: [Title]

## Summary
[1-2 sentence overview of the vulnerability]

## Severity
[Critical / High / Medium / Low]

## Affected Component
- Contract: [name and address/GitHub link]
- Function: [function name]
- Lines: [line numbers]
- Chain: [Ethereum / Polygon / etc.]

## Vulnerability Description
[Detailed explanation of the vulnerability, how it occurs, and why it's dangerous]

## Proof of Concept
[Code or steps to reproduce the vulnerability]

### Example PoC:
\`\`\`solidity
// Show how the vulnerability can be exploited
// Include actual code or transaction hashes from testnet
\`\`\`

## Impact
[What can an attacker do? How much can they steal? How many users are affected?]

## Remediation
[Suggested fix for the vulnerability]

## References
[Links to CWE, CVE, external resources]

## Timeline
- [Date]: Vulnerability discovered
- [Date]: Report submitted
```

### Example Report

```markdown
# Reentrancy in withdrawETH Function

## Summary
The withdrawETH function in Bridge.sol is vulnerable to reentrancy attacks, allowing attackers to drain the contract.

## Severity
Critical

## Affected Component
- Contract: Bridge.sol
- Function: withdrawETH (line 45)
- Chain: Ethereum Sepolia (testnet)

## Vulnerability Description
The function sends ETH to the recipient before updating the balance, enabling reentrancy attacks.

## Proof of Concept
1. Deploy a malicious contract that calls withdrawETH in its fallback function
2. Trigger the withdrawal
3. The malicious contract's fallback fires, calling withdrawETH again
4. This repeats until the contract is drained

## Impact
Any user can steal all ETH from the contract.

## Remediation
Update the balance before sending ETH (Checks-Effects-Interactions pattern):
\`\`\`solidity
balances[msg.sender] -= amount;
(bool success, ) = msg.sender.call{value: amount}("");
require(success);
\`\`\`

## References
- CWE-246: Reentrancy
- https://ethereum.org/en/developers/tutorials/secure-smart-contracts-with-design-patterns/
```

---

## Step 3: Submit Your Report

### Via HackenProof
1. Go to https://hackenproof.com
2. Search for "Aetheron Sentinel"
3. Click **"Submit Report"**
4. Fill in the vulnerability details
5. Attach proof-of-concept code or screenshots
6. Submit

**Expected response:** 24–48 hours

### Via Email
1. Compose an email to **security@aetheron.org**
2. Subject: "Bug Bounty Submission - [Vulnerability Type]"
3. Attach your report as markdown or PDF
4. Include PoC code as attachment or inline
5. Send

**Expected response:** 24–48 hours

---

## Step 4: Vulnerability Assessment

Our security team will:

1. **Verify** the vulnerability is real and exploitable
2. **Assess** severity and impact
3. **Determine** reward amount
4. **Communicate** next steps via email/HackenProof

### What Happens Next
- ✅ Confirmed: We'll schedule a fix and pay the reward
- ⚠️ Partial Credit: If the issue is partially valid, we may offer reduced reward
- ❌ Rejected: If the vulnerability is invalid, we'll explain why

---

## Step 5: Resolution & Payment

### Timeline

| Phase | Timeline |
|-------|----------|
| Report submission | Day 0 |
| Initial assessment | Day 1–2 |
| Confirmation & reward offer | Day 3–5 |
| Fix implementation | Day 7–30 (depending on severity) |
| Verification of fix | Day 35–40 |
| Reward payment | Day 42 |
| Public disclosure (optional) | Day 60+ |

### Responsible Disclosure
- **Do not** publicly disclose the vulnerability until we've fixed it
- We'll notify you when the fix is deployed
- You can then request to be credited in our security advisory
- Public disclosure typically happens 30 days after deployment

### Reward Payment
Rewards are paid via:
- **HackenProof:** Automatically via platform (USDC, Polygon)
- **Email submission:** Direct transfer to your Ethereum address or bank account (USDC preferred)

---

## Examples of Valid Reports

### ✓ Reentrancy Vulnerability
```
Function A calls external contract before updating state, 
enabling reentrancy attack.
[Details, PoC, remediation]
```

### ✓ Access Control Bypass
```
Administrative function checks msg.sender == owner 
but owner can be changed by anyone.
[Details, PoC, remediation]
```

### ✓ Oracle Manipulation
```
Price oracle lacks validation, allowing attackers to feed 
arbitrary prices and manipulate yield farming returns.
[Details, PoC, remediation]
```

### ✓ Denial of Service
```
API endpoint has no rate limiting, allowing attackers 
to overload the server and disrupt service.
[Details, PoC, remediation]
```

---

## Examples of Invalid Reports

### ✗ Operational Issues
- "Your website is slow" (not security)
- "The logo is ugly" (design feedback)
- "Fix the documentation" (feature request)

### ✗ Third-Party Vulnerabilities
- "I found a bug in Uniswap" (report to Uniswap instead)
- "OpenZeppelin library has a vulnerability" (report to OpenZeppelin)

### ✗ Speculative Issues
- "This might be vulnerable if..." (needs proof)
- "The contract could fail if..." (provide PoC)

### ✗ Already Known
- Issues we've already disclosed and fixed
- Issues mentioned in our current audit scope

---

## Researcher Resources

### Documentation
- [SECURITY.md](SECURITY.md) — Security practices and incident response
- [SECURITY_POLICY.md](SECURITY_POLICY.md) — Detailed security policies
- [CONTRACTS.md](CONTRACTS.md) — List of all contracts and addresses
- [DISCLAIMERS.md](DISCLAIMERS.md) — Risk and liability disclaimers

### Testnet Access
- Deploy and test against our Sepolia testnet contracts
- Testnet contracts available at addresses in [CONTRACTS.md](CONTRACTS.md)
- Testnet ETH available at [Sepolia Faucet](https://sepoliafaucet.com)

### Communication
- **Security email:** security@aetheron.org
- **General inquiries:** aetheron.solana@gmail.com
- **HackenProof:** Direct messaging on platform

### Leaderboard
View top researchers and their contributions:
- https://hackenproof.com/leaderboard

---

## Frequently Asked Questions

**Q: How long until I get paid?**  
A: Typically 30–45 days from submission (assessment + fix + verification). HackenProof integration may accelerate this.

**Q: Can I report the same vulnerability twice?**  
A: No. Once a vulnerability is confirmed and reported, subsequent identical reports don't earn rewards.

**Q: What if I disagree with the severity rating?**  
A: Email security@aetheron.org with your justification. Our team will reconsider.

**Q: Can I participate anonymously?**  
A: Yes, but you'll need an account to receive payment. Reward payments can go to a wallet address or entity name instead of personal information.

**Q: Is there a maximum reward cap?**  
A: No. Critical vulnerabilities affecting many users may earn bounties above $50,000.

**Q: Can I participate if I'm from a sanctioned country?**  
A: We comply with U.S. sanctions. Some countries may be restricted.

---

## Code of Conduct

Bug bounty researchers must:

✅ **Do**
- Test responsibly on testnet first
- Follow responsible disclosure practices
- Provide detailed, clear reports
- Respect our timeline
- Keep vulnerabilities confidential until fixed

❌ **Don't**
- Access other researchers' data
- Use vulnerabilities for extortion
- Publicly disclose before we fix it
- Exceed the stated scope
- Use automated tools to scan production systems extensively

---

## Join Our Community

Connect with other security researchers and the Aetheron team:

- **GitHub Discussions:** [Security discussions](https://github.com/MastaTrill/Aetheron-Sentinel-L3/discussions)
- **Twitter:** [@AetherionSentinel](https://twitter.com)
- **Discord:** [Community server](https://discord.gg/)

---

## Thank You

We appreciate your help securing Aetheron Sentinel for our users. Responsible researchers are the backbone of blockchain security.

**Questions?**

📧 **Security:** security@aetheron.org  
💬 **General:** aetheron.solana@gmail.com  
🌐 **HackenProof:** https://hackenproof.com

---

**Document Version:** 1.0  
**Last Updated:** May 13, 2026
