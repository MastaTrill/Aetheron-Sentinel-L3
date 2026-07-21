# Aetheron Sentinel L3 — Release Notes v1.1.0

We are proud to announce the release of **Aetheron Sentinel L3 v1.1.0**, featuring advanced security heuristics, rich operational metrics, platform integrations, and command-line operator tools.

---

## What's New in v1.1.0

### 1. Advanced Security Threat Heuristics

- Added real-time detection of **Reentrancy attack footprints** (flagging recursive message calls such as `MSG.SENDER.CALL`).
- Added **Flash Loan exploitation indicators** (flagging excessive token borrowing signatures and price manipulation patterns).
- Configured these rules inside the threat score calculation pipeline to trigger circuit breakers dynamically.

### 2. Rich Discord & Slack Alerts

- The alerting webhook pipeline in the Sentinel Gateway now automatically formats warning payloads specifically for:
  - **Discord Embeds**: Beautiful red-themed warning panels with custom fields for threat score, reasons, and payload details.
  - **Slack Block Kit**: Clean sections with styled markdown formatting.

### 3. Prometheus Production Monitoring

- Integrated custom Prometheus client metrics:
  - `sentinel_threat_attempts_total` (counter, tracking allowed vs. blocked logs).
  - `sentinel_threat_score_latest` (gauge, displaying the latest evaluation score).
  - `sentinel_blocked_reasons_total` (counter, categorizing threat types).

### 4. Interactive Node Operator CLI Console

- Created `scripts/operator-console.js` providing direct command line access to:
  - Inspect contract owner and heartbeat status.
  - Pulse heartbeats manually.
  - Trigger circuit breakers during emergencies.
- Supports both an interactive shell and automation-friendly subcommands.

### 5. Threat Logs Query API & Dashboard Feed

- Implemented a secure `/logs` GET endpoint returning audit histories directly from the threat log store.
- Integrated the feed directly on the front-end dashboard, allowing operators to fetch and view live logs dynamically.

---

## Deployment & Verification

- Fully simulated and verified against local Hardhat nodes and Base Mainnet forks.
- ESLint and Prettier styling checks are 100% passing.
