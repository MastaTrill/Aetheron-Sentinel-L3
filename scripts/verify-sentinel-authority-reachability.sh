#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${BASE_RPC_URL:-https://base-rpc.publicnode.com}"
TOKEN="${SENTINEL_TOKEN_ADDRESS:-0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3}"
AIRLOCK="${SENTINEL_AIRLOCK_ADDRESS:-0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12}"
SAFE="${SENTINEL_AIRLOCK_OWNER:-0x21E2ce70511e4FE542a97708e89520471DAa7A66}"
PROBE_EOA="${SENTINEL_PROBE_EOA:-0x0000000000000000000000000000000000000001}"
SNAPSHOT_BLOCK="${SENTINEL_SNAPSHOT_BLOCK:-$(cast block-number --rpc-url "$RPC_URL")}"

command -v cast >/dev/null 2>&1 || { echo 'ERROR: Foundry cast is required.' >&2; exit 1; }
[[ "$(cast chain-id --rpc-url "$RPC_URL")" == '8453' ]] || { echo 'ERROR: expected Base mainnet.' >&2; exit 1; }

probe() {
  local label="$1" from="$2" target="$3" signature="$4"
  shift 4
  local output status
  set +e
  output="$(cast call "$target" "$signature" "$@" --from "$from" --rpc-url "$RPC_URL" --block "$SNAPSHOT_BLOCK" 2>&1)"
  status=$?
  set -e
  printf '\nprobe: %s\nfrom: %s\ntarget: %s\nsignature: %s\nresult: %s\noutput: %s\n' \
    "$label" "$from" "$target" "$signature" "$([[ $status -eq 0 ]] && echo simulated-success || echo reverted)" "${output//$'\n'/ }"
}

cat <<REPORT
SENTINEL authority reachability simulation
==========================================
capturedAtUtc: $(date -u '+%Y-%m-%dT%H:%M:%SZ')
blockNumber:   $SNAPSHOT_BLOCK
chainId:       8453
token:         $TOKEN
airlock:       $AIRLOCK
airlockOwner:  $SAFE

NOTICE: cast call is an eth_call simulation. It never signs or broadcasts a transaction.
NOTICE: a simulated call with --from the Airlock tests DERC20 authorization only; it does not prove the Airlock exposes a path that can originate that call.
REPORT

probe 'direct Safe updateMintRate' "$SAFE" "$TOKEN" 'updateMintRate(uint256)' 0
probe 'direct Safe updateTokenURI' "$SAFE" "$TOKEN" 'updateTokenURI(string)' 'ipfs://sentinel-read-only-probe'
probe 'direct Safe unlockPool' "$SAFE" "$TOKEN" 'unlockPool()'
probe 'direct Safe transferOwnership' "$SAFE" "$TOKEN" 'transferOwnership(address)' "$SAFE"
probe 'public mintInflation while minting dormant' "$PROBE_EOA" "$TOKEN" 'mintInflation()'
probe 'authorization-only Airlock unlockPool simulation' "$AIRLOCK" "$TOKEN" 'unlockPool()'
probe 'authorization-only Airlock updateMintRate simulation' "$AIRLOCK" "$TOKEN" 'updateMintRate(uint256)' 0
probe 'current asset migration simulation' "$PROBE_EOA" "$AIRLOCK" 'migrate(address)' "$TOKEN"
