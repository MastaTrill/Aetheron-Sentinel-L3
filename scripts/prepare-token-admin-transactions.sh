#!/usr/bin/env bash
set -euo pipefail

TOKEN="0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3"

usage() {
  cat <<'EOF'
Prepare unsigned calldata for the canonical SENTINEL token.

Usage:
  scripts/prepare-token-admin-transactions.sh transfer-ownership <SAFE_ADDRESS>
  scripts/prepare-token-admin-transactions.sh lock-pool <POOL_ADDRESS>
  scripts/prepare-token-admin-transactions.sh unlock-pool
  scripts/prepare-token-admin-transactions.sh update-mint-rate <WAD_RATE>
  scripts/prepare-token-admin-transactions.sh update-token-uri <URI>

This script never broadcasts and never requests a private key.
Paste the resulting target/value/data into a reviewed Safe transaction.
EOF
}

[[ $# -ge 1 ]] || { usage; exit 1; }
command -v cast >/dev/null || { echo "Foundry cast is required" >&2; exit 1; }

ACTION="$1"; shift
case "$ACTION" in
  transfer-ownership)
    [[ $# -eq 1 ]] || { usage; exit 1; }
    DATA=$(cast calldata "transferOwnership(address)" "$1")
    ;;
  lock-pool)
    [[ $# -eq 1 ]] || { usage; exit 1; }
    DATA=$(cast calldata "lockPool(address)" "$1")
    ;;
  unlock-pool)
    [[ $# -eq 0 ]] || { usage; exit 1; }
    DATA=$(cast calldata "unlockPool()")
    ;;
  update-mint-rate)
    [[ $# -eq 1 ]] || { usage; exit 1; }
    DATA=$(cast calldata "updateMintRate(uint256)" "$1")
    ;;
  update-token-uri)
    [[ $# -eq 1 ]] || { usage; exit 1; }
    DATA=$(cast calldata "updateTokenURI(string)" "$1")
    ;;
  *) usage; exit 1 ;;
esac

printf 'target=%s\nvalue=0\ndata=%s\n' "$TOKEN" "$DATA"
