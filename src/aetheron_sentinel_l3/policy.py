from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PolicyResult:
    force_action: str | None
    reasons: tuple[str, ...]


class PolicyEngine:
    """Simple policy engine + formal invariants layer.

    This is a lightweight stand-in for OPA/Cedar style policy execution.
    """

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

        # Invariant: very large drains must never be auto-approved.
        if drain_ratio >= 0.9:
            reasons.append("invariant_large_drain_block")
            force_action = "BLOCK"

        # Invariant: critically low signer confidence cannot proceed.
        if signer_quorum_ratio < 0.5:
            reasons.append("invariant_low_quorum_block")
            force_action = "BLOCK"

        # Invariant: bad chain conditions + high anomaly must block.
        if chain_health_score < 0.4 and anomaly_score > 0.7:
            reasons.append("invariant_chain_anomaly_block")
            force_action = "BLOCK"

        return PolicyResult(force_action=force_action, reasons=tuple(sorted(set(reasons))))
