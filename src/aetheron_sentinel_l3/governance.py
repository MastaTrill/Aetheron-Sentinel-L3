from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CalibrationRecord:
    chain_id: str
    asset_symbol: str
    observed_drift: float
    threshold_block: float


@dataclass(frozen=True)
class DriftAlarm:
    chain_id: str
    asset_symbol: str
    drift: float
    severity: str


@dataclass(frozen=True)
class CryptoAgilityRule:
    minimum_scheme: str
    grace_days_remaining: int


class GovernanceRegistry:
    """Tracks per-chain/asset calibration records, drift alarms, and crypto posture."""

    def __init__(self, alarm_threshold: float = 0.2, max_critical_alarms_before_safe_mode: int = 3) -> None:
        self.alarm_threshold = alarm_threshold
        self.max_critical_alarms_before_safe_mode = max_critical_alarms_before_safe_mode
        self.records: list[CalibrationRecord] = []
        self.alarms: list[DriftAlarm] = []
        self.crypto_rules: list[CryptoAgilityRule] = []
        self.safe_mode = False

    def record_calibration(self, record: CalibrationRecord) -> None:
        self.records.append(record)
        if record.observed_drift >= self.alarm_threshold:
            severity = "critical" if record.observed_drift >= self.alarm_threshold * 1.5 else "warning"
            alarm = DriftAlarm(
                chain_id=record.chain_id,
                asset_symbol=record.asset_symbol,
                drift=record.observed_drift,
                severity=severity,
            )
            self.alarms.append(alarm)
            if severity == "critical":
                recent_critical = sum(
                    1 for a in self.alarms[-self.max_critical_alarms_before_safe_mode :] if a.severity == "critical"
                )
                if recent_critical >= self.max_critical_alarms_before_safe_mode:
                    self.safe_mode = True

    def register_crypto_rule(self, rule: CryptoAgilityRule) -> None:
        self.crypto_rules.append(rule)

    def clear_safe_mode(self) -> None:
        self.safe_mode = False

    def is_crypto_compliant(self, schemes: list[str]) -> bool:
        if not self.crypto_rules:
            return True
        latest = self.crypto_rules[-1]
        if latest.minimum_scheme == "pq-sim-dilithium":
            return "pq-sim-dilithium" in schemes or latest.grace_days_remaining > 0
        return True

    def latest_for(self, chain_id: str, asset_symbol: str) -> CalibrationRecord | None:
        for rec in reversed(self.records):
            if rec.chain_id == chain_id and rec.asset_symbol == asset_symbol:
                return rec
        return None
