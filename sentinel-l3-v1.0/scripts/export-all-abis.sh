#!/bin/bash
# Export all ABIs to ./abis/ for publishing or external use
set -e

OUTDIR="abis"
mkdir -p "$OUTDIR"

for artifact in ./artifacts/contracts/*.sol/*.json; do
  name=$(basename "$artifact" .json)
  jq '.abi' "$artifact" > "$OUTDIR/$name.json"
done

echo "All ABIs exported to $OUTDIR/"
