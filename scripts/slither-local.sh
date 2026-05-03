#!/bin/bash
# Run Slither static analysis on all contracts, filtering out node_modules, test, and scripts

set -e

if ! command -v slither &> /dev/null; then
  echo "Slither is not installed. Activate your Python environment and run: pip install slither-analyzer"
  exit 1
fi

npx hardhat compile
slither ./contracts --filter-paths 'node_modules|test|scripts' "$@"
