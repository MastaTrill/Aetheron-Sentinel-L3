from __future__ import annotations

from dataclasses import dataclass

from .interceptor import LiquidityRiskInput, SentinelInterceptor


@dataclass(frozen=True)
class SimulationMetrics:
    total: int
    blocked: int
    throttled: int
    allowed: int
    false_negatives: int
    false_positives: int
    true_positives: int


@dataclass(frozen=True)
class TournamentKPI:
    tpr: float
    fpr: float
    mttr_minutes: float
    economic_loss_prevented: float


class AdversarialSimulator:
    """Simple simulation harness for attack/benign scenarios."""

    def __init__(self, interceptor: SentinelInterceptor) -> None:
        self.interceptor = interceptor

    def run(self, scenarios: list[tuple[LiquidityRiskInput, bool, float]]) -> SimulationMetrics:
        blocked = throttled = allowed = false_negatives = false_positives = true_positives = 0

        for payload, is_attack, _ in scenarios:
            decision = self.interceptor.evaluate(payload)
            flagged = decision.action in {"BLOCK", "THROTTLE"}

            if decision.action == "BLOCK":
                blocked += 1
            elif decision.action == "THROTTLE":
                throttled += 1
            else:
                allowed += 1

            if is_attack and not flagged:
                false_negatives += 1
            if (not is_attack) and flagged:
                false_positives += 1
            if is_attack and flagged:
                true_positives += 1

        return SimulationMetrics(
            total=len(scenarios),
            blocked=blocked,
            throttled=throttled,
            allowed=allowed,
            false_negatives=false_negatives,
            false_positives=false_positives,
            true_positives=true_positives,
        )

    def tournament(self, scenarios: list[tuple[LiquidityRiskInput, bool, float]]) -> TournamentKPI:
        metrics = self.run(scenarios)
        attacks = sum(1 for _, is_attack, _ in scenarios if is_attack)
        benign = max(1, len(scenarios) - attacks)

        prevented = 0.0
        for payload, is_attack, est_loss in scenarios:
            if not is_attack:
                continue
            decision = self.interceptor.evaluate(payload)
            if decision.action in {"BLOCK", "THROTTLE"}:
                prevented += est_loss

        tpr = metrics.true_positives / max(1, attacks)
        fpr = metrics.false_positives / benign
        mttr_minutes = 3.0 if metrics.true_positives else 15.0

        return TournamentKPI(
            tpr=tpr,
            fpr=fpr,
            mttr_minutes=mttr_minutes,
            economic_loss_prevented=prevented,
        )
