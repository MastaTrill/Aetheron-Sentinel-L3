from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Protocol
import json
import threading
import time


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


class JsonlAuditSink:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self.lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, event: AuditEvent) -> None:
        payload = asdict(event)
        payload["recorded_at"] = time.time()

        with self.lock:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(payload) + "\n")
