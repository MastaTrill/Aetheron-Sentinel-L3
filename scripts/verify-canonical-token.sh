#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
TOKEN="${SENTINEL_TOKEN_ADDRESS:-0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3}"
EXPECTED_CHAIN_ID=8453

command -v cast >/dev/null 2>&1 || {
  echo "ERROR: Foundry cast is required: https://book.getfoundry.sh/getting-started/installation" >&2
  exit 1
}

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
[[ "$CHAIN_ID" == "$EXPECTED_CHAIN_ID" ]] || {
  echo "ERROR: RPC chain id is $CHAIN_ID; expected $EXPECTED_CHAIN_ID (Base mainnet)." >&2
  exit 1
}

SNAPSHOT_BLOCK="${SENTINEL_SNAPSHOT_BLOCK:-$(cast block-number --rpc-url "$RPC_URL")}"
UTC_TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

rpc() {
  cast call "$TOKEN" "$1" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK"
}

CODE="$(cast code "$TOKEN" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK")"
[[ "$CODE" != "0x" ]] || {
  echo "ERROR: No bytecode at $TOKEN at block $SNAPSHOT_BLOCK" >&2
  exit 1
}

NAME="$(rpc 'name()(string)')"
SYMBOL="$(rpc 'symbol()(string)')"
DECIMALS="$(rpc 'decimals()(uint8)')"
TOTAL_SUPPLY="$(rpc 'totalSupply()(uint256)')"
OWNER="$(rpc 'owner()(address)')"
POOL="$(rpc 'pool()(address)')"
POOL_UNLOCKED="$(rpc 'isPoolUnlocked()(bool)')"
MINT_RATE="$(rpc 'yearlyMintRate()(uint256)')"
LAST_MINT="$(rpc 'lastMintTimestamp()(uint256)')"
VESTING_START="$(rpc 'vestingStart()(uint256)')"
VESTING_DURATION="$(rpc 'vestingDuration()(uint256)')"
VESTED_TOTAL="$(rpc 'vestedTotalAmount()(uint256)')"
TOKEN_URI="$(rpc 'tokenURI()(string)')"
BYTECODE_HASH="$(cast keccak "$CODE")"

cat <<EOF
Canonical SENTINEL token verification
=====================================
capturedAtUtc:     $UTC_TIMESTAMP
blockNumber:       $SNAPSHOT_BLOCK
chainId:           $CHAIN_ID
address:           $TOKEN
name:              $NAME
symbol:            $SYMBOL
decimals:          $DECIMALS
totalSupply:       $TOTAL_SUPPLY
owner:             $OWNER
pool:              $POOL
poolUnlocked:      $POOL_UNLOCKED
yearlyMintRate:    $MINT_RATE
lastMintTimestamp: $LAST_MINT
vestingStart:      $VESTING_START
vestingDuration:   $VESTING_DURATION
vestedTotalAmount: $VESTED_TOTAL
tokenURI:          $TOKEN_URI
bytecodeHash:      $BYTECODE_HASH
explorer:          https://basescan.org/token/$TOKEN
EOF

[[ "$NAME" == '"SENTINEL"' ]] || { echo "ERROR: unexpected token name: $NAME" >&2; exit 1; }
[[ "$SYMBOL" == '"SENTINEL"' ]] || { echo "ERROR: unexpected token symbol: $SYMBOL" >&2; exit 1; }
[[ "$DECIMALS" == "18" ]] || { echo "ERROR: unexpected decimals: $DECIMALS" >&2; exit 1; }

if [[ "$OWNER" == "0x0000000000000000000000000000000000000000" ]]; then
  echo "NOTICE: ownership is renounced. Owner-only pool, URI, and mint-rate operations are permanently unavailable."
else
  echo "ACTION REQUIRED: confirm owner is the approved controller architecture before public launch."
fi

if [[ "$POOL_UNLOCKED" != "true" ]]; then
  echo "NOTICE: the configured migration-pool lock target is not reported unlocked; this is not a global V4 trading lock."
fi
