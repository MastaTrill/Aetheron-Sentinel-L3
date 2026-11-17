from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AuditEvent:
    event_id: str | None
    action: str
    risk_score: float
    reasons: tuple[str, ...]
    controls: tuple[str, ...]


class AuditSink(Protocol):
    def record(self, event: AuditEvent) -> None:
        ...


class InMemoryAuditSink:
    def __init__(self) -> None:
        self.events: list[AuditEvent] = []

    def record(self, event: AuditEvent) -> None:
        self.events.append(event)
