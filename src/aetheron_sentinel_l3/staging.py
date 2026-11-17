from __future__ import annotations

import threading
from dataclasses import dataclass

from .execution import ActionExecutor
from .governance import CryptoAgilityRule, DriftAlarm, ExecutionFailureAlarm, GovernanceRegistry
from .interceptor import LiquidityRiskInput, SentinelInterceptor
from .policy_pack import PolicyPackManager
from .pq_backend import MockDilithiumBackend, PQBackend, RealDilithiumBackend
from .rpc_adapter import JsonRpcAdapterConfig, JsonRpcOnChainAdapter, LocalTestnetRpcServer
from .simulation import AdversarialSimulator, TournamentKPI
from .state import InMemoryStateBackend, RedisStateBackend
from .telemetry import InMemoryAuditSink


@dataclass(frozen=True)
class StagingWindowReport:
    window_id: str
    chain_id: int
    block_height: int
    rpc_finality_verified: bool
    rpc_compensating_rollback_verified: bool
    pq_provider_name: str
    dual_sign_rollout_verified: bool
    dual_sign_auto_rollback_verified: bool
    idempotency_flood_blocked: int
    redis_partition_recovered: bool
    kill_switch_drill_verified: bool
    execution_failure_alert_verified: bool
    tournament_kpi: TournamentKPI
    passed: bool


class _StagingFakePipeline:
    def __init__(self, parent: "_StagingFakeRedis") -> None:
        self.parent = parent
        self._key: str | None = None
        self._amount: float = 0.0

    def incrbyfloat(self, key: str, amount: float) -> None:
        self._key = key
        self._amount = amount

    def expire(self, key: str, ttl: int) -> None:
        _ = (key, ttl)

    def execute(self) -> list:
        with self.parent.lock:
            if self.parent.failures_remaining > 0:
                self.parent.failures_remaining -= 1
                raise RuntimeError("simulated redis partition")
            assert self._key is not None
            self.parent.values[self._key] = self.parent.values.get(self._key, 0.0) + self._amount
            return [self.parent.values[self._key], True]


class _StagingFakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, float] = {}
        self.events: dict[str, bool] = {}
        self.failures_remaining = 0
        self.lock = threading.Lock()

    def set(self, name: str, value: str, ex: int, nx: bool) -> bool:
        _ = (value, ex, nx)
        with self.lock:
            if self.failures_remaining > 0:
                self.failures_remaining -= 1
                raise RuntimeError("simulated redis partition")
            if name in self.events:
                return False
            self.events[name] = True
            return True

    def pipeline(self) -> _StagingFakePipeline:
        return _StagingFakePipeline(self)


class StagingWindowRunner:
    """Executes end-to-end staging validation windows for Bug Bounty Readiness."""

    def __init__(self, prefer_real_pq: bool = True) -> None:
        self.prefer_real_pq = prefer_real_pq

    def _build_pq_backend(self, seed_byte: int) -> tuple[PQBackend, str]:
        if self.prefer_real_pq:
            try:
                seed = bytes([seed_byte] * 48)
                return RealDilithiumBackend(seed=seed), "RealDilithiumBackend(dilithium_py.Dilithium2)"
            except ModuleNotFoundError:
                pass
        return MockDilithiumBackend(), "MockDilithiumBackend"

    def run_window(self, window_id: str, seed_byte: int = 1) -> StagingWindowReport:
        # 1. Live HTTP JSON-RPC Chain Wiring (finality + compensating rollback)
        with LocalTestnetRpcServer(chain_id=84532, initial_block=12_500_000, blocks_per_poll=1) as rpc_server:
            config = JsonRpcAdapterConfig(
                chain_name="base-sepolia",
                endpoint=rpc_server.endpoint,
                confirmations_required=2,
                poll_attempts=3,
                expected_chain_id=84532,
            )
            adapter = JsonRpcOnChainAdapter(config)
            status = adapter.probe_endpoint()
            exec_ok = ActionExecutor(chain_adapter=adapter, failure_budget=0, rollback_on_unverified=True)
            res_ok = exec_ok.apply_controls(("pause_bridge", "enable_withdrawal_caps"))
            rpc_finality_verified = status.healthy and res_ok.verified and len(res_ok.applied) == 2

            # Trigger revert on second control to verify compensating rollback over HTTP JSON-RPC
            rpc_server.revert_controls.add("enable_withdrawal_caps")
            res_revert = exec_ok.apply_controls(("pause_bridge", "enable_withdrawal_caps"))
            rpc_rollback_verified = (
                not res_revert.verified
                and "pause_bridge" in res_revert.rolled_back
                and any(r["control"] == "pause_bridge" for r in rpc_server.rollbacks)
            )
            chain_id = status.chain_id
            block_height = status.block_number

        # 2. Post-Quantum Dual-Sign Policy Pack Rollout & Governance Auto-Rollback Drill
        pq_backend, pq_name = self._build_pq_backend(seed_byte)
        manager = PolicyPackManager(
            signing_key=f"staging-key-{window_id}",
            signature_scheme="hmac-sha256",
            secondary_signature_scheme="pq-ext",
            pq_sign_fn=pq_backend.sign,
            pq_verify_fn=pq_backend.verify,
        )
        pack_v1 = manager.sign("v1.0-baseline", "prod", {"throttle_threshold": 0.45, "block_threshold": 0.70})
        pack_v2 = manager.sign("v2.0-tight", "prod", {"throttle_threshold": 0.35, "block_threshold": 0.55})
        manager.rollout(pack_v1)
        manager.rollout(pack_v2)
        dual_sign_rollout_verified = (
            manager.active is not None
            and manager.active.version == "v2.0-tight"
            and manager.active.secondary_signature_scheme == "pq-ext"
            and manager.verify(pack_v2)
        )

        drift_alerts: list[DriftAlarm] = []
        exec_alerts: list[ExecutionFailureAlarm] = []

        def on_alert(alarm) -> None:
            if isinstance(alarm, DriftAlarm):
                drift_alerts.append(alarm)
            elif isinstance(alarm, ExecutionFailureAlarm):
                exec_alerts.append(alarm)

        gov = GovernanceRegistry(
            alarm_threshold=0.20,
            critical_alarm_threshold=0.30,
            execution_failure_threshold=1,
            alert_callback=on_alert,
        )
        gov.register_crypto_rule(CryptoAgilityRule(minimum_scheme="pq-ext", grace_days_remaining=0))

        audit_sink = InMemoryAuditSink()
        interceptor = SentinelInterceptor(
            policy_pack_manager=manager,
            governance_registry=gov,
            audit_sink=audit_sink,
        )
        # Low-risk probe causes |risk_score - 0.5| >= 0.30 -> critical drift -> auto-rollback from v2.0-tight to v1.0-baseline
        drift_decision = interceptor.evaluate(
            LiquidityRiskInput(
                amount=50.0,
                available_liquidity=100_000.0,
                velocity_1h=100.0,
                velocity_24h=9_600.0,
                anomaly_score=0.01,
                signer_quorum_ratio=1.0,
                chain_id="base-sepolia",
                asset_symbol="ETH",
                event_id=f"{window_id}-drift-probe",
            )
        )
        dual_sign_auto_rollback_verified = (
            "policy_pack_auto_rollback" in drift_decision.reasons
            and "crypto_agility_noncompliant" not in drift_decision.reasons
            and manager.active is not None
            and manager.active.version == "v1.0-baseline"
            and any(a.severity == "critical" for a in drift_alerts)
        )

        # 3. Chaos & Abuse Testing: Concurrent Idempotency Flood & Redis Partition Simulation
        fake_redis = _StagingFakeRedis()
        redis_backend = RedisStateBackend(fake_redis, max_retries=2)
        chaos_interceptor = SentinelInterceptor(state_backend=redis_backend)

        flood_decisions: list[str] = []
        flood_lock = threading.Lock()

        def flood_worker() -> None:
            for _ in range(10):
                d = chaos_interceptor.evaluate(
                    LiquidityRiskInput(
                        amount=500.0,
                        available_liquidity=100_000.0,
                        velocity_1h=500.0,
                        velocity_24h=12_000.0,
                        anomaly_score=0.1,
                        signer_quorum_ratio=1.0,
                        event_id=f"{window_id}-flood-event",
                    )
                )
                with flood_lock:
                    flood_decisions.append(d.action)

        threads = [threading.Thread(target=flood_worker) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        idempotency_flood_blocked = sum(1 for a in flood_decisions if a == "BLOCK")

        # Sustained partition (exceeds max_retries=2) followed by partition healing
        fake_redis.failures_remaining = 5
        partition_raised = False
        try:
            redis_backend.register_event(f"{window_id}-partition-test", 60)
        except RuntimeError:
            partition_raised = True
        # Now 2 failures remain -> should succeed within max_retries=2
        recovered_ok = redis_backend.register_event(f"{window_id}-partition-test", 60)
        counter_recovered = redis_backend.increment_counter(f"{window_id}:counter", 25.0, 60) == 25.0
        redis_partition_recovered = partition_raised and recovered_ok and counter_recovered

        # 4. Operational Controls: Kill-Switch Drill, Execution Failure Alerting & Tournament KPIs
        interceptor.engage_kill_switch(reason=f"staging_drill_{window_id}")
        ks_decision = interceptor.evaluate(
            LiquidityRiskInput(
                amount=10.0,
                available_liquidity=100_000.0,
                velocity_1h=10.0,
                velocity_24h=240.0,
                anomaly_score=0.0,
                signer_quorum_ratio=1.0,
                event_id=f"{window_id}-ks-probe",
            )
        )
        interceptor.release_kill_switch()
        post_ks_decision = interceptor.evaluate(
            LiquidityRiskInput(
                amount=10.0,
                available_liquidity=100_000.0,
                velocity_1h=10.0,
                velocity_24h=240.0,
                anomaly_score=0.0,
                signer_quorum_ratio=1.0,
                event_id=f"{window_id}-post-ks-probe",
            )
        )
        kill_switch_drill_verified = (
            ks_decision.action == "BLOCK"
            and "kill_switch_engaged" in ks_decision.reasons
            and post_ks_decision.action == "ALLOW"
        )

        # Execution failure alert verification
        with LocalTestnetRpcServer(chain_id=84532, revert_controls={"pause_bridge"}) as failing_rpc:
            fail_adapter = JsonRpcOnChainAdapter(
                JsonRpcAdapterConfig(chain_name="base-sepolia", endpoint=failing_rpc.endpoint)
            )
            fail_executor = ActionExecutor(chain_adapter=fail_adapter, failure_budget=0, rollback_on_unverified=True)
            alert_interceptor = SentinelInterceptor(governance_registry=gov, executor=fail_executor)
            fail_decision = alert_interceptor.evaluate(
                LiquidityRiskInput(
                    amount=48_000.0,
                    available_liquidity=50_000.0,
                    velocity_1h=25_000.0,
                    velocity_24h=30_000.0,
                    anomaly_score=0.98,
                    signer_quorum_ratio=0.4,
                    event_id=f"{window_id}-exec-fail",
                )
            )
            execution_failure_alert_verified = (
                "execution_verification_failed" in fail_decision.reasons and len(exec_alerts) >= 1
            )

        # Adversarial tournament KPIs (benign traffic precedes bridge-draining attack wave)
        sim = AdversarialSimulator(SentinelInterceptor(state_backend=InMemoryStateBackend()))
        scenarios = [
            (
                LiquidityRiskInput(
                    amount=100.0,
                    available_liquidity=50_000.0,
                    velocity_1h=200.0,
                    velocity_24h=9_600.0,
                    anomaly_score=0.02,
                    signer_quorum_ratio=1.0,
                    event_id=f"{window_id}-benign-1",
                ),
                False,
                0.0,
            ),
            (
                LiquidityRiskInput(
                    amount=150.0,
                    available_liquidity=50_000.0,
                    velocity_1h=250.0,
                    velocity_24h=9_600.0,
                    anomaly_score=0.03,
                    signer_quorum_ratio=1.0,
                    event_id=f"{window_id}-benign-2",
                ),
                False,
                0.0,
            ),
            (
                LiquidityRiskInput(
                    amount=48_000.0,
                    available_liquidity=50_000.0,
                    velocity_1h=24_000.0,
                    velocity_24h=30_000.0,
                    anomaly_score=0.96,
                    signer_quorum_ratio=0.45,
                    event_id=f"{window_id}-atk-1",
                ),
                True,
                1_250_000.0,
            ),
            (
                LiquidityRiskInput(
                    amount=22_000.0,
                    available_liquidity=50_000.0,
                    velocity_1h=18_000.0,
                    velocity_24h=24_000.0,
                    anomaly_score=0.88,
                    signer_quorum_ratio=0.60,
                    event_id=f"{window_id}-atk-2",
                ),
                True,
                750_000.0,
            ),
        ]
        kpi = sim.tournament(scenarios)

        passed = (
            rpc_finality_verified
            and rpc_rollback_verified
            and dual_sign_rollout_verified
            and dual_sign_auto_rollback_verified
            and idempotency_flood_blocked == 199
            and redis_partition_recovered
            and kill_switch_drill_verified
            and execution_failure_alert_verified
            and kpi.tpr == 1.0
            and kpi.fpr == 0.0
        )

        return StagingWindowReport(
            window_id=window_id,
            chain_id=chain_id,
            block_height=block_height,
            rpc_finality_verified=rpc_finality_verified,
            rpc_compensating_rollback_verified=rpc_rollback_verified,
            pq_provider_name=pq_name,
            dual_sign_rollout_verified=dual_sign_rollout_verified,
            dual_sign_auto_rollback_verified=dual_sign_auto_rollback_verified,
            idempotency_flood_blocked=idempotency_flood_blocked,
            redis_partition_recovered=redis_partition_recovered,
            kill_switch_drill_verified=kill_switch_drill_verified,
            execution_failure_alert_verified=execution_failure_alert_verified,
            tournament_kpi=kpi,
            passed=passed,
        )

    def run_two_clean_staging_windows(self) -> tuple[StagingWindowReport, StagingWindowReport]:
        w1 = self.run_window("staging-window-1", seed_byte=11)
        w2 = self.run_window("staging-window-2", seed_byte=22)
        return w1, w2
