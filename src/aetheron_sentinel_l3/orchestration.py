from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Callable

from .bmnr_ingestion import BmnrAlert, BmnrAlertCorrelationEngine, CorrelatedAlert
from .execution import ActionExecutor, ExecutionResult
from .telemetry import AuditEvent, AuditSink


@dataclass(frozen=True)
class OrchestrationDecision:
    action: str
    reason: str
    correlated: CorrelatedAlert | None
    execution: ExecutionResult | None


class PauseResumeOrchestrator:
    def __init__(
        self,
        executor: ActionExecutor,
        sink: AuditSink,
        correlation_engine: BmnrAlertCorrelationEngine,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.executor = executor
        self.sink = sink
        self.correlation_engine = correlation_engine
        self._clock = clock

    def handle_bmnr_alert(self, alert: BmnrAlert) -> OrchestrationDecision:
        correlated = self.correlation_engine.ingest_bmnr_alert(alert)
        if correlated.action == "pause":
            execution = self.executor.apply_controls(("pause_bridge",))
            self._record("orchestrated_pause", alert.id, 1.0, correlated, execution)
            return OrchestrationDecision(
                "pause_bridge", "bmnr_high_severity", correlated, execution
            )
        if correlated.action == "resume":
            execution = self.executor.apply_controls(("resume_bridge",))
            self._record("orchestrated_resume", alert.id, 0.4, correlated, execution)
            return OrchestrationDecision(
                "resume_bridge", "bmnr_resume_signal", correlated, execution
            )
        self._record("orchestrated_monitor", alert.id, 0.2, correlated, None)
        return OrchestrationDecision("monitor", "bmnr_low_severity", correlated, None)

    def handle_sentinel_decision(
        self,
        *,
        event_id: str | None,
        bridge_id: str,
        action: str,
        risk_score: float,
    ) -> OrchestrationDecision:
        correlated = self.correlation_engine.correlate_sentinel_decision(
            event_id=event_id,
            bridge_id=bridge_id,
            action=action,
            risk_score=risk_score,
            timestamp=self._clock(),
        )

        if action == "BLOCK":
            execution = self.executor.apply_controls(("pause_bridge",))
            self._record("sentinel_pause", event_id, risk_score, correlated, execution)
            return OrchestrationDecision(
                "pause_bridge", "sentinel_block", correlated, execution
            )

        # correlated is non-None only when a pending BMNR resume alert was matched
        # (correlate_sentinel_decision keys ALLOW→bridge_id:resume)
        if action == "ALLOW" and correlated is not None:
            execution = self.executor.apply_controls(("resume_bridge",))
            self._record("sentinel_resume", event_id, risk_score, correlated, execution)
            return OrchestrationDecision(
                "resume_bridge", "sentinel_allow_after_resume", correlated, execution
            )

        self._record("sentinel_monitor", event_id, risk_score, correlated, None)
        return OrchestrationDecision(
            "monitor", "sentinel_non_blocking", correlated, None
        )

    def _record(
        self,
        action: str,
        event_id: str | None,
        risk_score: float,
        correlated: CorrelatedAlert | None,
        execution: ExecutionResult | None,
    ) -> None:
        reasons = [action]
        controls: list[str] = []

        if correlated is not None:
            reasons.extend(
                [correlated.correlation_key, correlated.source, correlated.action]
            )
        if execution is not None:
            controls.extend(execution.applied)
            controls.extend(execution.rolled_back)
            controls.extend(execution.failures)
        if not controls:
            controls.append("monitor")

        self.sink.record(
            AuditEvent(
                event_id=event_id,
                action=action,
                risk_score=risk_score,
                reasons=tuple(reasons),
                controls=tuple(controls),
            )
        )
