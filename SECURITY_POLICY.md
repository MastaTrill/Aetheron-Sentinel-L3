# Security Policy

## Supported Versions

| Version | Supported         |
| ------- | ----------------- |
| 1.x     | ✅ Active support |

## Known Security Issues

### NPM Dependencies

This project contains known vulnerabilities in development dependencies due to outdated transitive dependencies:

| Package                                                         | Severity | Status                        |
| --------------------------------------------------------------- | -------- | ----------------------------- |
| `@openzeppelin/contracts` (transitive from LayerZero/Chainlink) | High     | Non-exploitable in production |
| `elliptic`                                                      | Critical | Development tooling only      |
| `axios`                                                         | High     | Build tooling only            |
| `form-data`                                                     | Critical | Build tooling only            |

### Mitigations

1. **Development-only dependencies**: All vulnerable packages are dev/build dependencies, not deployed to production
2. **No runtime exposure**: These dependencies are not included in contract deployments
3. **Isolated environment**: Vulnerabilities cannot be exploited through smart contract interactions

### Exception Handling

The `@ensdomains/ens-contracts` package (malware vulnerability GHSA-58x9-4xmp-8mg5) has been removed from dependencies. The `SentinelENSManager` contract has been stubbed and is marked explicitly as disabled.

## Reporting a Vulnerability

Report security vulnerabilities to security@aetheron.io

## CI/CD Security

- ESLint runs with zero errors
- TypeScript strict mode enabled
- Prettier formatting enforced
- Weekly security audit workflow scheduled
