from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Protocol


class StateBackend(Protocol):
    """Durable counter + idempotency backend abstraction."""

    def register_event(self, event_key: str, ttl_seconds: int) -> bool:
        """Returns True if event key is new, False if duplicate within TTL."""

    def increment_counter(self, key: str, amount: float, ttl_seconds: int) -> float:
        """Increments counter and returns updated value."""

    def reset(self) -> None:
        """Resets backend state (primarily for tests)."""


@dataclass
class _Entry:
    value: float
    expires_at: float


class InMemoryStateBackend:
    """In-memory backend with TTL semantics and idempotent key registry."""

    def __init__(self, now_fn: Callable[[], float] | None = None) -> None:
        self._now_fn = now_fn or time.time
        self._counters: dict[str, _Entry] = {}
        self._events: dict[str, float] = {}

    def register_event(self, event_key: str, ttl_seconds: int) -> bool:
        now = self._now_fn()
        self._gc(now)
        expires_at = now + ttl_seconds
        current = self._events.get(event_key)
        if current is not None and current > now:
            return False
        self._events[event_key] = expires_at
        return True

    def increment_counter(self, key: str, amount: float, ttl_seconds: int) -> float:
        now = self._now_fn()
        self._gc(now)
        expires_at = now + ttl_seconds
        existing = self._counters.get(key)
        if existing is None or existing.expires_at <= now:
            self._counters[key] = _Entry(value=amount, expires_at=expires_at)
        else:
            self._counters[key] = _Entry(value=existing.value + amount, expires_at=max(existing.expires_at, expires_at))
        return self._counters[key].value

    def reset(self) -> None:
        self._counters.clear()
        self._events.clear()

    def _gc(self, now: float) -> None:
        self._events = {k: v for k, v in self._events.items() if v > now}
        self._counters = {k: v for k, v in self._counters.items() if v.expires_at > now}


class RedisStateBackend:
    """Redis backend for distributed breaker state and idempotency with retries."""

    def __init__(self, redis_client, max_retries: int = 2) -> None:
        self._redis = redis_client
        self._max_retries = max_retries

    def register_event(self, event_key: str, ttl_seconds: int) -> bool:
        return bool(
            self._retry(lambda: self._redis.set(name=f"event:{event_key}", value="1", ex=ttl_seconds, nx=True))
        )

    def increment_counter(self, key: str, amount: float, ttl_seconds: int) -> float:
        def op() -> float:
            pipe = self._redis.pipeline()
            pipe.incrbyfloat(key, amount)
            pipe.expire(key, ttl_seconds)
            value, _ = pipe.execute()
            return float(value)

        return self._retry(op)

    def reset(self) -> None:
        raise NotImplementedError("reset is intentionally unsupported for production redis backend")

    def _retry(self, fn):
        last_error = None
        for _ in range(self._max_retries + 1):
            try:
                return fn()
            except Exception as exc:
                last_error = exc
        raise RuntimeError("redis backend unavailable after retries") from last_error
