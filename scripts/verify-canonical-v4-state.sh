#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
TOKEN="${SENTINEL_TOKEN_ADDRESS:-0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3}"
AIRLOCK="${SENTINEL_AIRLOCK_ADDRESS:-0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12}"
INITIALIZER="${SENTINEL_INITIALIZER_ADDRESS:-0xD59cE43E53D69F190E15d9822Fb4540dCcc91178}"
HOOK="${SENTINEL_HOOK_ADDRESS:-0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0}"
POOL_MANAGER="${BASE_V4_POOL_MANAGER_ADDRESS:-0x498581fF718922c3f8e6A244956aF099B2652b2b}"
WETH="${BASE_WETH_ADDRESS:-0x4200000000000000000000000000000000000006}"
DYNAMIC_FEE="${SENTINEL_V4_FEE_FIELD:-8388608}"
TICK_SPACING="${SENTINEL_V4_TICK_SPACING:-200}"
EXPECTED_CHAIN_ID=8453

command -v cast >/dev/null 2>&1 || {
  echo "ERROR: Foundry cast is required" >&2
  exit 1
}

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
[[ "$CHAIN_ID" == "$EXPECTED_CHAIN_ID" ]] || {
  echo "ERROR: RPC chain id is $CHAIN_ID; expected $EXPECTED_CHAIN_ID (Base Mainnet)." >&2
  exit 1
}

SNAPSHOT_BLOCK="${SENTINEL_SNAPSHOT_BLOCK:-$(cast block-number --rpc-url "$RPC_URL")}"
UTC_TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

for ADDRESS in "$TOKEN" "$AIRLOCK" "$INITIALIZER" "$HOOK" "$POOL_MANAGER"; do
  CODE="$(cast code "$ADDRESS" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK")"
  [[ "$CODE" != "0x" ]] || {
    echo "ERROR: No bytecode at $ADDRESS at block $SNAPSHOT_BLOCK" >&2
    exit 1
  }
done

POOL_KEY_ENCODED="$(
  cast abi-encode \
    "f(address,address,uint24,int24,address)" \
    "$WETH" \
    "$TOKEN" \
    "$DYNAMIC_FEE" \
    "$TICK_SPACING" \
    "$HOOK"
)"
POOL_ID="$(cast keccak "$POOL_KEY_ENCODED")"

cat <<EOF
Canonical SENTINEL controller and V4 verification
==================================================
capturedAtUtc:     $UTC_TIMESTAMP
blockNumber:       $SNAPSHOT_BLOCK
chainId:           $CHAIN_ID
token:             $TOKEN
airlock:           $AIRLOCK
initializer:       $INITIALIZER
hook:              $HOOK
poolManager:       $POOL_MANAGER
poolId:            $POOL_ID
EOF

echo
echo "runtimeBytecodeHashes:"
for LABEL_ADDRESS in \
  "token:$TOKEN" \
  "airlock:$AIRLOCK" \
  "initializer:$INITIALIZER" \
  "hook:$HOOK" \
  "poolManager:$POOL_MANAGER"; do
  LABEL="${LABEL_ADDRESS%%:*}"
  ADDRESS="${LABEL_ADDRESS#*:}"
  HASH="$(cast code "$ADDRESS" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK" | cast keccak)"
  printf '%-14s %s\n' "$LABEL:" "$HASH"
done

echo
echo "airlockOwner:"
cast call "$AIRLOCK" "owner()(address)" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK"

echo
echo "airlockAssetData:"
echo "order: numeraire, timelock, governance, migrator, initializer, pool, migrationPool, numTokensToSell, totalSupply, integrator"
cast call "$AIRLOCK" \
  "getAssetData(address)(address,address,address,address,address,address,address,uint256,uint256,address)" \
  "$TOKEN" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "initializerState:"
echo "order: numeraire, rawStatus, poolKey, currentTick"
cast call "$INITIALIZER" \
  "getState(address)(address,uint8,(address,address,uint24,int24,address),int24)" \
  "$TOKEN" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "beneficiaries:"
cast call "$INITIALIZER" \
  "getBeneficiaries(address)((address,uint96)[])" \
  "$TOKEN" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "positions:"
cast call "$INITIALIZER" \
  "getPositions(address)((int24,int24,uint128,bytes32)[])" \
  "$TOKEN" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "verifiedPoolKey:"
cast call "$INITIALIZER" \
  "getPoolKey(bytes32)(address,address,uint24,int24,address)" \
  "$POOL_ID" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "feeSchedule:"
echo "order: startingTime, startFee, endFee, lastFee, durationSeconds"
cast call "$HOOK" \
  "getFeeScheduleOf(bytes32)(uint32,uint24,uint24,uint24,uint32)" \
  "$POOL_ID" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "cumulatedFees0:"
cast call "$INITIALIZER" \
  "getCumulatedFees0(bytes32)(uint256)" \
  "$POOL_ID" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "cumulatedFees1:"
cast call "$INITIALIZER" \
  "getCumulatedFees1(bytes32)(uint256)" \
  "$POOL_ID" \
  --rpc-url "$RPC_URL" \
  --block "$SNAPSHOT_BLOCK"

echo
echo "hookInitializer:"
cast call "$HOOK" "INITIALIZER()(address)" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK"

echo
echo "hookPoolManager:"
cast call "$HOOK" "poolManager()(address)" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK"

echo
echo "NOTICE: Every bytecode and state read above is pinned to block $SNAPSHOT_BLOCK."
echo "NOTICE: This script is read-only and does not prove swap availability, beneficiary identity, migration safety, or release approval."
