#!/usr/bin/env bash
set -euo pipefail

API="api/releases.json"

if [ ! -f "$API" ]; then
  echo "Error: Release API ($API) not found. Run 'make release-api' first." >&2
  exit 1
fi

echo "=== Sentinel L3: Continuity Forecaster ==="
echo "Analyzing historical velocity for release trajectory..."
echo

# Extract the last 5 releases for velocity calculation
RELEASES=$(jq -c '.releases | sort_by(.version) | tail -n 5' "$API")
COUNT=$(echo "$RELEASES" | jq -s 'length')

if [ "$COUNT" -lt 2 ]; then
  echo "Insufficient data for forecasting. Need at least 2 releases."
  exit 0
fi

# Calculate Governance Churn Velocity
# IMPACT: High Governance Drift Velocity (> 0.6) suggests that the core Sovereignty Layer 
# (sentinel contracts or governance) is rotating too frequently. 
# For a "Sentinel" protocol, this signals a failure in long-term immutability and 
# potentially identifies a "Bootstrapping Phase" where the security surface is 
# not yet anchored. It increases the risk of governance-based exploits and 
# diminishes user trust in protocol stability.
GOV_CHANGES=$(echo "$RELEASES" | jq -s '
  [range(1; length) as $i | 
   if (.[$i].sbom.components | map(select(.name=="governance" or .name=="sentinel_l3")) | map(.address)) != 
      (.[$i-1].sbom.components | map(select(.name=="governance" or .name=="sentinel_l3")) | map(.address)) 
   then 1 else 0 end] | add')

# Calculate Bytecode Innovation Rate
# IMPACT: High Bytecode Innovation Rate indicates a high frequency of logic updates. 
# While it shows active development, it inversely correlates with "Sentinel" reliability. 
# Every bytecode change is a potential vector for logic regressions. 
# High velocity here necessitates an immediate trigger for formal verification and 
# deeper static analysis to ensure the security guarantees of the L3 remain intact.
BYTE_CHANGES=$(echo "$RELEASES" | jq -s '
  [range(1; length) as $i | 
   if (.[$i].sbom.components | map(.bytecode_hash)) != 
      (.[$i-1].sbom.components | map(.bytecode_hash)) 
   then 1 else 0 end] | add')

GOV_VELOCITY=$(echo "scale=2; $GOV_CHANGES / ($COUNT - 1)" | bc)
BYTE_VELOCITY=$(echo "scale=2; $BYTE_CHANGES / ($COUNT - 1)" | bc)

echo "Historical Metrics (Last $COUNT releases):"
echo "- Governance Drift Velocity: $GOV_VELOCITY (changes/release)"
echo "- Bytecode Churn Velocity:   $BYTE_VELOCITY (changes/release)"
echo

echo "--- Next Release Forecast ---"
if (( $(echo "$GOV_VELOCITY > 0.6" | bc -l) )); then
    echo "Sovereignty Risk: HIGH. Expect governance surface rotation."
elif (( $(echo "$GOV_VELOCITY > 0.2" | bc -l) )); then
    echo "Sovereignty Risk: MEDIUM. Governance stability is fluctuating."
else
    echo "Sovereignty Risk: LOW. Governance surface is trending stable."
fi

CONFIDENCE=$(echo "scale=0; ($COUNT * 20)" | bc)
echo "Forecast Confidence: $CONFIDENCE%"