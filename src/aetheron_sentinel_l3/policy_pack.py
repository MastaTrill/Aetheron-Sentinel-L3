from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class PolicyPack:
    version: str
    stage: str
    rules: dict[str, float]
    signature: str
    signature_scheme: str = "hmac-sha256"
    secondary_signature: str | None = None
    secondary_signature_scheme: str | None = None


class PolicyPackManager:
    """Signed policy-pack manager with staged rollout, scheme agility, and rollback."""

    def __init__(
        self,
        signing_key: str,
        signature_scheme: str = "hmac-sha256",
        secondary_signature_scheme: str | None = None,
        pq_sign_fn: Callable[[str], str] | None = None,
        pq_verify_fn: Callable[[str, str], bool] | None = None,
    ) -> None:
        self._signing_key = signing_key.encode("utf-8")
        self.signature_scheme = signature_scheme
        self.secondary_signature_scheme = secondary_signature_scheme
        self.pq_sign_fn = pq_sign_fn
        self.pq_verify_fn = pq_verify_fn
        self._active: PolicyPack | None = None
        self._history: list[PolicyPack] = []

    def sign(self, version: str, stage: str, rules: dict[str, float], signature_scheme: str | None = None) -> PolicyPack:
        primary = signature_scheme or self.signature_scheme
        payload = self._payload(version, stage, rules, primary)
        sig = self._sign_payload(payload, primary)

        secondary_sig = None
        secondary_scheme = self.secondary_signature_scheme
        if secondary_scheme is not None:
            secondary_payload = self._payload(version, stage, rules, secondary_scheme)
            secondary_sig = self._sign_payload(secondary_payload, secondary_scheme)

        return PolicyPack(version, stage, rules, sig, primary, secondary_sig, secondary_scheme)

    def verify(self, pack: PolicyPack) -> bool:
        payload = self._payload(pack.version, pack.stage, pack.rules, pack.signature_scheme)
        primary_ok = self._verify_payload(payload, pack.signature_scheme, pack.signature)

        if pack.secondary_signature is None:
            return primary_ok
        if pack.secondary_signature_scheme is None:
            return False

        secondary_payload = self._payload(pack.version, pack.stage, pack.rules, pack.secondary_signature_scheme)
        secondary_ok = self._verify_payload(secondary_payload, pack.secondary_signature_scheme, pack.secondary_signature)
        return primary_ok and secondary_ok

    def rollout(self, pack: PolicyPack) -> None:
        if not self.verify(pack):
            raise ValueError("invalid policy pack signature")
        if self._active is not None:
            self._history.append(self._active)
        self._active = pack

    def rollback(self) -> None:
        if not self._history:
            raise RuntimeError("no prior policy pack to rollback to")
        self._active = self._history.pop()

    @property
    def active(self) -> PolicyPack | None:
        return self._active

    @property
    def has_history(self) -> bool:
        return bool(self._history)

    def _verify_payload(self, payload: str, scheme: str, signature: str) -> bool:
        if scheme == "pq-ext":
            if self.pq_verify_fn is None:
                return False
            return self.pq_verify_fn(payload, signature)
        expected = self._sign_payload(payload, scheme)
        return hmac.compare_digest(expected, signature)

    def _sign_payload(self, payload: str, scheme: str) -> str:
        if scheme == "hmac-sha256":
            return hmac.new(self._signing_key, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if scheme == "pq-sim-dilithium":
            return "pq:" + hashlib.sha512((payload + self._signing_key.decode("utf-8")).encode("utf-8")).hexdigest()
        if scheme == "pq-ext":
            if self.pq_sign_fn is None:
                raise ValueError("pq-ext signing requested but no pq_sign_fn provided")
            return self.pq_sign_fn(payload)
        raise ValueError(f"unsupported signature scheme: {scheme}")

    @staticmethod
    def _payload(version: str, stage: str, rules: dict[str, float], scheme: str) -> str:
        return json.dumps({"version": version, "stage": stage, "rules": rules, "scheme": scheme}, sort_keys=True)
