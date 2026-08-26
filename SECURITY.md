# Security Policy

## Reporting a Vulnerability

We take the security of Aetheron Sentinel L3 seriously. If you believe you have found a security vulnerability, please report it to us responsibly through our private channels.

**Do not open a public GitHub issue for security vulnerabilities.**

### Reporting Channels

- **Primary Channel:** [HackenProof Program](https://hackenproof.com) (Preferred for tracked rewards)
- **Security Email:** security@aetheron.org
- **Secondary Email:** aetheron.solana@gmail.com

We aim to acknowledge receipt of your report within 24–48 hours.

## Bug Bounty Program

We maintain an active Bug Bounty program to reward researchers. Rewards range from **$500 to $50,000** based on the severity of the finding. For more details on scope and eligibility, please see our [Bug Bounty Guide](docs/HOW_TO_BUG_BOUNTY.md).

## Published Security Advisories

For a record of past security disclosures and fixed vulnerabilities, please refer to our [Security Advisories Directory](docs/advisories/).

## Security Tools & Pipeline

All code changes must pass our automated security pipeline before merging:

- **Slither & Mythril:** Static analysis and symbolic execution.
- **Aderyn:** Rust and Solidity vulnerability scanning.
- **Foundry:** Extensive fuzzing and property-based testing.

---

_For more information on our security practices, see [SECURITY.md](SECURITY.md)._
_Last Updated: May 13, 2026_
_Version: 1.1 (Aligned with Bug Bounty Guide)_
