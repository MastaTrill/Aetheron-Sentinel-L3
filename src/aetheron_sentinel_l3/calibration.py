from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ThresholdConfig:
    throttle_threshold: float
    block_threshold: float
    max_hourly_drain_ratio: float
    max_global_hourly_drain_ratio: float


class AdaptiveCalibrator:
    """Adaptive threshold calibrator with simple drift tracking.

    Drift is measured as EWMA absolute error between observed risk and expected risk.
    When drift is high, thresholds tighten. When low, thresholds relax to baseline.
    """

    def __init__(
        self,
        baseline: ThresholdConfig,
        alpha: float = 0.15,
        tighten_step: float = 0.03,
        relax_step: float = 0.01,
    ) -> None:
        self._baseline = baseline
        self._current = baseline
        self._alpha = alpha
        self._tighten_step = tighten_step
        self._relax_step = relax_step
        self._drift_ewma = 0.0

    def update(self, observed_risk: float, expected_risk: float) -> None:
        error = abs(observed_risk - expected_risk)
        self._drift_ewma = self._alpha * error + (1 - self._alpha) * self._drift_ewma

        if self._drift_ewma > 0.18:
            self._current = ThresholdConfig(
                throttle_threshold=max(0.15, self._current.throttle_threshold - self._tighten_step),
                block_threshold=max(0.25, self._current.block_threshold - self._tighten_step),
                max_hourly_drain_ratio=max(0.1, self._current.max_hourly_drain_ratio - self._tighten_step),
                max_global_hourly_drain_ratio=max(0.15, self._current.max_global_hourly_drain_ratio - self._tighten_step),
            )
        elif self._drift_ewma < 0.06:
            self._current = ThresholdConfig(
                throttle_threshold=min(self._baseline.throttle_threshold, self._current.throttle_threshold + self._relax_step),
                block_threshold=min(self._baseline.block_threshold, self._current.block_threshold + self._relax_step),
                max_hourly_drain_ratio=min(self._baseline.max_hourly_drain_ratio, self._current.max_hourly_drain_ratio + self._relax_step),
                max_global_hourly_drain_ratio=min(
                    self._baseline.max_global_hourly_drain_ratio,
                    self._current.max_global_hourly_drain_ratio + self._relax_step,
                ),
            )

    def get_thresholds(self, chain_id: str, asset_symbol: str) -> ThresholdConfig:
        """Per-chain/per-asset override hook.

        This baseline implementation returns current global thresholds; callers may
        subclass to support custom chain/asset overrides.
        """

        _ = (chain_id, asset_symbol)
        return self._current

    @property
    def drift_score(self) -> float:
        return self._drift_ewma
