#!/usr/bin/env bash
set -euo pipefail

ITERATIONS="${1:-5}"
export PYTHONPATH=src

if ! [[ "${ITERATIONS}" =~ ^[0-9]+$ ]] || [[ "${ITERATIONS}" -lt 1 ]]; then
  echo "usage: $0 [iterations>=1]"
  exit 2
fi

echo "Running pre-merge stress loop for ${ITERATIONS} iterations"
for i in $(seq 1 "${ITERATIONS}"); do
  export PYTHONHASHSEED="${i}"
  echo "== iteration ${i}/${ITERATIONS} (PYTHONHASHSEED=${PYTHONHASHSEED}) =="
  ./scripts/ci_matrix.sh
done

echo "Pre-merge stress loop completed successfully"
