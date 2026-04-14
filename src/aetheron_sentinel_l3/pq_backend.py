from __future__ import annotations

import hashlib
import importlib.util
from dataclasses import dataclass
from typing import Protocol

class PQBackend(Protocol):
    def sign(self, payload: str) -> str: ...

    def verify(self, payload: str, signature: str) -> bool: ...


@dataclass
class MockDilithiumBackend:
    """Deterministic placeholder backend for PQ signing/verification integration tests."""

    domain: str = "dilithium-mock-v1"

    def sign(self, payload: str) -> str:
        return (
            "pqext:"
            + hashlib.sha512(f"{self.domain}:{payload}".encode("utf-8")).hexdigest()
        )

    def verify(self, payload: str, signature: str) -> bool:
        return signature == self.sign(payload)


class RealDilithiumBackend:
    """Real Dilithium post-quantum signature backend."""

    def __init__(self) -> None:
        if importlib.util.find_spec("dilithium_py") is None:
            raise ModuleNotFoundError(
                "RealDilithiumBackend requires optional dependency 'dilithium_py'."
            )
        from dilithium_py import dilithium

        self._dilithium = dilithium
        self.sk, self.pk = self._dilithium.Dilithium2.keygen()
        self.sk_packed = self._dilithium.Dilithium2._pack_sk(*self.sk)
        self.pk_packed = self._dilithium.Dilithium2._pack_pk(*self.pk)

    def sign(self, payload: str) -> str:
        signature = self._dilithium.Dilithium2.sign(
            self.sk_packed, payload.encode("utf-8")
        )
        return signature.hex()

    def verify(self, payload: str, signature: str) -> bool:
        try:
            sig_bytes = bytes.fromhex(signature)
            return self._dilithium.Dilithium2.verify(
                self.pk_packed, sig_bytes, payload.encode("utf-8")
            )
        except Exception:
            return False
