#!/usr/bin/env bash
set -euo pipefail

# --- Config -------------------------------------------------------------------

BRANCH_NAME="${BRANCH_NAME:-work}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore: post-deploy testnet addresses}"

# Paths (adjust if your layout differs)
SUBGRAPH_FILE="subgraph.yaml"
SITE_CONTRACTS_FILE="site/contracts.js"
ABIS_DIR="abis"

# --- Preconditions ------------------------------------------------------------

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Create it with SEPOLIA_RPC_URL, PRIVATE_KEY, SENTINEL_OWNER, ETHERSCAN_API_KEY."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required but not installed. Install jq and re-run."
  exit 1
fi

# --- 1. Deploy ----------------------------------------------------------------

echo "▶ Deploying to testnet (Sepolia)..."
DEPLOY_OUTPUT=$(npm run --silent deploy:testnet)

echo "Raw deploy output:"
echo "$DEPLOY_OUTPUT"
echo

# Try to extract JSON blob from output (assumes last JSON-looking block)
DEPLOYED_ADDRESSES=$(printf '%s\n' "$DEPLOY_OUTPUT" | jq -s '.[-1]')
if [ -z "$DEPLOYED_ADDRESSES" ] || [ "$DEPLOYED_ADDRESSES" = "null" ]; then
  echo "ERROR: Could not parse DEPLOYED_ADDRESSES JSON from deploy output."
  exit 1
fi

echo "Parsed DEPLOYED_ADDRESSES:"
echo "$DEPLOYED_ADDRESSES" | jq
echo

# Extract startBlock if present
START_BLOCK=$(echo "$DEPLOYED_ADDRESSES" | jq -r '.startBlock // empty')
if [ -z "${START_BLOCK:-}" ]; then
  echo "WARNING: startBlock not found in DEPLOYED_ADDRESSES; you must set START_BLOCK manually if required."
fi

# --- 2. Patch subgraph --------------------------------------------------------

if [ -n "${START_BLOCK:-}" ]; then
  echo "▶ Updating subgraph with START_BLOCK=$START_BLOCK..."
  DEPLOYED_ADDRESSES="$DEPLOYED_ADDRESSES" \
  START_BLOCK="$START_BLOCK" \
  npm run update:subgraph
else
  echo "▶ Updating subgraph without START_BLOCK (env not set)..."
  DEPLOYED_ADDRESSES="$DEPLOYED_ADDRESSES" \
  npm run update:subgraph
fi

# --- 3. Patch site config -----------------------------------------------------

echo "▶ Exporting site config..."
DEPLOYED_ADDRESSES="$DEPLOYED_ADDRESSES" \
npm run export:site-config

# --- 4. Verify on Etherscan ---------------------------------------------------

echo "▶ Verifying contracts on Etherscan..."
DEPLOYED_ADDRESSES="$DEPLOYED_ADDRESSES" \
npm run verify:testnet

# --- 5. Export ABIs -----------------------------------------------------------

echo "▶ Exporting ABIs..."
npm run export:abis

# --- 6. Git commit & push -----------------------------------------------------

echo "▶ Staging files..."
git add "$SUBGRAPH_FILE" "$SITE_CONTRACTS_FILE" "$ABIS_DIR/"

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  echo "▶ Committing changes..."
  git commit -m "$COMMIT_MESSAGE"

  echo "▶ Pushing to origin $BRANCH_NAME..."
  git push origin "$BRANCH_NAME"
fi

echo "✅ Done: deploy → patch → verify → export → commit complete."
