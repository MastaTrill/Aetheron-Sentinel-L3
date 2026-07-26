#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${BASE_RPC_URL:-https://base-rpc.publicnode.com}"
TOKEN="${SENTINEL_TOKEN_ADDRESS:-0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3}"
AIRLOCK="${SENTINEL_AIRLOCK_ADDRESS:-0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12}"
SAFE="${SENTINEL_AIRLOCK_OWNER:-0x21E2ce70511e4FE542a97708e89520471DAa7A66}"
PROBE_EOA="${SENTINEL_PROBE_EOA:-0x0000000000000000000000000000000000000001}"
BLOCK_TAG="${SENTINEL_SNAPSHOT_BLOCK:-latest}"

command -v cast >/dev/null 2>&1 || { echo 'ERROR: Foundry cast is required.' >&2; exit 1; }
[[ "$(cast chain-id --rpc-url "$RPC_URL")" == '8453' ]] || { echo 'ERROR: expected Base mainnet.' >&2; exit 1; }
OBSERVED_BLOCK="$(cast block-number --rpc-url "$RPC_URL")"

probe() {
  local label="$1" expected="$2" from="$3" target="$4" signature="$5"
  shift 5
  local output status result
  set +e
  output="$(cast call "$target" "$signature" "$@" --from "$from" --rpc-url "$RPC_URL" --block "$BLOCK_TAG" 2>&1)"
  status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    result='simulated-success'
  else
    if grep -Eiq 'HTTP error|transport error|archive requests|rate limit|connection|timed out|could not resolve|error sending request|failed to get' <<<"$output"; then
      echo "ERROR: RPC/transport failure during probe '$label': ${output//$'\n'/ }" >&2
      return 2
    fi
    result='reverted'
  fi

  printf '\nprobe: %s\nexpected: %s\nfrom: %s\ntarget: %s\nsignature: %s\nresult: %s\noutput: %s\n' \
    "$label" "$expected" "$from" "$target" "$signature" "$result" "${output//$'\n'/ }"

  [[ "$result" == "$expected" ]] || {
    echo "ERROR: probe '$label' expected $expected but observed $result" >&2
    return 1
  }
}

cat <<REPORT
SENTINEL authority reachability simulation
==========================================
capturedAtUtc:       $(date -u '+%Y-%m-%dT%H:%M:%SZ')
observedStartBlock:  $OBSERVED_BLOCK
blockTag:            $BLOCK_TAG
chainId:             8453
token:               $TOKEN
airlock:             $AIRLOCK
airlockOwner:        $SAFE

NOTICE: cast call is an eth_call simulation. It never signs or broadcasts a transaction.
NOTICE: a simulated call with --from the Airlock tests DERC20 authorization only; it does not prove the Airlock exposes a path that can originate that call.
REPORT

probe 'direct Safe updateMintRate' 'reverted' "$SAFE" "$TOKEN" 'updateMintRate(uint256)' 0
probe 'direct Safe updateTokenURI' 'reverted' "$SAFE" "$TOKEN" 'updateTokenURI(string)' 'ipfs://sentinel-read-only-probe'
probe 'direct Safe unlockPool' 'reverted' "$SAFE" "$TOKEN" 'unlockPool()'
probe 'direct Safe transferOwnership' 'reverted' "$SAFE" "$TOKEN" 'transferOwnership(address)' "$SAFE"
probe 'public mintInflation while minting dormant' 'reverted' "$PROBE_EOA" "$TOKEN" 'mintInflation()'
probe 'authorization-only Airlock unlockPool simulation' 'simulated-success' "$AIRLOCK" "$TOKEN" 'unlockPool()'
probe 'authorization-only Airlock updateMintRate simulation' 'simulated-success' "$AIRLOCK" "$TOKEN" 'updateMintRate(uint256)' 0
probe 'current asset migration simulation' 'reverted' "$PROBE_EOA" "$AIRLOCK" 'migrate(address)' "$TOKEN"
