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
    domain: str = "dilithium-mock-v1"

    def sign(self, payload: str) -> str:
        return (
            "pqext:"
            + hashlib.sha512(f"{self.domain}:{payload}".encode("utf-8")).hexdigest()
        )

    def verify(self, payload: str, signature: str) -> bool:
        return signature == self.sign(payload)


class RealDilithiumBackend:
    def __init__(self, seed: bytes | None = None) -> None:
        if importlib.util.find_spec("dilithium_py") is None:
            raise ModuleNotFoundError(
                "RealDilithiumBackend requires optional dependency 'dilithium_py'."
            )
        from dilithium_py import dilithium

        self._dilithium = dilithium
        if seed is not None:
            try:
                self._dilithium.Dilithium2.set_drbg_seed(seed)
            except Warning:
                pass
        first, second = self._dilithium.Dilithium2.keygen()
        if isinstance(first, (bytes, bytearray)) and isinstance(second, (bytes, bytearray)):
            self.pk = bytes(first)
            self.sk = bytes(second)
            self.pk_packed = self.pk
            self.sk_packed = self.sk
        else:
            self.sk = first
            self.pk = second
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
            return bool(
                self._dilithium.Dilithium2.verify(
                    self.pk_packed, payload.encode("utf-8"), sig_bytes
                )
            )
        except Exception:
            return False
