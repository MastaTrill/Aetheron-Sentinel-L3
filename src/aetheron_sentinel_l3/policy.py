from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PolicyResult:
    force_action: str | None
    reasons: tuple[str, ...]


class PolicyEngine:
    def evaluate(
        self,
        *,
        drain_ratio: float,
        signer_quorum_ratio: float,
        anomaly_score: float,
        chain_health_score: float,
    ) -> PolicyResult:
        reasons: list[str] = []
        force_action: str | None = None

        if drain_ratio >= 0.9:
            reasons.append("invariant_large_drain_block")
            force_action = "BLOCK"

        if signer_quorum_ratio < 0.5:
            reasons.append("invariant_low_quorum_block")
            force_action = "BLOCK"

        if chain_health_score < 0.4 and anomaly_score > 0.7:
            reasons.append("invariant_chain_anomaly_block")
            force_action = "BLOCK"

        return PolicyResult(force_action=force_action, reasons=tuple(sorted(set(reasons))))
