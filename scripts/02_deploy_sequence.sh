#!/usr/bin/env bash
# =============================================================================
# Aetheron Sentinel L3 — Step 02: Contract Deployment Sequencer
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCK_FILE="${ROOT}/config/environment.lock.json"
ARTIFACTS_DIR="${ROOT}/artifacts"
ADDR_FILE="${ARTIFACTS_DIR}/deployed-addresses.json"
RECEIPT_DIR="${ARTIFACTS_DIR}/receipts"
mkdir -p "${ARTIFACTS_DIR}" "${RECEIPT_DIR}"

LOG_PREFIX="[DEPLOY]"
PASS="✅"; FAIL="❌"; ARROW="→"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}${LOG_PREFIX}${NC} $*"; }
stage() { echo -e "${CYAN}${LOG_PREFIX} STAGE${NC} $*"; }
warn()  { echo -e "${YELLOW}${LOG_PREFIX} WARN${NC} $*"; }
error() { echo -e "${RED}${LOG_PREFIX} ERROR${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

DEPLOYER_ADDR=$(cast wallet address --private-key "${DEPLOYER_PRIVATE_KEY}" 2>/dev/null)
DEPLOY_TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
RPC="${BASE_MAINNET_RPC_URL}"
MAX_GWEI=$(jq -r '.invariants.max_gas_price_gwei' "${LOCK_FILE}")

jq -n \
  --arg deployer    "${DEPLOYER_ADDR}" \
  --arg timestamp   "${DEPLOY_TIMESTAMP}" \
  --arg salt        "${DEPLOYMENT_SALT}" \
  --argjson chain   8453 \
  '{"_meta": {"deployer":$deployer,"timestamp":$timestamp,"salt":$salt,"chain":$chain}}' \
  > "${ADDR_FILE}"

info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Aetheron Sentinel L3 — Live Deployment Sequencer"
info "Deployer  : ${DEPLOYER_ADDR}"
info "Timestamp : ${DEPLOY_TIMESTAMP}"
info "Salt      : ${DEPLOYMENT_SALT}"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

assert_gas_price_ok() {
  local GAS_WEI
  GAS_WEI=$(cast gas-price --rpc-url "${RPC}" 2>/dev/null || echo "0")
  local GAS_GWEI
  GAS_GWEI=$(python3 -c "
v = '${GAS_WEI}'
n = int(v, 16) if v.startswith('0x') else int(v)
print(n / 1e9)
" 2>/dev/null || echo "0")
  info "Current gas price: ${GAS_GWEI} gwei (max: ${MAX_GWEI} gwei)"
  if python3 -c "import sys; sys.exit(0 if float('${GAS_GWEI}') <= float('${MAX_GWEI}') else 1)"; then
    info "${PASS} Gas price within limit"
  else
    die "${FAIL} Gas price ${GAS_GWEI} gwei exceeds max ${MAX_GWEI} gwei — aborting"
  fi
}

wait_confirmations() {
  local tx_hash="$1"
  local required="${2:-3}"
  info "  Waiting for ${required} confirmations on ${tx_hash}…"
  local start_block end_block
  start_block=$(cast tx "${tx_hash}" --rpc-url "${RPC}" | grep -oP '(?<=blockNumber\s{20})\d+' || echo "0")
  local attempts=0
  while true; do
    end_block=$(cast block-number --rpc-url "${RPC}" 2>/dev/null || echo "${start_block}")
    local delta=$(( end_block - start_block ))
    if (( delta >= required )); then
      info "  ${PASS} ${delta} confirmations received"
      break
    fi
    attempts=$(( attempts + 1 ))
    if (( attempts > 300 )); then
      warn "Confirmation wait timed out — continuing"
      break
    fi
    sleep 2
  done
}

run_script() {
  local stage_num="$1" script_file="$2" contract_name="$3" address_key="$4" depends_on="${5:-}"

  stage "[${stage_num}] ${contract_name}"

  if [[ -n "${depends_on}" ]]; then
    local dep
    while IFS=',' read -r dep; do
      dep=$(echo "${dep}" | tr -d ' ')
      local dep_addr
      dep_addr=$(jq -r ".${dep} // empty" "${ADDR_FILE}")
      if [[ -z "${dep_addr}" ]]; then
        die "${FAIL} Stage ${stage_num} depends on '${dep}' which has not been deployed yet"
      fi
      info "  Dependency ${dep} = ${dep_addr} ${PASS}"
    done <<< "${depends_on}"
  fi

  assert_gas_price_ok

  local receipt_stdout="${RECEIPT_DIR}/${stage_num}_${contract_name}.stdout.log"

  info "  ${ARROW} Broadcasting ${script_file}…"
  set +e
  forge script "${script_file}:${contract_name}" \
    --rpc-url "${RPC}" \
    --private-key "${DEPLOYER_PRIVATE_KEY}" \
    --broadcast \
    --verify \
    --etherscan-api-key "${BASESCAN_API_KEY}" \
    --slow \
    --sig "run()" \
    2>&1 | tee "${receipt_stdout}"
  local exit_code=$?
  set -e

  if (( exit_code != 0 )); then
    die "${FAIL} Stage ${stage_num} FAILED (exit ${exit_code}). See ${receipt_stdout}"
  fi

  local script_basename
  script_basename=$(basename "${script_file}" .s.sol)
  local broadcast_json="${ROOT}/broadcast/${script_basename}.s.sol/8453/run-latest.json"

  if [[ -f "${broadcast_json}" ]]; then
    cp "${broadcast_json}" "${RECEIPT_DIR}/${stage_num}_${contract_name}.json"
  fi

  local deployed_addr=""
  if [[ -f "${broadcast_json}" ]]; then
    deployed_addr=$(jq -r '
      .transactions[]
      | select(.transactionType == "CREATE" or .transactionType == "CREATE2")
      | .contractAddress
    ' "${broadcast_json}" 2>/dev/null | grep -v 'null' | head -1 || echo "")
  fi

  if [[ -z "${deployed_addr}" ]]; then
    deployed_addr=$(grep -oP '(?<=Deployed to: )0x[0-9a-fA-F]{40}' "${receipt_stdout}" 2>/dev/null | head -1 || echo "")
  fi

  if [[ -z "${deployed_addr}" ]]; then
    warn "Could not auto-extract address for ${contract_name}"
    deployed_addr="UNKNOWN"
  fi

  local tmp
  tmp=$(mktemp)
  jq --arg key "${address_key}" --arg val "${deployed_addr}" \
    '. + {($key): $val}' "${ADDR_FILE}" > "${tmp}" && mv "${tmp}" "${ADDR_FILE}"

  info "  ${PASS} ${contract_name} deployed ${ARROW} ${deployed_addr}"

  if [[ "${deployed_addr}" != "UNKNOWN" ]]; then
    local code_size
    code_size=$(cast codesize "${deployed_addr}" --rpc-url "${RPC}" 2>/dev/null || echo "0")
    if [[ "${code_size}" == "0" || "${code_size}" == "0x0" ]]; then
      die "${FAIL} No bytecode at ${deployed_addr} after deployment"
    fi
    info "  Bytecode: ${code_size} bytes on-chain ${PASS}"

    local deploy_tx_hash=""
    if [[ -f "${broadcast_json}" ]]; then
      deploy_tx_hash=$(jq -r '
        .transactions[]
        | select(.transactionType == "CREATE" or .transactionType == "CREATE2")
        | .hash
      ' "${broadcast_json}" 2>/dev/null | grep -v 'null' | head -1 || echo "")
    fi
    if [[ -n "${deploy_tx_hash}" && "${deploy_tx_hash}" != "null" ]]; then
      wait_confirmations "${deploy_tx_hash}" 3
    fi
  fi
}

# ══════════════════════════════════════════════════
# DEPLOYMENT SEQUENCE
# ══════════════════════════════════════════════════

run_script "01" "script/deploy/01_DeployAddressManager.s.sol" "DeployAddressManager" "AddressManager"
run_script "02" "script/deploy/02_DeployProxyAdmin.s.sol" "DeployProxyAdmin" "ProxyAdmin" "AddressManager"
run_script "03" "script/deploy/03_DeployL1CrossDomainMessenger.s.sol" "DeployL1CrossDomainMessenger" "L1CrossDomainMessengerProxy" "AddressManager,ProxyAdmin"
run_script "04" "script/deploy/04_DeployOptimismPortal.s.sol" "DeployOptimismPortal" "OptimismPortalProxy" "ProxyAdmin"
run_script "05" "script/deploy/05_DeployL2OutputOracle.s.sol" "DeployL2OutputOracle" "L2OutputOracleProxy" "ProxyAdmin"
run_script "06" "script/deploy/06_DeployL1StandardBridge.s.sol" "DeployL1StandardBridge" "L1StandardBridgeProxy" "ProxyAdmin,L1CrossDomainMessengerProxy"
run_script "07" "script/deploy/07_DeployL1ERC721Bridge.s.sol" "DeployL1ERC721Bridge" "L1ERC721BridgeProxy" "ProxyAdmin,L1CrossDomainMessengerProxy"
run_script "08" "script/deploy/08_DeployOptimismMintableERC20Factory.s.sol" "DeployOptimismMintableERC20Factory" "OptimismMintableERC20FactoryProxy" "ProxyAdmin,L1StandardBridgeProxy"
run_script "09" "script/deploy/09_DeploySentinelSystemConfig.s.sol" "DeploySentinelSystemConfig" "SentinelSystemConfigProxy" "ProxyAdmin"
run_script "10" "script/deploy/10_DeploySentinelDisputeGame.s.sol" "DeploySentinelDisputeGame" "DisputeGameFactory" "ProxyAdmin,OptimismPortalProxy"
run_script "11" "script/deploy/11_TransferOwnership.s.sol" "TransferOwnership" "OwnershipTransferred" "ProxyAdmin,AddressManager,SentinelSystemConfigProxy"

local_tmp=$(mktemp)
jq --arg ts "${DEPLOY_TIMESTAMP}" '. + {_finalized: $ts}' "${ADDR_FILE}" > "${local_tmp}" \
  && mv "${local_tmp}" "${ADDR_FILE}"

info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "${PASS} ALL 11 DEPLOYMENT STAGES COMPLETE"
info "Address registry: ${ADDR_FILE}"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "DEPLOY_STATUS=COMPLETE" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
echo "DEPLOYED_ADDRESSES_FILE=${ADDR_FILE}" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true

exit 0
