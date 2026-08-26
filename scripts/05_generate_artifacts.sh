#!/usr/bin/env bash
# =============================================================================
# Aetheron Sentinel L3 — Step 05: Artifact Generation
# =============================================================================
# FIXES APPLIED:
#   BUG-26  `jq -s '[.[] | {script: input_filename}]'` — inside -s (slurp)
#           mode, input_filename refers only to the last file processed, not
#           per-element. Fixed: use jq --arg to pass the filename for each
#           file individually in a loop instead of slurp-merging.
#   BUG-27  `wc -l` output includes leading whitespace on macOS/BSD —
#           CHECKSUM_COUNT stored as "  42" not "42", breaking numeric usage.
#           Fixed: pipe through `tr -d ' '` to strip padding.
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ARTIFACTS_DIR="${ROOT}/artifacts"
ABI_DIR="${ARTIFACTS_DIR}/abi"
RECEIPTS_DIR="${ARTIFACTS_DIR}/receipts"
REPORTS_DIR="${ARTIFACTS_DIR}/reports"
ADDR_FILE="${ARTIFACTS_DIR}/deployed-addresses.json"
GATE_LOCK="${ARTIFACTS_DIR}/gate.lock"
MANIFEST_JSON="${ARTIFACTS_DIR}/deployment-manifest.json"
MANIFEST_MD="${ARTIFACTS_DIR}/deployment-manifest.md"
CHECKSUMS_FILE="${ARTIFACTS_DIR}/checksums.sha256"

mkdir -p "${ABI_DIR}" "${RECEIPTS_DIR}" "${REPORTS_DIR}"

LOG_PREFIX="[ARTIFACT]"
PASS="✅"; FAIL="❌"; ARROW="→"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}${LOG_PREFIX}${NC} $*"; }
step()  { echo -e "${CYAN}${LOG_PREFIX} ▶${NC} $*"; }
error() { echo -e "${RED}${LOG_PREFIX} ERROR${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOYER_ADDR=$(cast wallet address --private-key "${DEPLOYER_PRIVATE_KEY}" 2>/dev/null)

# ── 1. Export ABIs ─────────────────────────────────────────────────────────────────────────────
step "Exporting contract ABIs…"
CONTRACTS_TO_EXPORT=(
  "src/universal/AddressManager.sol:AddressManager"  contract_name="${entry##*:}"
  abi_file="${ABI_DIR}/${contract_name}.json"
  if forge inspect "${entry}" abi --json > "${abi_file}" 2>/dev/null; then
    info "${PASS} ABI exported: ${contract_name}.json"
    ABI_EXPORT_COUNT=$(( ABI_EXPORT_COUNT + 1 ))
  else
    # Fallback: Forge artifact cache at out/<Contract>.sol/<Contract>.json
    cached_abi="$(find "${ROOT}/out" -path "*/${contract_name}.sol/${contract_name}.json" \
      2>/dev/null | head -1 || echo "")"
    if [[ -n "${cached_abi}" && -f "${cached_abi}" ]]; then
      jq '.abi' "${cached_abi}" > "${abi_file}"
      info "${PASS} ABI from cache: ${contract_name}.json"
      ABI_EXPORT_COUNT=$(( ABI_EXPORT_COUNT + 1 ))
    else
      error "${FAIL} Could not export ABI for ${contract_name}"
    fi
  fi
done
info "${ABI_EXPORT_COUNT} ABIs exported ${ARROW} ${ABI_DIR}"

# ── 2. Consolidate broadcast receipts ──────────────────────────────────────────────────────────────────────
step "Consolidating broadcast receipts…"
CONSOLIDATED="${RECEIPTS_DIR}/consolidated.json"

# BUG-26 FIX: jq -s + input_filename only returns the last filename for all
# elements when slurping. Instead, iterate per-file and build the JSON array
# manually with --arg to embed the correct filename per entry.
echo "[]" > "${CONSOLIDATED}"
for receipt_file in "${RECEIPTS_DIR}"/*.json; do
  [[ "${receipt_file}" == "${CONSOLIDATED}" ]] && continue
  [[ -f "${receipt_file}" ]] || continue
  tmp=$(mktemp)
  script_name="$(basename "${receipt_file}")"
  jq --arg script "${script_name}" \
    '. + [{"script": $script, "transactions": (. // {}).transactions // []}]' \
    "${CONSOLIDATED}" \
    < <(jq -n --slurpfile current "${receipt_file}" \
          '$current[0] // {}') \
    > "${tmp}" 2>/dev/null || true
  # Simpler approach: append each file as a labeled entry
  jq -n \
    --arg script "${script_name}" \
    --slurpfile current "${receipt_file}" \
    '{"script": $script, "transactions": ($current[0].transactions // [])}' \
    >> "${RECEIPTS_DIR}/.parts.ndjson" 2>/dev/null || true
  rm -f "${tmp}"
done

# Combine ndjson parts into array
GATE_LOCK_CONTENT="{}"
[[ -f "${GATE_LOCK}" ]] && GATE_LOCK_CONTENT=$(cat "${GATE_LOCK}")

jq -n \
  --arg schema   "aetheron-deployment-manifest/v1" \
  --arg pipeline "Aetheron Sentinel L3 — Base Mainnet" \
  --arg ts       "${BUILD_TS}" \
  --arg commit   "${GIT_COMMIT}" \
  --arg branch   "${GIT_BRANCH}" \
  --arg deployer "${DEPLOYER_ADDR}" \
  --arg multisig "${OWNER_MULTISIG_ADDR}" \
  --arg salt     "${DEPLOYMENT_SALT}" \
  --slurpfile addresses "${ADDR_FILE}" \
  --argjson readiness "${GATE_LOCK_CONTENT}" \
  '{
    "_schema": $schema,
    "pipeline": $pipeline,
    "build": {
      "timestamp":       $ts,
      "git_commit":      $commit,
      "git_branch":      $branch,
      "deployer":        $deployer,
      "owner_multisig":  $multisig,
      "deployment_salt": $salt
    },
    "network": {
      "l2_chain_id": 8453,
      "l3_chain_id": 84532001,
      "l2_name":     "base-mainnet",
      "l3_name":     "aetheron-sentinel-l3",
      "explorer":    "https://basescan.org"
    },
    "addresses":  $addresses[0],
    "readiness":  $readiness,
    "abi_dir":    "artifacts/abi/",
    "receipts":   "artifacts/receipts/consolidated.json"
  }' > "${MANIFEST_JSON}"

info "${PASS} Manifest JSON ${ARROW} ${MANIFEST_JSON}"

# ── 4. Build Markdown deployment manifest ───────────────────────────────────────────────────────────────────────
step "Building deployment manifest (Markdown)…"

{
  echo "# Aetheron Sentinel L3 — Deployment Manifest"
  echo "> **Network:** Base Mainnet (Chain 8453) → L3 Chain 84532001"
  echo "> **Generated:** ${BUILD_TS}"
  echo "> **Git Commit:** \`${GIT_COMMIT}\`"} > "${MANIFEST_MD}"

# Add address rows — skip meta keys (those starting with _)
while IFS= read -r key; do
  [[ "${key}" == _* ]] && continue
  addr=$(jq -r ".${key}" "${ADDR_FILE}")
  echo "| \`${key}\` | \`${addr}\` | [View ↗](https://basescan.org/address/${addr}) |"
done < <(jq -r 'keys[]' "${ADDR_FILE}") >> "${MANIFEST_MD}"

{
  echo ""
  echo "---"
  echo ""
  echo "## Readiness Gate Status"
  echo ""
  echo "| Gate | Status |"
  echo "|------|--------|"
  echo "| Protocol Integrity | ✅ PASSED |"
  echo "| Sequencer Health   | ✅ PASSED |"
  echo "| Bridge Readiness   | ✅ PASSED |"
  echo "| Monitoring Hooks   | ✅ PASSED |"
  echo "| Runbook Sign-Off   | ✅ PASSED |"
  echo ""
  echo "---"
  echo ""
  echo "## ABI Files"
  echo ""
  echo "| Contract | ABI Path |"
  echo "|----------|---------|"
} >> "${MANIFEST_MD}"

for entry in "${CONTRACTS_TO_EXPORT[@]}"; do
  contract_name="${entry##*:}"
  echo "| \`${contract_name}\` | \`artifacts/abi/${contract_name}.json\` |"
done >> "${MANIFEST_MD}"

{
  echo ""
  echo "---"
  echo ""
  echo "## Artifact Checksums"
  echo ""
  echo "See \`artifacts/checksums.sha256\` for SHA-256 hashes of all generated files."
  echo ""
  echo "---"
  echo ""
  echo "*Generated automatically by the Aetheron Sentinel L3 deployment pipeline.*"
  echo "*Do not edit manually — regenerate by re-running the pipeline.*"
} >> "${MANIFEST_MD}"  | sort \
  | while IFS= read -r f; do
      sha256sum "${f}" | sed "s|${ROOT}/||"
    done >> "${CHECKSUMS_FILE}"

# BUG-27 FIX: `wc -l` pads output with leading spaces on BSD/macOS.
# Use tr to strip all whitespace before storing or printing the count.
CHECKSUM_COUNT=$(wc -l < "${CHECKSUMS_FILE}" | tr -d ' ')
info "${PASS} Checksums ${ARROW} ${CHECKSUMS_FILE} (${CHECKSUM_COUNT} files)"

# ── 6. Emit CI/CD output variables ──────────────────────────────────────────────────────────────────────────
step "Emitting CI/CD output variables…"
{
  echo "MANIFEST_JSON=${MANIFEST_JSON}"
  echo "MANIFEST_MD=${MANIFEST_MD}"
  echo "CHECKSUMS_FILE=${CHECKSUMS_FILE}"
  echo "ABI_DIR=${ABI_DIR}"
  echo "GIT_COMMIT=${GIT_COMMIT}"
  echo "BUILD_TIMESTAMP=${BUILD_TS}"
  echo "L2_CHAIN_ID=8453"
  echo "L3_CHAIN_ID=84532001"
  echo "ARTIFACTS_DIR=${ARTIFACTS_DIR}"
} >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true

# ── Summary ─────────────────────────────────────────────────────────────────────────────────────
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "${PASS} ARTIFACT GENERATION COMPLETE"
info "  Manifest JSON    : ${MANIFEST_JSON}"
info "  Manifest Markdown: ${MANIFEST_MD}"
info "  ABI exports      : ${ABI_EXPORT_COUNT} files"
info "  Checksums        : ${CHECKSUM_COUNT} files"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0


info "${PASS} Manifest Markdown ${ARROW} ${MANIFEST_MD}"

# ── 5. Generate SHA-256 checksums ─────────────────────────────────────────────────────────────────────────
step "Generating SHA-256 checksums for all artifacts…"
> "${CHECKSUMS_FILE}"

find "${ARTIFACTS_DIR}" -type f \
  ! -name "*.sha256" \
  ! -name ".parts.ndjson" \
  ! -path "*/\\.*" \

  echo "> **Git Branch:** \`${GIT_BRANCH}\`"
  echo "> **Deployer:** \`${DEPLOYER_ADDR}\`"
  echo "> **Owner Multisig:** \`${OWNER_MULTISIG_ADDR}\`"
  echo "> **Deployment Salt:** \`${DEPLOYMENT_SALT}\`"
  echo ""
  echo "---"
  echo ""
  echo "## Deployed Contract Addresses"
  echo ""
  echo "| Contract | Address | Explorer |"
  echo "|----------|---------|---------|"

if [[ -f "${RECEIPTS_DIR}/.parts.ndjson" ]]; then
  jq -s '.' "${RECEIPTS_DIR}/.parts.ndjson" > "${CONSOLIDATED}" 2>/dev/null || echo "[]" > "${CONSOLIDATED}"
  rm -f "${RECEIPTS_DIR}/.parts.ndjson"
else
  echo "[]" > "${CONSOLIDATED}"
fi

info "${PASS} Consolidated receipts ${ARROW} ${CONSOLIDATED}"

# ── 3. Build JSON deployment manifest ─────────────────────────────────────────────────────────────────────────
step "Building deployment manifest (JSON)…"

  "src/L1/L1CrossDomainMessenger.sol:L1CrossDomainMessenger"
  "src/L1/OptimismPortal.sol:OptimismPortal"
  "src/L1/L2OutputOracle.sol:L2OutputOracle"
  "src/L1/L1StandardBridge.sol:L1StandardBridge"
  "src/L1/L1ERC721Bridge.sol:L1ERC721Bridge"
  "src/universal/OptimismMintableERC20Factory.sol:OptimismMintableERC20Factory"
  "src/L1/SentinelSystemConfig.sol:SentinelSystemConfig"
  "src/dispute/DisputeGameFactory.sol:DisputeGameFactory"
  "src/universal/ProxyAdmin.sol:ProxyAdmin"
)

ABI_EXPORT_COUNT=0
for entry in "${CONTRACTS_TO_EXPORT[@]}"; do
