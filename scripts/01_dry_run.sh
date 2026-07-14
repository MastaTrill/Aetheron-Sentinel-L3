#!/usr/bin/env bash
# =============================================================================
# Aetheron Sentinel L3 — Step 01: Dry-Run Validation
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TRACES_DIR="${ROOT}/artifacts/dry-run-traces"
REPORTS_DIR="${ROOT}/artifacts/reports"
mkdir -p "${TRACES_DIR}" "${REPORTS_DIR}"

LOG_PREFIX="[DRY-RUN]"
PASS="✅"; FAIL="❌"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}${LOG_PREFIX}${NC} $*"; }
warn()  { echo -e "${YELLOW}${LOG_PREFIX} WARN${NC} $*"; }
error() { echo -e "${RED}${LOG_PREFIX} ERROR${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

RAW_FORK_BLOCK="${FORK_BLOCK:-latest}"
if [[ "${RAW_FORK_BLOCK}" == "latest" ]]; then
  info "Resolving 'latest' fork block to a concrete block number…"
  BLOCK_HEX=$(curl -sf --max-time 10 -X POST \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    "${BASE_MAINNET_RPC_URL}" 2>/dev/null | jq -r '.result // empty')
  if [[ -z "${BLOCK_HEX}" || "${BLOCK_HEX}" == "null" ]]; then
    die "${FAIL} Could not resolve latest block number from RPC"
  fi
  FORK_BLOCK_NUM=$(printf '%d' "${BLOCK_HEX}")
  info "Resolved latest block: ${FORK_BLOCK_NUM}"
else
  FORK_BLOCK_NUM="${RAW_FORK_BLOCK}"
fi

DEPLOYER_ADDR=$(cast wallet address --private-key "${DEPLOYER_PRIVATE_KEY}" 2>/dev/null)
DRY_RUN_TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Aetheron Sentinel L3 — Dry-Run Simulation"
info "Fork block  : ${FORK_BLOCK_NUM}"
info "Deployer    : ${DEPLOYER_ADDR}"
info "Timestamp   : ${DRY_RUN_TIMESTAMP}"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Compiling contracts…"
forge build --force --sizes 2>&1 | tee "${REPORTS_DIR}/compile.log"

if grep -qP '^Error:|^\s+error\[' "${REPORTS_DIR}/compile.log"; then
  die "${FAIL} Compilation errors detected. See ${REPORTS_DIR}/compile.log"
fi
info "${PASS} Compilation succeeded"

info "Running full test suite against fork block ${FORK_BLOCK_NUM}…"
forge test \
  --fork-url "${BASE_MAINNET_RPC_URL}" \
  --fork-block-number "${FORK_BLOCK_NUM}" \
  --fuzz-runs 1000 \
  --invariant-runs 500 \
  --invariant-depth 100 \
  -vvv \
  2>&1 | tee "${REPORTS_DIR}/test-results.log"

if grep -qP '^\[FAIL\]|\(FAILED\)\s*$|^Failures:' "${REPORTS_DIR}/test-results.log"; then
  die "${FAIL} Test suite failures detected. See ${REPORTS_DIR}/test-results.log"
fi
info "${PASS} All tests passed"

info "Enforcing EIP-170 contract size limits…"
SIZE_VIOLATIONS=0
while IFS= read -r line; do
  if [[ "$line" =~ \|[[:space:]]*([A-Za-z][A-Za-z0-9_]*)[[:space:]]*\|[[:space:]]*([0-9]+)[[:space:]]*\|[[:space:]]*([0-9]+)[[:space:]]*\| ]]; then
    contract="${BASH_REMATCH[1]}"
    size="${BASH_REMATCH[2]}"
    if (( size > 24576 )); then
      error "${FAIL} ${contract}: ${size} bytes exceeds EIP-170 limit of 24576"
      SIZE_VIOLATIONS=$(( SIZE_VIOLATIONS + 1 ))
    else
      info "${PASS} ${contract}: ${size} bytes"
    fi
  fi
done < "${REPORTS_DIR}/compile.log"

if (( SIZE_VIOLATIONS > 0 )); then
  die "${FAIL} ${SIZE_VIOLATIONS} contract(s) exceed EIP-170 size limit"
fi

DEPLOY_SCRIPTS=(
  "script/deploy/01_DeployAddressManager.s.sol:DeployAddressManager"
  "script/deploy/02_DeployProxyAdmin.s.sol:DeployProxyAdmin"
  "script/deploy/03_DeployL1CrossDomainMessenger.s.sol:DeployL1CrossDomainMessenger"
  "script/deploy/04_DeployOptimismPortal.s.sol:DeployOptimismPortal"
  "script/deploy/05_DeployL2OutputOracle.s.sol:DeployL2OutputOracle"
  "script/deploy/06_DeployL1StandardBridge.s.sol:DeployL1StandardBridge"
  "script/deploy/07_DeployL1ERC721Bridge.s.sol:DeployL1ERC721Bridge"
  "script/deploy/08_DeployOptimismMintableERC20Factory.s.sol:DeployOptimismMintableERC20Factory"
  "script/deploy/09_DeploySentinelSystemConfig.s.sol:DeploySentinelSystemConfig"
  "script/deploy/10_DeploySentinelDisputeGame.s.sol:DeploySentinelDisputeGame"
  "script/deploy/11_TransferOwnership.s.sol:TransferOwnership"
)

SIMULATION_FAILURES=0
for script_target in "${DEPLOY_SCRIPTS[@]}"; do
  SCRIPT_FILE="${script_target%%:*}"
  SCRIPT_CONTRACT="${script_target##*:}"
  TRACE_FILE="${TRACES_DIR}/${SCRIPT_CONTRACT}.trace.json"
  info "Simulating: ${SCRIPT_CONTRACT}…"
  set +e
  forge script "${SCRIPT_FILE}:${SCRIPT_CONTRACT}" \
    --rpc-url "${BASE_MAINNET_RPC_URL}" \
    --fork-block-number "${FORK_BLOCK_NUM}" \
    --sender "${DEPLOYER_ADDR}" \
    --private-key "${DEPLOYER_PRIVATE_KEY}" \
    --sig "run()" \
    --slow \
    2>&1 | tee "${TRACE_FILE}"
  EXIT_CODE=$?
  set -e
  if (( EXIT_CODE != 0 )); then
    error "${FAIL} Simulation failed: ${SCRIPT_CONTRACT} (exit ${EXIT_CODE})"
    SIMULATION_FAILURES=$(( SIMULATION_FAILURES + 1 ))
  else
    BROADCAST_JSON="broadcast/${SCRIPT_FILE##*/}/${SCRIPT_CONTRACT}/8453/run-latest.json"
    if [[ -f "${BROADCAST_JSON}" ]]; then
      GAS_USED=$(jq -r '[.transactions[].gas // 0] | add // 0' "${BROADCAST_JSON}" 2>/dev/null || echo "N/A")
    else
      GAS_USED="N/A (simulation only)"
    fi
    info "${PASS} ${SCRIPT_CONTRACT} simulated OK — estimated gas: ${GAS_USED}"
  fi
done

if (( SIMULATION_FAILURES > 0 )); then
  die "${FAIL} ${SIMULATION_FAILURES} simulation(s) failed. Aborting pipeline."
fi

info "Generating gas cost estimate report…"
{
  echo "# Aetheron Sentinel L3 — Gas Estimate Report"
  echo "Generated: $(date -u)"
  echo "Fork block: ${FORK_BLOCK_NUM}"
  echo ""
  echo "| Script | Contract | Gas Estimate |"
  echo "|--------|----------|-------------|"
} > "${REPORTS_DIR}/gas-estimate.md"

for script_target in "${DEPLOY_SCRIPTS[@]}"; do
  SCRIPT_CONTRACT="${script_target##*:}"
  SCRIPT_FILE="${script_target%%:*}"
  BROADCAST_JSON="broadcast/${SCRIPT_FILE##*/}/${SCRIPT_CONTRACT}/8453/run-latest.json"
  if [[ -f "${BROADCAST_JSON}" ]]; then
    GAS=$(jq -r '[.transactions[].gas // 0] | add // 0' "${BROADCAST_JSON}" 2>/dev/null || echo "N/A")
  else
    GAS="N/A"
  fi
  echo "| ${SCRIPT_FILE} | ${SCRIPT_CONTRACT} | ${GAS} |" >> "${REPORTS_DIR}/gas-estimate.md"
done
info "${PASS} Gas estimate report written"

forge inspect \
  "src/L1/SentinelSystemConfig.sol:SentinelSystemConfig" \
  storageLayout \
  --json \
  > "${REPORTS_DIR}/storage-layout.json" 2>/dev/null \
  || warn "Storage layout check skipped"

info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "${PASS} DRY-RUN COMPLETE — All ${#DEPLOY_SCRIPTS[@]} scripts validated"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "DRY_RUN_STATUS=PASSED" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
echo "DRY_RUN_FORK_BLOCK=${FORK_BLOCK_NUM}" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true

exit 0
