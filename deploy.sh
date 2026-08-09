#!/usr/bin/env bash
# =============================================================================
# Aetheron Sentinel L3 — PIPELINE ENTRYPOINT
# Base Mainnet Deterministic Deployment Pipeline
#
# Usage:
#   ./deploy.sh [--dry-run-only] [--skip-dry-run] [--resume-from STAGE]
#
# Stages:
#   00  Toolchain unification & environment lock
#   01  Dry-run simulation (fork validation)
#   02  Live deployment sequencer
#   03  Post-deploy verification
#   04  Readiness gates
#   05  Artifact generation
#
# Environment:
#   Load your .env file before running:
#     set -a && source .env && set +a && ./deploy.sh
#
# Determinism guarantee:
#   The pipeline will abort at the first failure in any stage.
#   Stages 00 and 01 are always run unless --skip-dry-run is passed.
#   Stage 02 (live deploy) only runs if Stage 01 passes.
#   Stages 03-05 only run if Stage 02 passes.
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# -- Parse flags ---------------------------------------------------------------
DRY_RUN_ONLY=false
SKIP_DRY_RUN=false
RESUME_FROM=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run-only)   DRY_RUN_ONLY=true; shift;;
    --skip-dry-run)   SKIP_DRY_RUN=true; shift;;
    --resume-from)    RESUME_FROM="$2"; shift 2;;
    -h|--help)
      sed -n '/^# ====/,/^# ====/p' "$0" | head -30
      exit 0;;
    *) echo "Unknown flag: $1" >&2; exit 1;;
  esac
done
  echo -e "${BOLD}${CYAN}|  $*"
  echo -e "${BOLD}${CYAN}+======================================================+${NC}"
  echo -e ""
}

stage_header() {
  local num="$1" name="$2"
  echo -e ""
  echo -e "${BOLD}${GREEN}+-----------------------------------------------------+${NC}"
  echo -e "${BOLD}${GREEN}|  STAGE ${num}: ${name}${NC}"
  echo -e "${BOLD}${GREEN}+-----------------------------------------------------+${NC}"
  echo -e ""
}

stage_pass() {
  local num="$1" elapsed="$2"
  echo -e "${GREEN}[PASS] STAGE ${num} PASSED (${elapsed}s)${NC}"
}

stage_fail() {
  local num="$1"
  echo -e "${RED}[FAIL] STAGE ${num} FAILED -- pipeline halted${NC}" >&2
}

run_stage() {
  local num="$1" name="$2" script="$3"
  (( num < RESUME_FROM )) && {
    echo -e "${YELLOW}[SKIP] STAGE ${num} skipped (--resume-from ${RESUME_FROM})${NC}"
    return 0
  }

  stage_header "${num}" "${name}"
  local t0; t0=$(date +%s)
  local log_file="${LOG_DIR}/stage-${num}-${name// /_}.log"

  chmod +x "${SCRIPTS_DIR}/${script}"
  if "${SCRIPTS_DIR}/${script}" 2>&1 | tee "${log_file}"; then
    local t1; t1=$(date +%s)
    stage_pass "${num}" "$(( t1 - t0 ))"
    return 0
  else
    local t1; t1=$(date +%s)
    stage_fail "${num}"
    echo -e "${RED}  Log: ${log_file}${NC}" >&2
    exit 1
  fi
}

# -- Stage 01: Dry-run simulation ---------------------------------------------
if [[ "${SKIP_DRY_RUN}" == "false" ]]; then
  run_stage 1 "Dry-Run Fork Simulation" "01_dry_run.sh"
else
  echo -e "${YELLOW}[SKIP] Stage 01 skipped (--skip-dry-run)${NC}"
fi

if [[ "${DRY_RUN_ONLY}" == "true" ]]; then
  banner "Dry-run complete -- live deployment NOT executed (--dry-run-only)"
  exit 0
fi

# -- Stage 02: Live deployment sequencer --------------------------------------
run_stage 2 "Live Contract Deployment Sequencer" "02_deploy_sequence.sh"

# -- Stage 03: Post-deploy verification ---------------------------------------
run_stage 3 "Post-Deploy On-Chain Verification" "03_post_deploy_verify.sh"

# -- Stage 04: Readiness gates ------------------------------------------------
run_stage 4 "Readiness Gates (Go/No-Go)" "04_readiness_gates.sh"

# -- Stage 05: Artifact generation --------------------------------------------
run_stage 5 "Artifact & Manifest Generation" "05_generate_artifacts.sh"

# -- Pipeline complete --------------------------------------------------------
PIPELINE_END=$(date +%s)
PIPELINE_ELAPSED=$(( PIPELINE_END - PIPELINE_START ))

banner "[PASS] PIPELINE COMPLETE -- Aetheron Sentinel L3 DEPLOYED"
echo -e "  Total time  : ${PIPELINE_ELAPSED}s"
echo -e "  Addresses   : ${ROOT}/artifacts/deployed-addresses.json"
echo -e "  Manifest    : ${ROOT}/artifacts/deployment-manifest.json"
echo -e "  Gate lock   : ${ROOT}/artifacts/gate.lock"
echo -e "  Checksums   : ${ROOT}/artifacts/checksums.sha256"
echo -e "  Explorer    : https://basescan.org"
echo ""
echo -e "${BOLD}The L3 sequencer may now be started. Gate lock is authoritative.${NC}"

exit 0

# -- Pipeline banner -----------------------------------------------------------
banner "Aetheron Sentinel L3 -- Base Mainnet Deployment Pipeline"
echo -e "  Timestamp  : ${PIPELINE_TS}"
echo -e "  Dry-run    : ${DRY_RUN_ONLY}"
echo -e "  Skip sim   : ${SKIP_DRY_RUN}"
echo -e "  Resume from: stage ${RESUME_FROM}"
echo -e "  Logs       : ${LOG_DIR}"
echo ""

# -- Stage 00: Toolchain & environment lock ------------------------------------
run_stage 0 "Toolchain Unification & Environment Lock" "00_check_toolchain.sh"

SCRIPTS_DIR="$(cd "$(dirname "$0")/scripts" && pwd)"
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${ROOT}/artifacts/logs"
mkdir -p "${LOG_DIR}"

# -- Color + logging -----------------------------------------------------------
BOLD='\033[1m'; GREEN='\033[0;32m'; RED='\033[0;31m'
CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
PIPELINE_START=$(date +%s)
PIPELINE_TS=$(date -u +"%Y%m%dT%H%M%SZ")

banner() {
  echo -e ""
  echo -e "${BOLD}${CYAN}+======================================================+${NC}"
