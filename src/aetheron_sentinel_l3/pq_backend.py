from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Protocol


class PQBackend(Protocol):
    def sign(self, payload: str) -> str:
        ...

    def verify(self, payload: str, signature: str) -> bool:
        ...


@dataclass
class MockDilithiumBackend:
    """Deterministic placeholder backend for PQ signing/verification integration tests."""

    domain: str = "dilithium-mock-v1"

    def sign(self, payload: str) -> str:
        return "pqext:" + hashlib.sha512(f"{self.domain}:{payload}".encode("utf-8")).hexdigest()

    def verify(self, payload: str, signature: str) -> bool:
        return signature == self.sign(payload)
