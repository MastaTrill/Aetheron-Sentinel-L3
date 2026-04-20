"""Audit event model, sink protocol, and concrete in-memory and JSONL sink implementations."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Protocol
import json
import threading
import time


@dataclass(frozen=True)
class AuditEvent:
    """Immutable audit record emitted whenever an orchestration action is taken."""

    event_id: str | None
    action: str
    risk_score: float
    reasons: tuple[str, ...]
    controls: tuple[str, ...]


class AuditSink(Protocol):
    """Protocol for audit sinks that accept and persist AuditEvent records."""

    def record(self, event: AuditEvent) -> None:
        """Persist a single audit event."""


class InMemoryAuditSink:
    """Audit sink that accumulates events in a list; suitable for testing."""

    def __init__(self) -> None:
        """Initialize with an empty event list."""
        self.events: list[AuditEvent] = []

    def record(self, event: AuditEvent) -> None:
        """Append the event to the in-memory list."""
        self.events.append(event)


class JsonlAuditSink:
    """Thread-safe audit sink that appends events as newline-delimited JSON to a file."""

    def __init__(self, path: str) -> None:
        """Initialize the sink and create parent directories if they do not exist."""
        self.path = Path(path)
        self.lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, event: AuditEvent) -> None:
        """Serialize the event to JSON and append it to the JSONL file under a write lock."""
        payload = asdict(event)
        payload["recorded_at"] = time.time()

        with self.lock:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(payload) + "\n")
