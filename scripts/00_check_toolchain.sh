#!/usr/bin/env bash
# =============================================================================
# Aetheron Sentinel L3 — Step 00: Toolchain Unification & Environment Lock
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_FILE="${SCRIPT_DIR}/../config/environment.lock.json"
LOCK_FILE="$(cd "$(dirname "${LOCK_FILE}")" && pwd)/$(basename "${LOCK_FILE}")"

LOG_PREFIX="[TOOLCHAIN]"
PASS="✅"
FAIL="❌"
WARN="⚠️ "

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}${LOG_PREFIX}${NC} $*"; }
warn()  { echo -e "${YELLOW}${LOG_PREFIX} WARN${NC} $*"; }
error() { echo -e "${RED}${LOG_PREFIX} ERROR${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

ERROR_FILE="$(mktemp)"
trap 'rm -f "${ERROR_FILE}"' EXIT

bump_error() { echo "1" >> "${ERROR_FILE}"; }
error_count() { wc -l < "${ERROR_FILE}" | tr -d ' '; }

semver_gte() {
  printf '%s\n%s' "$2" "$1" | sort -C -V
}

info "Checking required CLI tools…"
for cmd in node npm forge cast anvil jq curl git python3; do
  if ! command -v "$cmd" &>/dev/null; then
    error "${FAIL} Missing required tool: $cmd"
    bump_error
  else
    info "${PASS} Found: $cmd ($(command -v "$cmd"))"
  fi
done

REQUIRED_NODE=$(jq -r '.toolchain.node.version' "${LOCK_FILE}")
ACTUAL_NODE=$(node --version | sed 's/v//')
info "Node: required=${REQUIRED_NODE} actual=${ACTUAL_NODE}"
if ! semver_gte "$ACTUAL_NODE" "$REQUIRED_NODE"; then
  error "${FAIL} Node version ${ACTUAL_NODE} < required ${REQUIRED_NODE}"
  bump_error
else
  info "${PASS} Node version OK"
fi

REQUIRED_NPM=$(jq -r '.toolchain.npm.version' "${LOCK_FILE}")
ACTUAL_NPM=$(npm --version)
info "npm: required=${REQUIRED_NPM} actual=${ACTUAL_NPM}"
if ! semver_gte "$ACTUAL_NPM" "$REQUIRED_NPM"; then
  error "${FAIL} npm version ${ACTUAL_NPM} < required ${REQUIRED_NPM}"
  bump_error
else
  info "${PASS} npm version OK"
fi

REQUIRED_FORGE=$(jq -r '.toolchain.foundry.forge.version' "${LOCK_FILE}")
ACTUAL_FORGE=$(forge --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
info "Forge: required=${REQUIRED_FORGE} actual=${ACTUAL_FORGE}"
if ! semver_gte "$ACTUAL_FORGE" "$REQUIRED_FORGE"; then
  error "${FAIL} Forge version ${ACTUAL_FORGE} < required ${REQUIRED_FORGE}"
  bump_error
else
  info "${PASS} Forge version OK"
fi

REQUIRED_SOLC=$(jq -r '.toolchain.solc.version' "${LOCK_FILE}")
ACTUAL_SOLC=$(forge config --json 2>/dev/null | jq -r '.solc_version // empty' || echo "")
if [[ -z "$ACTUAL_SOLC" ]]; then
  warn "${WARN} Could not determine solc from forge config; checking foundry.toml"
  ACTUAL_SOLC=$(grep -Po '(?<=solc\s*=\s*")[^"]+' foundry.toml 2>/dev/null || echo "unknown")
fi
info "Solc: required=${REQUIRED_SOLC} actual=${ACTUAL_SOLC}"
if [[ "$ACTUAL_SOLC" != "$REQUIRED_SOLC" ]]; then
  error "${FAIL} Solc version mismatch: ${ACTUAL_SOLC} != ${REQUIRED_SOLC}"
  bump_error
else
  info "${PASS} Solc version OK"
fi

info "Checking required environment variables…"
mapfile -t REQUIRED_VARS < <(jq -r '.env_vars_required[]' "${LOCK_FILE}")

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    error "${FAIL} Missing env var: ${var}"
    bump_error
  else
    if [[ "$var" == *"PRIVATE_KEY"* || "$var" == *"API_KEY"* ]]; then
      info "${PASS} ${var}=***masked***"
    else
      info "${PASS} ${var}=${!var}"
    fi
  fi
done

info "Validating Ethereum address format…"
ADDR_VARS=(
  SENTINEL_SEQUENCER_ADDR
  SENTINEL_BATCH_SUBMITTER_ADDR
  SENTINEL_PROPOSER_ADDR
  SENTINEL_CHALLENGER_ADDR
  SENTINEL_UNSAFE_BLOCK_SIGNER_ADDR
  OWNER_MULTISIG_ADDR
)
ETH_ADDR_REGEX='^0x[0-9a-fA-F]{40}$'
for var in "${ADDR_VARS[@]}"; do
  val="${!var:-}"
  if [[ ! "$val" =~ $ETH_ADDR_REGEX ]]; then
    error "${FAIL} ${var} is not a valid Ethereum address: '${val}'"
    bump_error
  else
    info "${PASS} ${var} address format OK"
  fi
done

EXPECTED_CHAIN_ID=$(jq -r '.network.chain_id' "${LOCK_FILE}")
info "Verifying RPC connectivity to Base mainnet (chain ${EXPECTED_CHAIN_ID})…"
CHAIN_ID_HEX=$(curl -sf --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  "${BASE_MAINNET_RPC_URL}" 2>/dev/null | jq -r '.result // empty')

if [[ -z "$CHAIN_ID_HEX" || "$CHAIN_ID_HEX" == "null" ]]; then
  error "${FAIL} RPC endpoint unreachable or returned no result: ${BASE_MAINNET_RPC_URL}"
  bump_error
else
  CHAIN_ID_DEC=$(printf '%d' "$CHAIN_ID_HEX")
  if [[ "$CHAIN_ID_DEC" -ne "$EXPECTED_CHAIN_ID" ]]; then
    error "${FAIL} Wrong chain ID: expected ${EXPECTED_CHAIN_ID}, got ${CHAIN_ID_DEC}. Aborting."
    bump_error
  else
    info "${PASS} RPC chain ID confirmed: ${CHAIN_ID_DEC} (Base mainnet)"
  fi
fi

MAX_DRIFT=$(jq -r '.invariants.block_drift_tolerance_s' "${LOCK_FILE}")
info "Checking block timestamp drift (max ${MAX_DRIFT}s)…"
LATEST_BLOCK_JSON=$(curl -sf --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' \
  "${BASE_MAINNET_RPC_URL}" 2>/dev/null || echo '{}')
LATEST_TS_HEX=$(echo "${LATEST_BLOCK_JSON}" | jq -r '.result.timestamp // empty')

if [[ -n "${LATEST_TS_HEX}" && "${LATEST_TS_HEX}" != "null" ]]; then
  NOW_DEC=$(date +%s)
  BLOCK_TS=$(printf '%d' "${LATEST_TS_HEX}")
  DRIFT=$(( NOW_DEC - BLOCK_TS ))
  if (( DRIFT > MAX_DRIFT )); then
    error "${FAIL} Block timestamp drift ${DRIFT}s exceeds maximum ${MAX_DRIFT}s"
    bump_error
  else
    info "${PASS} Block drift ${DRIFT}s — within tolerance (max ${MAX_DRIFT}s)"
  fi
else
  warn "${WARN} Could not read latest block timestamp; skipping drift check"
fi

MAX_GWEI=$(jq -r '.invariants.max_gas_price_gwei' "${LOCK_FILE}")
info "Checking current gas price (max ${MAX_GWEI} gwei)…"
GAS_PRICE_WEI=$(cast gas-price --rpc-url "${BASE_MAINNET_RPC_URL}" 2>/dev/null || echo "0")
GAS_PRICE_GWEI=$(python3 -c "print(int('${GAS_PRICE_WEI}', 16 if '${GAS_PRICE_WEI}'.startswith('0x') else 10) / 1e9)" 2>/dev/null || echo "0")
info "Current gas price: ${GAS_PRICE_GWEI} gwei"
if python3 -c "import sys; sys.exit(0 if float('${GAS_PRICE_GWEI}') <= float('${MAX_GWEI}') else 1)"; then
  info "${PASS} Gas price ${GAS_PRICE_GWEI} gwei <= max ${MAX_GWEI} gwei"
else
  error "${FAIL} Gas price ${GAS_PRICE_GWEI} gwei exceeds maximum ${MAX_GWEI} gwei — aborting"
  bump_error
fi

MIN_ETH=$(jq -r '.invariants.deployer_min_eth_balance' "${LOCK_FILE}")
info "Checking deployer ETH balance (min ${MIN_ETH} ETH)…"
DEPLOYER_ADDR=$(cast wallet address --private-key "${DEPLOYER_PRIVATE_KEY}" 2>/dev/null)
BALANCE_WEI=$(cast balance "${DEPLOYER_ADDR}" --rpc-url "${BASE_MAINNET_RPC_URL}" 2>/dev/null || echo "0")
BALANCE_ETH=$(cast to-unit "${BALANCE_WEI}" ether 2>/dev/null || echo "0")
info "Deployer: ${DEPLOYER_ADDR}"
info "Balance:  ${BALANCE_ETH} ETH (minimum required: ${MIN_ETH} ETH)"

if python3 -c "
import sys
b = float('${BALANCE_ETH}')
m = float('${MIN_ETH}')
sys.exit(0 if b >= m else 1)
" 2>/dev/null; then
  info "${PASS} Deployer balance ${BALANCE_ETH} ETH >= minimum ${MIN_ETH} ETH"
else
  error "${FAIL} Deployer balance ${BALANCE_ETH} ETH < required ${MIN_ETH} ETH"
  bump_error
fi

REQUIRE_CLEAN=$(jq -r '.invariants.require_clean_git' "${LOCK_FILE}")
if [[ "${REQUIRE_CLEAN}" == "true" ]]; then
  info "Checking git repository state…"
  GIT_DIRTY=$(git status --porcelain 2>/dev/null || echo "")
  if [[ -n "${GIT_DIRTY}" ]]; then
    error "${FAIL} Git working tree is dirty. Commit or stash all changes before deploying."
    bump_error
  else
    info "${PASS} Git working tree clean"
  fi
fi

GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
info "Git branch: ${GIT_BRANCH}"
info "Git commit: ${GIT_COMMIT}"

info "Verifying dependency lockfile integrity…"
if [[ -f "package-lock.json" ]]; then
  if npm ls --depth=0 &>/dev/null; then
    info "${PASS} npm dependency tree consistent"
  else
    error "${FAIL} npm dependency tree inconsistent — run 'npm ci'"
    bump_error
  fi
fi

if [[ -f ".gitmodules" ]]; then
  UNINITIALIZED_MODS=()
  while IFS= read -r status_line; do
    if [[ "${status_line}" == -* ]]; then
      module=$(echo "${status_line}" | awk '{print $2}')
      UNINITIALIZED_MODS+=("${module}")
    fi
  done < <(git submodule status 2>/dev/null)

  if (( ${#UNINITIALIZED_MODS[@]} > 0 )); then
    for mod in "${UNINITIALIZED_MODS[@]}"; do
      error "${FAIL} Submodule not initialized: ${mod}"
      bump_error
    done
  else
    info "${PASS} All git submodules initialized"
  fi
fi

echo ""
TOTAL_ERRORS=$(error_count)
if (( TOTAL_ERRORS > 0 )); then
  die "Toolchain check FAILED with ${TOTAL_ERRORS} error(s). Fix all issues before proceeding."
fi

info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "${PASS} ALL TOOLCHAIN CHECKS PASSED"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LOCK_HASH=$(sha256sum "${LOCK_FILE}" | awk '{print $1}')
info "Environment lock hash: ${LOCK_HASH}"
echo "TOOLCHAIN_LOCK_HASH=${LOCK_HASH}" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
echo "DEPLOYER_ADDR=${DEPLOYER_ADDR}"   >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
echo "TOOLCHAIN_LOCK_HASH=${LOCK_HASH}" >> "${GITHUB_ENV:-/dev/null}"    2>/dev/null || true

exit 0
