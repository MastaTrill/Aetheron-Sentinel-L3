from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any
import json
import time
from urllib import request

from .telemetry import AuditEvent, AuditSink


@dataclass(frozen=True)
class BmnrAlert:
    id: str
    type: str
    severity: str
    data: dict[str, Any]
    timestamp: float
    bridge_id: str = "default"


@dataclass(frozen=True)
class CorrelatedAlert:
    source: str
    alert_id: str
    correlation_key: str
    severity: str
    action: str
    bridge_id: str
    timestamp: float
    details: dict[str, Any]


class BmnrAlertCorrelationEngine:
    def __init__(self, sink: AuditSink, ttl_seconds: int = 300) -> None:
        self.sink = sink
        self.ttl_seconds = ttl_seconds
        self._pending: dict[str, CorrelatedAlert] = {}

    def ingest_bmnr_alert(self, alert: BmnrAlert) -> CorrelatedAlert:
        correlated = CorrelatedAlert(
            source="bmnr",
            alert_id=alert.id,
            correlation_key=self._correlation_key(alert.bridge_id, alert.type),
            severity=alert.severity,
            action=self._recommended_action(alert),
            bridge_id=alert.bridge_id,
            timestamp=alert.timestamp,
            details=alert.data,
        )
        self._pending[correlated.correlation_key] = correlated
        self._prune(alert.timestamp)
        self._record("bmnr_alert_ingested", correlated)
        return correlated

    def correlate_sentinel_decision(
        self,
        *,
        event_id: str | None,
        bridge_id: str,
        action: str,
        risk_score: float,
        timestamp: float | None = None,
    ) -> CorrelatedAlert | None:
        now = timestamp if timestamp is not None else time.time()
        self._prune(now)
        match = self._pending.get(self._correlation_key(bridge_id, "anomaly"))
        if match is None:
            return None

        correlated = CorrelatedAlert(
            source="sentinel",
            alert_id=event_id or match.alert_id,
            correlation_key=match.correlation_key,
            severity=match.severity,
            action=action,
            bridge_id=bridge_id,
            timestamp=now,
            details={
                "matched_bmnr_alert_id": match.alert_id,
                "risk_score": risk_score,
            },
        )
        self._record("sentinel_bmnr_correlation", correlated)
        return correlated

    def _record(self, label: str, correlated: CorrelatedAlert) -> None:
        self.sink.record(
            AuditEvent(
                event_id=correlated.alert_id,
                action=label,
                risk_score=1.0 if correlated.severity in {"high", "critical"} else 0.5,
                reasons=(correlated.correlation_key, correlated.source, correlated.action),
                controls=("notify_bmnr", "persist_correlation"),
            )
        )

    def _prune(self, now: float) -> None:
        expired = [
            key for key, value in self._pending.items() if now - value.timestamp > self.ttl_seconds
        ]
        for key in expired:
            del self._pending[key]

    @staticmethod
    def _correlation_key(bridge_id: str, alert_type: str) -> str:
        return f"{bridge_id}:{alert_type}"

    @staticmethod
    def _recommended_action(alert: BmnrAlert) -> str:
        if alert.severity in {"high", "critical"}:
            return "pause"
        if alert.type == "resume":
            return "resume"
        return "monitor"


class BmnrWsIngestionClient:
    def __init__(self, ws_url: str, sink: AuditSink, correlation_engine: BmnrAlertCorrelationEngine) -> None:
        self.ws_url = ws_url
        self.sink = sink
        self.correlation_engine = correlation_engine

    def ingest_message(self, raw_message: str) -> CorrelatedAlert:
        payload = json.loads(raw_message)
        alert = BmnrAlert(
            id=str(payload["id"]),
            type=str(payload["type"]),
            severity=str(payload["severity"]),
            data=dict(payload.get("data", {})),
            timestamp=float(payload.get("timestamp", time.time())),
            bridge_id=str(payload.get("bridge_id", "default")),
        )
        correlated = self.correlation_engine.ingest_bmnr_alert(alert)
        self.sink.record(
            AuditEvent(
                event_id=alert.id,
                action="bmnr_ws_ingest",
                risk_score=1.0 if alert.severity in {"high", "critical"} else 0.4,
                reasons=(alert.type, alert.severity, alert.bridge_id),
                controls=("store_alert",),
            )
        )
        return correlated

    def ingest_http_payload(self, payload: dict[str, Any]) -> CorrelatedAlert:
        return self.ingest_message(json.dumps(payload))
