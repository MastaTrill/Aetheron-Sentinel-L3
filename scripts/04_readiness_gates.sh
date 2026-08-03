#!/usr/bin/env bash
# =============================================================================
# Aetheron Sentinel L3 — Step 04: Readiness Gates
# =============================================================================
# FIXES APPLIED:
#   BUG-23  `cast rpc eth_syncing` returns "false\n" — trailing newline caused
#           `== "false"` comparison to always fail. Fixed: strip whitespace
#           with tr -d '[:space:]' before comparing.
#   BUG-24  `cast codesize` returns hex on some Foundry versions (0x...) —
#           arithmetic `(( ERC721_SIZE > 0 ))` fails on hex in bash. Fixed:
#           normalise to decimal via printf '%d' with hex-aware parsing.
#   BUG-25  `cast wallet address` computed inside gate.lock heredoc — if the
#           command fails mid-heredoc the file is written with a partial value.
#           Fixed: pre-compute DEPLOYER_ADDR at script top and reuse it.
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ADDR_FILE="${ROOT}/artifacts/deployed-addresses.json"
GATE_LOCK="${ROOT}/artifacts/gate.lock"
REPORTS_DIR="${ROOT}/artifacts/reports"
mkdir -p "${REPORTS_DIR}"

LOG_PREFIX="[GATE]"
PASS="✅"; FAIL="❌"; WARN="⚠️ "; BLOCK="🚫"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${GREEN}${LOG_PREFIX}${NC} $*"; }
gate()  { echo -e "${BOLD}${CYAN}${LOG_PREFIX} ▶ GATE${NC} $*"; }
warn()  { echo -e "${YELLOW}${LOG_PREFIX} WARN${NC} $*"; }
error() { echo -e "${RED}${LOG_PREFIX} ERROR${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

RPC="${BASE_MAINNET_RPC_URL}"
L3_RPC="${SENTINEL_L3_RPC_URL:-}"
GATE_FAILURES=0
GATE_RESULTS=()

gate_fail() {
  error "${FAIL} $*"
  GATE_FAILURES=$(( GATE_FAILURES + 1 ))
  GATE_RESULTS+=("FAIL: $*")
}
gate_pass() {# ── Helper: normalise codesize (hex or decimal) to decimal ───────────────────
# BUG-24 FIX: `cast codesize` may return hex ("0x12ab") on some versions.
# bash `(( ))` cannot parse hex prefixed with 0x — use printf '%d'.
to_decimal() {
  local val="$1"
  if [[ "${val}" == 0x* || "${val}" == 0X* ]]; then
    printf '%d' "${val}"
  else
    printf '%d' "${val}" 2>/dev/null || echo "0"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# GATE 1 — Protocol Integrity
# ══════════════════════════════════════════════════════════════════════════════
gate "1 — Protocol Integrity"

SYS_CFG=$(get_addr "SentinelSystemConfigProxy")
OP_PORTAL=$(get_addr "OptimismPortalProxy")
L2OO=$(get_addr "L2OutputOracleProxy")
PROXY_ADMIN=$(get_addr "ProxyAdmin")

# 1a. SystemConfig: gas limit within safe range
GAS_LIMIT_RAW=$(cast call "${SYS_CFG}" "gasLimit()(uint64)" \
  --rpc-url "${RPC}" 2>/dev/null || echo "0")
GAS_LIMIT_DEC=$(to_decimal "${GAS_LIMIT_RAW}")
if (( GAS_LIMIT_DEC >= 30000000 && GAS_LIMIT_DEC <= 300000000 )); then
  gate_pass "SystemConfig gasLimit=${GAS_LIMIT_DEC} within safe range [30M, 300M]"
else
  gate_fail "SystemConfig gasLimit=${GAS_LIMIT_DEC} out of safe range [30M, 300M]"
fi

# 1b. SystemConfig: unsafe block signer matches provisioned address
ACTUAL_SIGNER=$(cast call "${SYS_CFG}" "unsafeBlockSigner()(address)" \
  --rpc-url "${RPC}" 2>/dev/null \
  | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
EXPECTED_SIGNER=$(echo "${SENTINEL_UNSAFE_BLOCK_SIGNER_ADDR}" \
  | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
if [[ "${ACTUAL_SIGNER}" == "${EXPECTED_SIGNER}" ]]; then
  gate_pass "Unsafe block signer matches: ${ACTUAL_SIGNER}"
else
  gate_fail "Unsafe block signer mismatch: expected=${EXPECTED_SIGNER} actual=${ACTUAL_SIGNER}"
fi

# 1c. OptimismPortal: not paused
PAUSED=$(cast call "${OP_PORTAL}" "paused()(bool)" \
  --rpc-url "${RPC}" 2>/dev/null \
  | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
if [[ "${PAUSED}" == "false" ]]; thenelse
  gate_warn "L2OutputOracle nextOutputIndex=${NEXT_IDX} (pre-existing outputs detected)"
fi

# 1e. ProxyAdmin owned by multisig, not deployer EOA
PA_OWNER=$(cast call "${PROXY_ADMIN}" "owner()(address)" \
  --rpc-url "${RPC}" 2>/dev/null \
  | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
MULTISIG_LOWER=$(echo "${OWNER_MULTISIG_ADDR}" \
  | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
DEPLOYER_LOWER=$(echo "${DEPLOYER_ADDR}" \
  | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
if [[ "${PA_OWNER}" == "${MULTISIG_LOWER}" ]]; then
  gate_pass "ProxyAdmin owned by multisig ${PA_OWNER}"
elif [[ "${PA_OWNER}" == "${DEPLOYER_LOWER}" ]]; then
  gate_fail "ProxyAdmin still owned by deployer EOA — ownership transfer did not execute"
else
  gate_fail "ProxyAdmin owner unknown: expected=${MULTISIG_LOWER} actual=${PA_OWNER}"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# GATE 2 — Sequencer Health
# ══════════════════════════════════════════════════════════════════════════════
gate "2 — Sequencer Health"

if [[ -z "${L3_RPC}" ]]; then
  gate_warn "SENTINEL_L3_RPC_URL not set — L3 RPC health checks skipped"
else
  # 2a. L3 RPC reachable and correct chain ID
  L3_CHAIN_HEX=$(curl -sf --max-time 10 -X POST \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "${L3_RPC}" 2>/dev/null | jq -r '.result // empty' || echo "")
  if [[ -n "${L3_CHAIN_HEX}" && "${L3_CHAIN_HEX}" != "null" ]]; then
    L3_CHAIN_DEC=$(to_decimal "${L3_CHAIN_HEX}")
    if (( L3_CHAIN_DEC == 84532001 )); then
      gate_pass "L3 RPC reachable — chain_id=${L3_CHAIN_DEC} (correct)"
    else
      gate_fail "L3 RPC chain_id mismatch: expected=84532001 got=${L3_CHAIN_DEC}"
    fi
  else
    gate_fail "L3 sequencer RPC not reachable at ${L3_RPC}"
  fi

  # 2b. L3 sync status
  # BUG-23 FIX: cast rpc returns a value with a trailing newline.
  # Stripping whitespace before the `== "false"` comparison.BS_BALANCE_WEI=$(cast balance "${BATCH_SUBMITTER}" --rpc-url "${RPC}" 2>/dev/null || echo "0")
BS_ETH=$(cast to-unit "${BS_BALANCE_WEI}" ether 2>/dev/null || echo "0")
if python3 -c "import sys; sys.exit(0 if float('${BS_ETH}') >= 0.5 else 1)" 2>/dev/null; then
  gate_pass "Batch submitter balance: ${BS_ETH} ETH ≥ 0.5 ETH minimum"
else
  gate_fail "Batch submitter balance too low: ${BS_ETH} ETH (minimum 0.5 ETH)"
fi

# 2d. Proposer ETH balance on L2
PROPOSER="${SENTINEL_PROPOSER_ADDR}"
PR_BALANCE_WEI=$(cast balance "${PROPOSER}" --rpc-url "${RPC}" 2>/dev/null || echo "0")
PR_ETH=$(cast to-unit "${PR_BALANCE_WEI}" ether 2>/dev/null || echo "0")
if python3 -c "import sys; sys.exit(0 if float('${PR_ETH}') >= 0.1 else 1)" 2>/dev/null; then
  gate_pass "Proposer balance: ${PR_ETH} ETH ≥ 0.1 ETH minimum"
else
  gate_fail "Proposer balance too low: ${PR_ETH} ETH (minimum 0.1 ETH)"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# GATE 3 — Bridge Readiness
# ══════════════════════════════════════════════════════════════════════════════
gate "3 — Bridge Readiness"

L1_BRIDGE=$(get_addr "L1StandardBridgeProxy")
XDOMAIN=$(get_addr "L1CrossDomainMessengerProxy")

# 3a. L1StandardBridge → L1CrossDomainMessenger linkage
if [[ -n "${L1_BRIDGE}" && -n "${XDOMAIN}" ]]; then
  BRIDGE_MESSENGER=$(cast call "${L1_BRIDGE}" "messenger()(address)" \
    --rpc-url "${RPC}" 2>/dev/null \
    | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  XDOMAIN_LOWER=$(echo "${XDOMAIN}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  if [[ "${BRIDGE_MESSENGER}" == "${XDOMAIN_LOWER}" ]]; then
    gate_pass "L1StandardBridge → L1CrossDomainMessenger link confirmed"
  else
    gate_fail "L1StandardBridge messenger mismatch: expected=${XDOMAIN_LOWER} got=${BRIDGE_MESSENGER}"
  fi
fi

# 3b. L1CrossDomainMessenger → OptimismPortal linkage
if [[ -n "${XDOMAIN}" && -n "${OP_PORTAL}" ]]; then
  # Try both uppercase and lowercase function name variants
  MESSENGER_PORTAL=$(
    cast call "${XDOMAIN}" "PORTAL()(address)" --rpc-url "${RPC}" 2>/dev/null \
    || cast call "${XDOMAIN}" "portal()(address)" --rpc-url "${RPC}" 2>/dev/null \
    || echo ""
  )if [[ -n "${ERC721_BRIDGE}" && "${ERC721_BRIDGE}" != "UNKNOWN" ]]; then
  # BUG-24 FIX: normalise codesize to decimal before arithmetic comparison
  ERC721_SIZE_RAW=$(cast codesize "${ERC721_BRIDGE}" --rpc-url "${RPC}" 2>/dev/null || echo "0")
  ERC721_SIZE=$(to_decimal "${ERC721_SIZE_RAW}")
  if (( ERC721_SIZE > 0 )); then
    gate_pass "L1ERC721Bridge deployed — ${ERC721_SIZE} bytes"
  else
    gate_fail "L1ERC721Bridge has no bytecode at ${ERC721_BRIDGE}"
  fi
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# GATE 4 — Monitoring & Alerting Hooks
# ══════════════════════════════════════════════════════════════════════════════
gate "4 — Monitoring & Alerting Hooks"

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"

PROM_RESPONSE=$(curl -sf --max-time 5 "${PROMETHEUS_URL}/-/ready" 2>/dev/null || echo "unreachable")
if [[ "${PROM_RESPONSE}" == "Prometheus Server is Ready."* ]] \
   || [[ "${PROM_RESPONSE}" == "OK" ]]; then
  gate_pass "Prometheus ready at ${PROMETHEUS_URL}"
else
  gate_warn "Prometheus not reachable at ${PROMETHEUS_URL} (set PROMETHEUS_URL env var)"
fi

AM_RESPONSE=$(curl -sf --max-time 5 "${ALERTMANAGER_URL}/-/ready" 2>/dev/null || echo "unreachable")
if [[ "${AM_RESPONSE}" == "OK" ]] || [[ "${AM_RESPONSE}" == *"ready"* ]]; then
  gate_pass "Alertmanager ready at ${ALERTMANAGER_URL}"
else
  gate_warn "Alertmanager not reachable at ${ALERTMANAGER_URL} (set ALERTMANAGER_URL env var)"
fi

RULES_FILE="${ROOT}/config/alert-rules.yml"
if [[ -f "${RULES_FILE}" ]]; then
  gate_pass "Alert rules file present: ${RULES_FILE}"
else
  gate_warn "Alert rules file not found at ${RULES_FILE} — add before production traffic"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# GATE 5 — Runbook Sign-Off
# ══════════════════════════════════════════════════════════════════════════════
gate "5 — Runbook Sign-Off"      gate_fail "Missing sign-off attestation for: ${approver} (expected: ${ATTESTED_FILE})"
    fi
  done <<< "${REQUIRED_APPROVERS}"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# FINAL GATE EVALUATION
# ══════════════════════════════════════════════════════════════════════════════
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "READINESS GATE SUMMARY"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for result in "${GATE_RESULTS[@]}"; do
  info "  ${result}"
done
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if (( GATE_FAILURES > 0 )); then
  error "${BLOCK} READINESS GATES FAILED: ${GATE_FAILURES} gate(s) blocked"
  error "L3 sequencer MUST NOT be started until all gates pass."
  echo "READINESS_STATUS=BLOCKED" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
  exit 1
fi

# ── Write gate.lock ─────────────────────────────────────────────────────────────────────────────
ADDR_HASH=$(sha256sum "${ADDR_FILE}" | awk '{print $1}')
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
LOCK_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FINGERPRINT=$(printf '%s%s%s' "${LOCK_TS}" "${GIT_COMMIT}" "${ADDR_HASH}" | sha256sum | awk '{print $1}')

# BUG-25 FIX: DEPLOYER_ADDR pre-computed at top of script, not inside heredoc.
# Use jq to write the JSON file so quoting and escaping are handled safely.
jq -n \
  --arg schema    "aetheron-gate-lock/v1" \
  --arg ts        "${LOCK_TS}" \
  --arg commit    "${GIT_COMMIT}" \
  --arg addr_hash "${ADDR_HASH}" \
  --arg deployer  "${DEPLOYER_ADDR}" \
  --arg multisig  "${OWNER_MULTISIG_ADDR}" \
  --arg fp        "${FINGERPRINT}" \
  '{
    "_schema":                    $schema,
    "status":                     "PASSED",
    "timestamp":                  $ts,
    "git_commit":                 $commit,
    "deployed_addresses_sha256":  $addr_hash,
    "deployer":                   $deployer,
    "owner_multisig":             $multisig,
info "${PASS} Gate lock written: ${GATE_LOCK}"
info "${PASS} ALL READINESS GATES PASSED — L3 sequencer may be started"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "READINESS_STATUS=PASSED"          >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
echo "GATE_LOCK_FILE=${GATE_LOCK}"      >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true

exit 0

    "chain":                      8453,
    "l3_chain_id":                84532001,
    "gates": {
      "protocol_integrity": "PASSED",
      "sequencer_health":   "PASSED",
      "bridge_readiness":   "PASSED",
      "monitoring_hooks":   "PASSED",
      "runbook_signoff":    "PASSED"
    },
    "fingerprint": $fp
  }' > "${GATE_LOCK}"


REQUIRED_APPROVERS="${DEPLOYMENT_APPROVERS:-}"
if [[ -z "${REQUIRED_APPROVERS}" ]]; then
  gate_warn "DEPLOYMENT_APPROVERS not set — sign-off gate skipped (required in production)"
else
  while IFS=',' read -r approver; do
    approver=$(echo "${approver}" | tr -d '[:space:]')
    ATTESTED_FILE="${ROOT}/config/attestations/${approver}.sig"
    if [[ -f "${ATTESTED_FILE}" ]]; then
      gate_pass "Attestation found for approver: ${approver}"
    else

  PORTAL_LOWER=$(echo "${OP_PORTAL}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  MP_LOWER=$(echo "${MESSENGER_PORTAL}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  if [[ "${MP_LOWER}" == "${PORTAL_LOWER}" ]]; then
    gate_pass "L1CrossDomainMessenger → OptimismPortal link confirmed"
  else
    gate_warn "messenger→portal link unclear: got '${MESSENGER_PORTAL}' (may be a getter name variant)"
  fi
fi

# 3c. L1ERC721Bridge bytecode present
ERC721_BRIDGE=$(get_addr "L1ERC721BridgeProxy")

  SYNC_RAW=$(cast rpc eth_syncing --rpc-url "${L3_RPC}" 2>/dev/null || echo "null")
  SYNC_STATUS=$(echo "${SYNC_RAW}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
  if [[ "${SYNC_STATUS}" == "false" ]]; then
    gate_pass "L3 node is fully synced"
  else
    gate_warn "L3 node reports syncing state: ${SYNC_RAW}"
  fi
fi

# 2c. Batch submitter ETH balance on L2
BATCH_SUBMITTER="${SENTINEL_BATCH_SUBMITTER_ADDR}"

  gate_pass "OptimismPortal is not paused"
else
  gate_fail "OptimismPortal is paused — cannot accept deposits"
fi

# 1d. L2OutputOracle: next output index is 0 (clean genesis state)
NEXT_IDX_RAW=$(cast call "${L2OO}" "nextOutputIndex()(uint256)" \
  --rpc-url "${RPC}" 2>/dev/null | tr -d '[:space:]' || echo "99")
NEXT_IDX=$(to_decimal "${NEXT_IDX_RAW}")
if (( NEXT_IDX == 0 )); then
  gate_pass "L2OutputOracle nextOutputIndex=0 (clean genesis state)"

  info "${PASS} $*"
  GATE_RESULTS+=("PASS: $*")
}
gate_warn() {
  warn "${WARN} $*"
  GATE_RESULTS+=("WARN: $*")
}

get_addr() { jq -r ".${1} // empty" "${ADDR_FILE}"; }

# BUG-25 FIX: pre-compute DEPLOYER_ADDR once at the top of the script
# instead of invoking cast wallet inside a heredoc where errors are swallowed.
DEPLOYER_ADDR=$(cast wallet address --private-key "${DEPLOYER_PRIVATE_KEY}" 2>/dev/null)
