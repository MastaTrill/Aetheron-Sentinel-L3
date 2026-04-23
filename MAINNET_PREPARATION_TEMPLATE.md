# Mainnet Preparation Template

This document guides mainnet deployment using the exact same workflow validated on Sepolia.

## Pre-Deployment Decisions

Before deploying to mainnet, confirm:

1. **Owner address** (final multisig or admin EOA)
   - Default: Consider a hardware wallet or multisig at this stage
   - Current Sepolia: `0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB` (test EOA)

2. **Relayer wallet** (for bridge signature verification)
   - Dedicated wallet recommended for production
   - Must be controlled and monitored for active relays

3. **Optional components deployment decision**
   - Deploy liquidityMining + rewardAggregator before go-live? (Yes/No)
   - Wire them to CoreLoop immediately after deployment? (Yes/No)

4. **Bridge configuration**
   - Supported tokens: (list token addresses)
   - Supported destination chains: (list chainIds and limits)

5. **Governance break-glass**
   - Keep owner EOA as proposer/canceller? (Yes/No)
   - Or lock down to multisig-only? (Yes/No)

---

## Deployment Workflow

### Step 1: Prepare Environment

```bash
# Copy template
cp .env.example .env.mainnet

# Edit with mainnet values
# SENTINEL_OWNER=0x<mainnet-multisig-or-admin>
# OWNER_PRIVATE_KEY=0x<deployer-private-key>
# MAINNET_RPC_URL=https://eth-mainnet.infura.io/...
# (other required env vars)
```

### Step 2: Deploy All Contracts

```bash
# Dry run first
npm run deploy:mainnet -- --dry-run

# Execute (requires OWNER_PRIVATE_KEY in .env)
npm run deploy:mainnet

# Save output JSON
cp DEPLOYED_ADDRESSES.json DEPLOYED_ADDRESSES_mainnet_$(date +%s).json
```

### Step 3: Update Configuration Files

```bash
# Export mainnet addresses to site/contracts.js
npm run export:site-config -- --network mainnet

# Update subgraph with mainnet start blocks
# (Manually inspect DEPLOYED_ADDRESSES.json for deployment receipt blocks)
```

### Step 4: Execute Ownership Handoff

**For deployer ≠ final owner:**

```bash
# Copy deployer's private key where OWNER_PRIVATE_KEY becomes the final owner's key
# (If deployer is multisig, execute the 4 timelock transactions via Safe UI)

# If deployer is direct EOA with private key:
OWNER_PRIVATE_KEY=0x<deployer-key> npm run setup:ownership -- --network mainnet

# This will:
# 1. Grant TIMELOCK_ADMIN_ROLE to multisig
# 2. Grant PROPOSER_ROLE to multisig
# 3. Grant CANCELLER_ROLE to multisig
# 4. Revoke TIMELOCK_ADMIN_ROLE from deployer
# 5. Configure relayers, monitors, etc.
```

**If using multisig as deployer:**

The deployment script will output exact pending transactions to execute via Safe UI. Follow those instructions instead.

### Step 5: Enable Bridge Relayer

```bash
# Generate Safe payload for relayer enablement
RELAYER_ADDRESSES=0x<mainnet-relayer-address> node scripts/generate-bridge-relayer-safe.cjs

# Output: scripts/bridge-relayer-enablement.mainnet.safe.json
# Execute via Safe UI, OR direct call if owner is EOA:

OWNER_PRIVATE_KEY=0x<owner-key> RELAYER_ADDRESSES=0x<mainnet-relayer-address> node scripts/.tmp_enable_bridge_relayer.cjs
```

### Step 6: Wire Optional Components (if deploying)

**If liquidityMining & rewardAggregator are deployed:**

```bash
# Wire them to CoreLoop
OWNER_PRIVATE_KEY=0x<owner-key> node scripts/.tmp_wire_coreloop_components.cjs

# This will set:
# - multiSigVault
# - securityAuditor
# - stakingSystem
# - liquidityMining (if present in contracts.js)
# - rewardAggregator (if present in contracts.js)
```

### Step 7: Configure Bridge Operations

```bash
# Set supported tokens
OWNER_PRIVATE_KEY=0x<owner-key> node scripts/.tmp_configure_bridge.cjs
# (or call manually via Safe/EOA)

# Set destination chain limits
OWNER_PRIVATE_KEY=0x<owner-key> node scripts/.tmp_set_chain_limits.cjs
# (or call manually via Safe/EOA)
```

### Step 8: Final Verification

Run the same verification suite used for Sepolia:

```bash
# Ownership alignment
node scripts/section7-final-sweep.cjs

# Allowlist audit
node scripts/audit-allowlists.cjs

# Relayer verification
RELAYER_ADDRESSES=0x<mainnet-relayer-address> node scripts/verify-bridge-relayers.cjs

# Save all outputs
node scripts/section7-final-sweep.cjs > /tmp/mainnet_section7_$(date +%s).txt
node scripts/audit-allowlists.cjs > /tmp/mainnet_allowlists_$(date +%s).txt
```

### Step 9: Create Release Documentation

```bash
# Copy and edit the Sepolia release notes template
cp RELEASE_NOTES_SEPOLIA_*.md RELEASE_NOTES_MAINNET_$(date +%Y-%m-%d).md

# Update all:
# - Block numbers (from deployment receipts)
# - Transaction hashes (from deployment output)
# - Addresses (from contracts.js or deployment output)
# - Dates (current date)
```

### Step 10: Publish & Sign Off

1. Attach all verification outputs to mainnet release PR
2. Require code review + security review signoff
3. Require mainnet test traffic validation before production cutover

---

## Rollback Strategy

If deployment fails partway through:

1. **Pre-timelock-transfer failures**: All contracts remain under deployer control. Safe to restart.
2. **Post-timelock-transfer failures**: Multisig holds admin role. Use multisig to remediate (grant/revoke roles, call functions, etc.).
3. **Complete failure**: Document the state and redeploy fresh (or use mainnet rescue procedures documented separately).

---

## Security Checklist Before Go-Live

- [ ] All 4 timelock transactions executed and verified
- [ ] Bridge relayer enabled and verified
- [ ] All 20 Ownable contracts verified to have correct owner
- [ ] Allowlist audit passes (no unknown addresses)
- [ ] Subgraph deployed and indexing (check The Graph dashboard)
- [ ] Token support configured on bridge
- [ ] Chain limits configured on bridge
- [ ] Monitor/reporter roles assigned
- [ ] Break-glass recovery path tested (optional: practice revoking one permission and re-granting via multisig)
- [ ] All verification outputs attached to release PR
- [ ] Code + security review complete
- [ ] Community/stakeholder notification complete

---

## Reference Documents

- **Sepolia deployment record**: [RELEASE_NOTES_SEPOLIA_2026-04-23.md](./RELEASE_NOTES_SEPOLIA_2026-04-23.md)
- **Deployment checklist**: [DEPLOYMENT_OWNERSHIP_CHECKLIST.md](./DEPLOYMENT_OWNERSHIP_CHECKLIST.md)
- **Verification scripts**: [scripts/](./scripts/)
- **Configuration**: [site/contracts.js](./site/contracts.js), [subgraph.yaml](./subgraph.yaml)

---

**Template created:** 2026-04-23  
**Based on:** Sepolia deployment block 10715441
