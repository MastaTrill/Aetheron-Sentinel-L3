# Contributing to Aetheron Sentinel L3

Thank you for your interest in contributing! Sentinel L3 is a high-security, institutional-grade DeFi overlay. Please follow these guidelines to help us maintain quality and security.

## How to Contribute

- **Bug Reports:** Open an issue with clear steps to reproduce and environment details.
- **Feature Requests:** Suggest improvements via issues or discussions. Please provide rationale and potential impact.
- **Pull Requests:**
  - Fork the repo and create a feature branch
  - Write clear, well-documented code
  - **Run all tests and linters before submitting a PR**
    - Solidity: `npm test` (Hardhat/Mocha)
    - Python: `PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py" -v`
    - Lint: `npm run lint` (no errors or warnings permitted)
  - Add or update tests for any new features or bug fixes
  - Update documentation (`README.md`, etc.) as needed
  - Ensure no sensitive or proprietary information is exposed
  - Submit a PR with a detailed description and reference related issues

## Linting & Code Style

- Use the provided ESLint config (`eslint.config.js`)
- For scripts in `scripts/`, Node.js globals and `require` are allowed
- No lint errors or warnings are permitted in CI

## Security

- **Never commit secrets or private keys**
- Review `SECURITY.md` for security best practices and reporting guidance

## Documentation

- Update `README.md` and other docs for any user-facing changes

---

## Code of Conduct

- Be respectful and constructive
- No spam, self-promotion, or off-topic discussions
- Security vulnerabilities should be reported privately (see below)

## Security Policy

If you discover a security vulnerability, **do not open a public issue**. Please email the core team at [aetheron.solana@gmail.com](mailto:aetheron.solana@gmail.com) (or use the private reporting channel).

## Style Guide

- Follow existing code style and conventions
- Write clear commit messages
- Document all public functions and modules

## License

By contributing, you agree that your contributions may be incorporated under the project’s license.

---

_Thank you for helping build the infrastructure of unity!_


## CI and PR reporting hygiene

- Do not mark checks as passed in PR text unless you have run them in the current branch context and can provide logs.
- If a check is blocked by environment or registry policy, record it explicitly as blocked rather than passed.
- Keep lint/test workflows blocking by default; avoid `|| true` in CI unless there is a documented temporary exception.

