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

    def __init__(self, alarm_threshold: float = 0.2, alert_callback=None) -> None:
        self.alarm_threshold = alarm_threshold
        self.alert_callback = alert_callback
        self.records: list[CalibrationRecord] = []
        self.alarms: list[DriftAlarm] = []
        self.crypto_rules: list[CryptoAgilityRule] = []

    def record_calibration(self, record: CalibrationRecord) -> None:
        self.records.append(record)
        if record.observed_drift >= self.alarm_threshold:
            severity = (
                "critical"
                if record.observed_drift >= self.alarm_threshold * 1.5
                else "warning"
            )
            alarm = DriftAlarm(
                chain_id=record.chain_id,
                asset_symbol=record.asset_symbol,
                drift=record.observed_drift,
                severity=severity,
            )
            self.alarms.append(alarm)
            if self.alert_callback:
                self.alert_callback(alarm)

    def register_crypto_rule(self, rule: CryptoAgilityRule) -> None:
        self.crypto_rules.append(rule)

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
