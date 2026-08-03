#!/usr/bin/env bash
# =============================================================================
# Aetheron Sentinel L3 — Step 03: Post-Deploy Verification
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ADDR_FILE="${ROOT}/artifacts/deployed-addresses.json"
REPORTS_DIR="${ROOT}/artifacts/reports"
mkdir -p "${REPORTS_DIR}"

LOG_PREFIX="[VERIFY]"
PASS="✅"; FAIL="❌"; SKIP="⏭ "
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}${LOG_PREFIX}${NC} $*"; }
check() { echo -e "${CYAN}${LOG_PREFIX} CHECK${NC} $*"; }
warn()  { echo -e "${YELLOW}${LOG_PREFIX} WARN${NC} $*"; }
error() { echo -e "${RED}${LOG_PREFIX} ERROR${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

RPC="${BASE_MAINNET_RPC_URL}"
ERRORS=0
CHECKS_PASSED=0

IMPL_SLOT="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
ADMIN_SLOT="0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"

assert_fail() { error "${FAIL} $*"; ERRORS=$(( ERRORS + 1 )); }
assert_pass() { info  "${PASS} $*"; CHECKS_PASSED=$(( CHECKS_PASSED + 1 )); }

if [[ ! -f "${ADDR_FILE}" ]]; then
  die "Address file not found: ${ADDR_FILE}. Run deploy sequence first."
fi

get_addr() { jq -r ".${1} // empty" "${ADDR_FILE}"; }

REPORT_FILE="${REPORTS_DIR}/post-deploy-verification.json"
echo '{"checks":[],"summary":{"passed":0,"failed":0}}' > "${REPORT_FILE}"

append_result() {
  local name="$1" status="$2" detail="${3:-}"
  local tmp; tmp=$(mktemp)
  jq --arg n "$name" --arg s "$status" --arg d "$detail" \
    '.checks += [{"name":$n,"status":$s,"detail":$d}]' \
    "${REPORT_FILE}" > "${tmp}" && mv "${tmp}" "${REPORT_FILE}"
}

verify_code() {
  local label="$1" addr="$2"
  check "Bytecode: ${label} @ ${addr}"
  local size
  size=$(cast codesize "${addr}" --rpc-url "${RPC}" 2>/dev/null || echo "0")
  if [[ "${size}" == "0" ]]; then
    assert_fail "No bytecode at ${label} (${addr})"
    append_result "${label}_bytecode" "FAIL" "codesize=0"
  else
    assert_pass "${label} has bytecode (${size} bytes)"
    append_result "${label}_bytecode" "PASS" "codesize=${size}"
  fi
}

verify_proxy_impl() {
  local label="$1" proxy_addr="$2"
  local impl_raw impl_addr hex_only
  impl_raw=$(cast storage "${proxy_addr}" "${IMPL_SLOT}" --rpc-url "${RPC}" 2>/dev/null || echo "")
  hex_only=$(echo "${impl_raw}" | tr -d '[:space:]' | sed 's/^0x//')
  impl_addr="0x${hex_only: -40}"
  if [[ "${impl_addr}" == "0x0000000000000000000000000000000000000000" ]] || [[ -z "${hex_only}" ]]; then
    assert_fail "${label} implementation slot is zero"
    append_result "${label}_impl_slot" "FAIL" "impl=${impl_addr}"
  else
    local impl_size
    impl_size=$(cast codesize "${impl_addr}" --rpc-url "${RPC}" 2>/dev/null || echo "0")
    assert_pass "${label} impl ${impl_addr} (${impl_size} bytes)"
    append_result "${label}_impl_slot" "PASS" "impl=${impl_addr}"
  fi
}

verify_call() {
  local label="$1" addr="$2" sig="$3" expected="$4"
  local actual
  actual=$(cast call "${addr}" "${sig}" --rpc-url "${RPC}" 2>/dev/null || echo "CALL_FAILED")
  if [[ "${actual}" == "CALL_FAILED" ]]; then
    assert_fail "${label} call reverted: ${sig}"
    append_result "${label}_call" "FAIL" "sig=${sig}"
    return
  fi
  if [[ -z "${expected}" ]]; then
    assert_pass "${label} no-revert OK"
    append_result "${label}_call" "PASS" "sig=${sig}"
    return
  fi
  local al el
  al=$(echo "${actual}"   | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  el=$(echo "${expected}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  if [[ "${al}" == *"${el}"* ]]; then
    assert_pass "${label} value OK"
    append_result "${label}_call" "PASS" "sig=${sig}"
  else
    assert_fail "${label} expected='${expected}' got='${actual}'"
    append_result "${label}_call" "FAIL" "expected=${expected} actual=${actual}"
  fi
}

info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Aetheron Sentinel L3 — Post-Deploy Verification"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CONTRACTS=(AddressManager ProxyAdmin L1CrossDomainMessengerProxy OptimismPortalProxy L2OutputOracleProxy L1StandardBridgeProxy L1ERC721BridgeProxy OptimismMintableERC20FactoryProxy SentinelSystemConfigProxy DisputeGameFactory)

info "--- SECTION 1: Bytecode ---"
for c in "${CONTRACTS[@]}"; do
  a=$(get_addr "${c}")
  [[ -z "${a}" || "${a}" == "UNKNOWN" ]] && { warn "${SKIP} ${c} not in registry"; continue; }
  verify_code "${c}" "${a}"
done

info "--- SECTION 2: Proxy Impl Slots ---"
for p in L1CrossDomainMessengerProxy OptimismPortalProxy L2OutputOracleProxy L1StandardBridgeProxy L1ERC721BridgeProxy OptimismMintableERC20FactoryProxy SentinelSystemConfigProxy; do
  a=$(get_addr "${p}")
  [[ -z "${a}" || "${a}" == "UNKNOWN" ]] && continue
  verify_proxy_impl "${p}" "${a}"
done

info "--- SECTION 3: ProxyAdmin Ownership ---"
PA=$(get_addr "ProxyAdmin")
[[ -n "${PA}" ]] && verify_call "ProxyAdmin_owner" "${PA}" "owner()(address)" "${OWNER_MULTISIG_ADDR}"

info "--- SECTION 4: SystemConfig ---"
SYS=$(get_addr "SentinelSystemConfigProxy")
if [[ -n "${SYS}" ]]; then
  verify_call "SystemConfig_scalar"    "${SYS}" "scalar()(uint256)"          ""
  verify_call "SystemConfig_gasLimit"  "${SYS}" "gasLimit()(uint64)"         ""
  verify_call "SystemConfig_sequencer" "${SYS}" "unsafeBlockSigner()(address)" "${SENTINEL_UNSAFE_BLOCK_SIGNER_ADDR}"
  verify_call "SystemConfig_owner"     "${SYS}" "owner()(address)"           "${OWNER_MULTISIG_ADDR}"
fi

info "--- SECTION 5: OptimismPortal ---"
OP=$(get_addr "OptimismPortalProxy")
if [[ -n "${OP}" ]]; then
  verify_call "Portal_paused"   "${OP}" "paused()(bool)"      "false"
  verify_call "Portal_guardian" "${OP}" "guardian()(address)" "${OWNER_MULTISIG_ADDR}"
fi

info "--- SECTION 6: L2OutputOracle ---"
L2OO=$(get_addr "L2OutputOracleProxy")
if [[ -n "${L2OO}" ]]; then
  verify_call "L2OO_proposer"   "${L2OO}" "proposer()(address)"   "${SENTINEL_PROPOSER_ADDR}"
  verify_call "L2OO_challenger" "${L2OO}" "challenger()(address)" "${SENTINEL_CHALLENGER_ADDR}"
fi

info "--- SECTION 7: Basescan ---"
for c in "${CONTRACTS[@]}"; do
  a=$(get_addr "${c}")
  [[ -z "${a}" || "${a}" == "UNKNOWN" ]] && continue
  resp=$(curl -sf --max-time 10 "https://api.basescan.org/api?module=contract&action=getabi&address=${a}&apikey=${BASESCAN_API_KEY}" 2>/dev/null || echo '{"status":"0"}')
  s=$(echo "${resp}" | jq -r '.status // "0"')
  [[ "${s}" == "1" ]] && assert_pass "${c} verified" || warn "${c} not yet verified"
done

info "--- SECTION 8: Cross-Contract Links ---"
[[ -n "${OP:-}" && -n "${L2OO:-}" ]] && verify_call "Portal_L2OO" "${OP}" "l2Oracle()(address)" "${L2OO}"
BR=$(get_addr "L1StandardBridgeProxy")
XD=$(get_addr "L1CrossDomainMessengerProxy")
[[ -n "${BR}" && -n "${XD}" ]] && verify_call "Bridge_messenger" "${BR}" "messenger()(address)" "${XD}"

tmp=$(mktemp)
jq --argjson p "${CHECKS_PASSED}" --argjson f "${ERRORS}" '.summary={"passed":$p,"failed":$f,"total":($p+$f)}' "${REPORT_FILE}" > "${tmp}" && mv "${tmp}" "${REPORT_FILE}"

info "POST-DEPLOY VERIFICATION COMPLETE — passed:${CHECKS_PASSED} failed:${ERRORS}"
(( ERRORS > 0 )) && die "${ERRORS} check(s) failed"

echo "VERIFY_STATUS=PASSED" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
exit 0
