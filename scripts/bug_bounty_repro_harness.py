from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from aetheron_sentinel_l3.execution import ActionExecutor  # noqa: E402
from aetheron_sentinel_l3.governance import (  # noqa: E402
    CryptoAgilityRule,
    ExecutionFailureAlarm,
    GovernanceRegistry,
)
from aetheron_sentinel_l3.interceptor import LiquidityRiskInput, SentinelInterceptor  # noqa: E402
from aetheron_sentinel_l3.policy_pack import PolicyPackManager  # noqa: E402
from aetheron_sentinel_l3.pq_backend import MockDilithiumBackend, RealDilithiumBackend  # noqa: E402
from aetheron_sentinel_l3.rpc_adapter import (  # noqa: E402
    JsonRpcAdapterConfig,
    JsonRpcOnChainAdapter,
    LocalTestnetRpcServer,
)


def build_production_conservative_interceptor() -> SentinelInterceptor:
    try:
        pq = RealDilithiumBackend(seed=bytes([7] * 48))
    except ModuleNotFoundError:
        pq = MockDilithiumBackend()

    manager = PolicyPackManager(
        signing_key="bounty-harness-hmac-key",
        signature_scheme="hmac-sha256",
        secondary_signature_scheme="pq-ext",
        pq_sign_fn=pq.sign,
        pq_verify_fn=pq.verify,
    )
    pack = manager.sign(
        "v0.2.1-conservative",
        "prod",
        {
            "throttle_threshold": 0.35,
            "block_threshold": 0.60,
            "max_hourly_drain_ratio": 0.25,
            "max_global_hourly_drain_ratio": 0.35,
        },
    )
    manager.rollout(pack)

    gov = GovernanceRegistry(
        alarm_threshold=0.20,
        critical_alarm_threshold=0.30,
        execution_failure_threshold=1,
    )
    gov.register_crypto_rule(CryptoAgilityRule(minimum_scheme="pq-ext", grace_days_remaining=0))

    return SentinelInterceptor(
        throttle_threshold=0.35,
        block_threshold=0.60,
        max_hourly_drain_ratio=0.25,
        max_global_hourly_drain_ratio=0.35,
        max_actor_hourly_drain_ratio=0.15,
        policy_pack_manager=manager,
        governance_registry=gov,
    )


def run_baseline_invariant_suite() -> dict:
    results: dict[str, bool] = {}

    # INV-1: Hard Drain & Quorum Block
    interceptor = build_production_conservative_interceptor()
    d_drain = interceptor.evaluate(
        LiquidityRiskInput(
            amount=48_000.0,
            available_liquidity=50_000.0,
            velocity_1h=24_000.0,
            velocity_24h=30_000.0,
            anomaly_score=0.96,
            signer_quorum_ratio=0.45,
            chain_id="base-sepolia",
            asset_symbol="AETH",
            event_id="inv1-drain-quorum",
        )
    )
    results["INV-1_hard_drain_and_quorum_block"] = d_drain.action == "BLOCK"

    # INV-2: Post-Quantum Dual-Sign Enforcement (reject downgrade to hmac-only)
    gov = GovernanceRegistry()
    gov.register_crypto_rule(CryptoAgilityRule(minimum_scheme="pq-ext", grace_days_remaining=0))
    hmac_only_mgr = PolicyPackManager(signing_key="downgrade-key", signature_scheme="hmac-sha256")
    hmac_only_mgr.rollout(hmac_only_mgr.sign("v-downgraded", "prod", {"block_threshold": 0.99}))
    downgraded_interceptor = SentinelInterceptor(policy_pack_manager=hmac_only_mgr, governance_registry=gov)
    d_pq = downgraded_interceptor.evaluate(
        LiquidityRiskInput(
            amount=10.0,
            available_liquidity=100_000.0,
            velocity_1h=10.0,
            velocity_24h=240.0,
            anomaly_score=0.01,
            signer_quorum_ratio=1.0,
            event_id="inv2-pq-downgrade",
        )
    )
    results["INV-2_pq_dual_sign_enforcement"] = (
        d_pq.action == "BLOCK" and "crypto_agility_noncompliant" in d_pq.reasons
    )

    # INV-3: Idempotency Replay Isolation
    replay_interceptor = build_production_conservative_interceptor()
    first = replay_interceptor.evaluate(
        LiquidityRiskInput(
            amount=100.0,
            available_liquidity=100_000.0,
            velocity_1h=100.0,
            velocity_24h=2_400.0,
            anomaly_score=0.01,
            signer_quorum_ratio=1.0,
            event_id="inv3-replay-id",
        )
    )
    second = replay_interceptor.evaluate(
        LiquidityRiskInput(
            amount=100.0,
            available_liquidity=100_000.0,
            velocity_1h=100.0,
            velocity_24h=2_400.0,
            anomaly_score=0.01,
            signer_quorum_ratio=1.0,
            event_id="inv3-replay-id",
        )
    )
    results["INV-3_idempotency_replay_isolation"] = (
        first.action == "ALLOW"
        and second.action == "BLOCK"
        and "duplicate_event" in second.reasons
        and "drop_replay" in second.controls
    )

    # INV-4: Compensating Rollback on Unverified Execution
    alarms: list[ExecutionFailureAlarm] = []
    gov_exec = GovernanceRegistry(
        execution_failure_threshold=1,
        alert_callback=lambda a: alarms.append(a) if isinstance(a, ExecutionFailureAlarm) else None,
    )
    with LocalTestnetRpcServer(chain_id=84532, revert_controls={"enable_withdrawal_caps"}) as server:
        adapter = JsonRpcOnChainAdapter(
            JsonRpcAdapterConfig(chain_name="base-sepolia", endpoint=server.endpoint, confirmations_required=1)
        )
        executor = ActionExecutor(chain_adapter=adapter, failure_budget=0, rollback_on_unverified=True)
        exec_res = executor.apply_controls(("pause_bridge", "enable_withdrawal_caps"))
        gov_exec.record_execution_result(
            verified=exec_res.verified,
            failed_controls=exec_res.failures,
            rolled_back_controls=exec_res.rolled_back,
            op_ids=tuple(r.op_id for r in exec_res.receipts),
        )
        results["INV-4_compensating_rollback_on_unverified"] = (
            not exec_res.verified
            and "pause_bridge" in exec_res.rolled_back
            and len(alarms) == 1
        )

    # INV-5: Kill-Switch Fail-Closed Override
    ks_interceptor = build_production_conservative_interceptor()
    ks_interceptor.engage_kill_switch("inv5-bounty-check")
    d_ks = ks_interceptor.evaluate(
        LiquidityRiskInput(
            amount=1.0,
            available_liquidity=1_000_000.0,
            velocity_1h=1.0,
            velocity_24h=24.0,
            anomaly_score=0.0,
            signer_quorum_ratio=1.0,
            event_id="inv5-ks",
        )
    )
    results["INV-5_kill_switch_fail_closed"] = (
        d_ks.action == "BLOCK" and "kill_switch_engaged" in d_ks.reasons
    )

    return {
        "all_invariants_held": all(results.values()),
        "invariants": results,
    }


def evaluate_poc_file(poc_path: Path) -> dict:
    payload = json.loads(poc_path.read_text(encoding="utf-8"))
    raw_input = payload.get("input", {})
    expected_action = payload.get("expected_action", "BLOCK")
    invariant_id = payload.get("invariant", "CUSTOM")

    interceptor = build_production_conservative_interceptor()
    risk_input = LiquidityRiskInput(
        amount=float(raw_input.get("amount", 0.0)),
        available_liquidity=float(raw_input.get("available_liquidity", 50_000.0)),
        velocity_1h=float(raw_input.get("velocity_1h", 0.0)),
        velocity_24h=float(raw_input.get("velocity_24h", 1_000.0)),
        anomaly_score=float(raw_input.get("anomaly_score", 0.0)),
        signer_quorum_ratio=float(raw_input.get("signer_quorum_ratio", 1.0)),
        chain_health_score=float(raw_input.get("chain_health_score", 1.0)),
        oracle_deviation=float(raw_input.get("oracle_deviation", 0.0)),
        counterparty_risk=float(raw_input.get("counterparty_risk", 0.0)),
        bridge_id=str(raw_input.get("bridge_id", "default")),
        chain_id=str(raw_input.get("chain_id", "base-sepolia")),
        asset_symbol=str(raw_input.get("asset_symbol", "AETH")),
        actor_id=str(raw_input.get("actor_id", "researcher")),
        event_id=raw_input.get("event_id", "poc-event"),
    )
    decision = interceptor.evaluate(risk_input)
    violated = decision.action != expected_action
    return {
        "invariant": invariant_id,
        "expected_action": expected_action,
        "observed_action": decision.action,
        "invariant_violated": violated,
        "decision": asdict(decision),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Aetheron Sentinel L3 Private Bug Bounty Reproduction Harness")
    parser.add_argument("--poc", type=Path, default=None, help="Path to researcher JSON PoC file")
    args = parser.parse_args()

    if args.poc is not None:
        report = evaluate_poc_file(args.poc)
        print(json.dumps(report, indent=2))
        return 1 if report["invariant_violated"] else 0

    report = run_baseline_invariant_suite()
    print(json.dumps(report, indent=2))
    return 0 if report["all_invariants_held"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
