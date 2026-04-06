from __future__ import annotations

from dataclasses import dataclass

from .calibration import AdaptiveCalibrator, ThresholdConfig
from .execution import ActionExecutor, ExecutionResult
from .governance import CalibrationRecord, GovernanceRegistry
from .policy import PolicyEngine
from .policy_pack import PolicyPackManager
from .state import InMemoryStateBackend, StateBackend
from .telemetry import AuditEvent, AuditSink


@dataclass(frozen=True)
class LiquidityRiskInput:
    amount: float
    available_liquidity: float
    velocity_1h: float
    velocity_24h: float
    anomaly_score: float
    signer_quorum_ratio: float
    chain_health_score: float = 1.0
    oracle_deviation: float = 0.0
    counterparty_risk: float = 0.0
    bridge_id: str = "default"
    chain_id: str = "default-chain"
    asset_symbol: str = "UNKNOWN"
    actor_id: str = "unknown-actor"
    event_id: str | None = None


@dataclass(frozen=True)
class InterceptorDecision:
    action: str
    risk_score: float
    reasons: tuple[str, ...]
    controls: tuple[str, ...]
    escalate: bool
    risk_factors: tuple[tuple[str, float], ...]
    execution: ExecutionResult | None


@dataclass(frozen=True)
class PolicyProfile:
    name: str
    throttle_threshold: float
    block_threshold: float
    max_hourly_drain_ratio: float
    max_global_hourly_drain_ratio: float
    max_actor_hourly_drain_ratio: float


class SentinelInterceptor:
    PROFILES: dict[str, PolicyProfile] = {
        "aggressive": PolicyProfile("aggressive", 0.55, 0.8, 0.45, 0.55, 0.25),
        "balanced": PolicyProfile("balanced", 0.45, 0.7, 0.35, 0.45, 0.2),
        "conservative": PolicyProfile("conservative", 0.35, 0.6, 0.25, 0.35, 0.15),
    }

    def __init__(
        self,
        throttle_threshold: float = 0.45,
        block_threshold: float = 0.7,
        max_hourly_drain_ratio: float = 0.35,
        max_global_hourly_drain_ratio: float = 0.45,
        max_actor_hourly_drain_ratio: float = 0.2,
        state_backend: StateBackend | None = None,
        calibrator: AdaptiveCalibrator | None = None,
        policy_engine: PolicyEngine | None = None,
        policy_pack_manager: PolicyPackManager | None = None,
        governance_registry: GovernanceRegistry | None = None,
        executor: ActionExecutor | None = None,
        audit_sink: AuditSink | None = None,
        counter_ttl_seconds: int = 3600,
        idempotency_ttl_seconds: int = 3600,
    ) -> None:
        self.throttle_threshold = throttle_threshold
        self.block_threshold = block_threshold
        self.max_hourly_drain_ratio = max_hourly_drain_ratio
        self.max_global_hourly_drain_ratio = max_global_hourly_drain_ratio
        self.max_actor_hourly_drain_ratio = max_actor_hourly_drain_ratio
        self.state_backend = state_backend or InMemoryStateBackend()
        self.calibrator = calibrator or AdaptiveCalibrator(
            ThresholdConfig(throttle_threshold, block_threshold, max_hourly_drain_ratio, max_global_hourly_drain_ratio)
        )
        self.policy_engine = policy_engine or PolicyEngine()
        self.policy_pack_manager = policy_pack_manager
        self.governance_registry = governance_registry
        self.executor = executor
        self.audit_sink = audit_sink
        self.counter_ttl_seconds = counter_ttl_seconds
        self.idempotency_ttl_seconds = idempotency_ttl_seconds

    @classmethod
    def from_profile(cls, profile_name: str) -> "SentinelInterceptor":
        p = cls.PROFILES[profile_name.lower()]
        return cls(
            throttle_threshold=p.throttle_threshold,
            block_threshold=p.block_threshold,
            max_hourly_drain_ratio=p.max_hourly_drain_ratio,
            max_global_hourly_drain_ratio=p.max_global_hourly_drain_ratio,
            max_actor_hourly_drain_ratio=p.max_actor_hourly_drain_ratio,
        )

    def evaluate(self, payload: LiquidityRiskInput) -> InterceptorDecision:
        reasons: list[str] = []
        liquidity = max(payload.available_liquidity, 1e-9)

        if payload.event_id and not self.state_backend.register_event(payload.event_id, self.idempotency_ttl_seconds):
            decision = InterceptorDecision("BLOCK", 1.0, ("duplicate_event",), ("drop_replay",), True, (), None)
            self._audit(payload, decision)
            return decision

        thresholds = self.calibrator.get_thresholds(payload.chain_id, payload.asset_symbol)
        thresholds = self._apply_policy_pack_threshold_overrides(payload, thresholds, reasons)

        crypto_noncompliant = False
        if self.governance_registry is not None and self.policy_pack_manager is not None and self.policy_pack_manager.active is not None:
            pack = self.policy_pack_manager.active
            schemes = [pack.signature_scheme]
            if pack.secondary_signature_scheme is not None:
                schemes.append(pack.secondary_signature_scheme)
            if not self.governance_registry.is_crypto_compliant(schemes):
                reasons.append("crypto_agility_noncompliant")
                crypto_noncompliant = True

        drain_ratio = min(payload.amount / liquidity, 1.5)
        velocity_ratio = min(payload.velocity_1h / max(payload.velocity_24h / 24, 1e-6), 10)
        anomaly = min(max(payload.anomaly_score, 0), 1)
        quorum_penalty = 1 - min(max(payload.signer_quorum_ratio, 0), 1)
        chain_penalty = 1 - min(max(payload.chain_health_score, 0), 1)
        oracle_risk = min(max(payload.oracle_deviation, 0), 1)
        counterparty_risk = min(max(payload.counterparty_risk, 0), 1)

        if drain_ratio > 0.2:
            reasons.append("high_drain_ratio")
        if velocity_ratio > 3:
            reasons.append("abnormal_withdrawal_velocity")
        if anomaly > 0.65:
            reasons.append("high_anomaly_score")
        if quorum_penalty > 0.25:
            reasons.append("low_signer_quorum")

        bridge_outflow = self.state_backend.increment_counter(
            f"bridge:{payload.bridge_id}:hourly_outflow", payload.amount, self.counter_ttl_seconds
        )
        global_outflow = self.state_backend.increment_counter("global:hourly_outflow", payload.amount, self.counter_ttl_seconds)
        actor_outflow = self.state_backend.increment_counter(
            f"actor:{payload.actor_id}:hourly_outflow", payload.amount, self.counter_ttl_seconds
        )

        if bridge_outflow / liquidity >= thresholds.max_hourly_drain_ratio:
            reasons.append("bridge_circuit_breaker_triggered")
        if global_outflow / liquidity >= thresholds.max_global_hourly_drain_ratio:
            reasons.append("global_circuit_breaker_triggered")
        if actor_outflow / liquidity >= self.max_actor_hourly_drain_ratio:
            reasons.append("actor_circuit_breaker_triggered")

        risk_components = {
            "drain_ratio": 0.25 * min(drain_ratio, 1),
            "velocity_ratio": 0.2 * min(velocity_ratio / 5, 1),
            "anomaly": 0.2 * anomaly,
            "quorum_penalty": 0.1 * quorum_penalty,
            "oracle_risk": 0.1 * oracle_risk,
            "counterparty_risk": 0.1 * counterparty_risk,
            "chain_penalty": 0.05 * chain_penalty,
        }
        risk_score = max(0.0, min(sum(risk_components.values()), 1.0))

        self.calibrator.update(observed_risk=risk_score, expected_risk=0.5)
        self._governance_update(payload, risk_score, thresholds.block_threshold, reasons)

        policy_result = self.policy_engine.evaluate(
            drain_ratio=drain_ratio,
            signer_quorum_ratio=payload.signer_quorum_ratio,
            anomaly_score=anomaly,
            chain_health_score=payload.chain_health_score,
        )
        reasons.extend(policy_result.reasons)

        if (
            "bridge_circuit_breaker_triggered" in reasons
            or "global_circuit_breaker_triggered" in reasons
            or "actor_circuit_breaker_triggered" in reasons
            or drain_ratio > 0.9
            or anomaly > 0.95
            or policy_result.force_action == "BLOCK"
            or crypto_noncompliant
        ):
            action = "BLOCK"
        elif risk_score >= thresholds.block_threshold:
            action = "BLOCK"
        elif risk_score >= thresholds.throttle_threshold:
            action = "THROTTLE"
        else:
            action = "ALLOW"

        controls = self._recommend_controls(reasons, action)
        execution = self.executor.apply_controls(controls) if action in {"BLOCK", "THROTTLE"} and self.executor else None
        decision = InterceptorDecision(
            action,
            risk_score,
            tuple(sorted(set(reasons))),
            controls,
            action == "BLOCK" or "high_anomaly_score" in reasons,
            tuple(sorted(risk_components.items())),
            execution,
        )
        self._audit(payload, decision)
        return decision

    def _apply_policy_pack_threshold_overrides(
        self,
        payload: LiquidityRiskInput,
        thresholds: ThresholdConfig,
        reasons: list[str],
    ) -> ThresholdConfig:
        if self.policy_pack_manager is None or self.policy_pack_manager.active is None:
            return thresholds

        pack = self.policy_pack_manager.active
        apply_pack = True
        if pack.stage == "canary":
            token = payload.event_id or payload.actor_id
            apply_pack = (sum(ord(c) for c in token) % 100) < 10
            if not apply_pack:
                reasons.append("policy_pack_canary_skipped")

        if not apply_pack:
            return thresholds

        reasons.append(f"policy_pack:{pack.version}:{pack.stage}")
        return ThresholdConfig(
            throttle_threshold=pack.rules.get("throttle_threshold", thresholds.throttle_threshold),
            block_threshold=pack.rules.get("block_threshold", thresholds.block_threshold),
            max_hourly_drain_ratio=pack.rules.get("max_hourly_drain_ratio", thresholds.max_hourly_drain_ratio),
            max_global_hourly_drain_ratio=pack.rules.get(
                "max_global_hourly_drain_ratio", thresholds.max_global_hourly_drain_ratio
            ),
        )

    def _governance_update(self, payload: LiquidityRiskInput, risk_score: float, block_threshold: float, reasons: list[str]) -> None:
        if self.governance_registry is None:
            return
        drift = abs(risk_score - 0.5)
        self.governance_registry.record_calibration(
            CalibrationRecord(payload.chain_id, payload.asset_symbol, drift, block_threshold)
        )
        if self.governance_registry.alarms and self.governance_registry.alarms[-1].severity == "critical":
            reasons.append("governance_critical_drift")
            if self.policy_pack_manager is not None and self.policy_pack_manager.has_history:
                self.policy_pack_manager.rollback()
                reasons.append("policy_pack_auto_rollback")

    def _audit(self, payload: LiquidityRiskInput, decision: InterceptorDecision) -> None:
        if self.audit_sink is None:
            return
        self.audit_sink.record(
            AuditEvent(payload.event_id, decision.action, decision.risk_score, decision.reasons, decision.controls)
        )

    @staticmethod
    def _recommend_controls(reasons: list[str], action: str) -> tuple[str, ...]:
        controls: set[str] = set()
        mapping = {
            "high_drain_ratio": "enable_withdrawal_caps",
            "abnormal_withdrawal_velocity": "add_time_delay",
            "high_anomaly_score": "require_human_approval",
            "low_signer_quorum": "raise_signer_quorum",
            "bridge_circuit_breaker_triggered": "pause_bridge",
            "global_circuit_breaker_triggered": "activate_network_guard",
            "actor_circuit_breaker_triggered": "freeze_actor",
            "duplicate_event": "drop_replay",
            "governance_critical_drift": "freeze_policy_changes",
            "crypto_agility_noncompliant": "rotate_signature_scheme",
        }
        for reason, control in mapping.items():
            if reason in reasons:
                controls.add(control)
        if action == "ALLOW":
            controls.add("monitor")
        return tuple(sorted(controls))
