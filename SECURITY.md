# Security Policy

## Bug Bounty Program

Aetheron Sentinel L3 is a critical security system for bridge-defense. We welcome security researchers to help identify vulnerabilities through our bug bounty program.

### Scope (Private Beta)

**In Scope:**

- `contracts/security/*.sol` - Security modules (CircuitBreaker, RateLimiter, PriceOracle, etc.)
- `contracts/core/AetheronModuleHub.sol` - Core hub contract
- `contracts/governance/*.sol` - Governance contracts
- `contracts/treasury/TimeLockVault.sol` - Treasury contracts
- `contracts/upgrades/UUPSProxy.sol` - Upgradeability proxies

**Out of Scope:**

- Admin/multi-sig keys or signer addresses
- Testnet-only contracts and deployment scripts
- Dashboard, subgraphs, and off-chain services
- Third-party integrations (oracles, bridges)

### Rewards

| Severity | Range            |
| -------- | ---------------- |
| Critical | $5,000 - $25,000 |
| High     | $1,000 - $5,000  |
| Medium   | $250 - $1,000    |

- **Private beta cap**: $50,000 total
- Rewards based on CVSS 3.1 scoring and actual impact

### Disclosure Policy

1. **Report**: Email aetheron.solana@gmail.com with:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)
   - Optional: Encrypt report using our PGP key

2. **Response**: We acknowledge within 24 hours and provide timeline

3. **Resolution**: We request 90-day disclosure embargo after fix

4. **Recognition**: Researchers credited (with permission) in security acknowledgments

### Prohibited Activities

- Do not attack testnet/mainnet infrastructure
- Do not disclose vulnerabilities publicly
- Do not attempt social engineering or phishing
- Do not access data beyond proof-of-concept

### Contact

- **Email**: aetheron.solana@gmail.com
- **PGP Key**: `aetheron-security.pgp` (in repository root)
- **Emergency**: See INCIDENT_RESPONSE_PROTOCOL.md

### Legal

This program is governed by the laws of the jurisdiction specified in ourTerms of Service. By participating, you agree to good-faith security research only.

---

**Last Updated**: April 2026
**Next Review**: July 2026
