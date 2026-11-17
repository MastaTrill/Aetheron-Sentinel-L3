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
class ExecutionFailureAlarm:
    op_ids: tuple[str, ...]
    failed_controls: tuple[str, ...]
    rolled_back_controls: tuple[str, ...]
    failure_count: int
    severity: str


@dataclass(frozen=True)
class CryptoAgilityRule:
    minimum_scheme: str
    grace_days_remaining: int


class GovernanceRegistry:
    def __init__(
        self,
        alarm_threshold: float = 0.2,
        alert_callback=None,
        critical_alarm_threshold: float | None = None,
        execution_failure_threshold: int = 1,
    ) -> None:
        self.alarm_threshold = alarm_threshold
        self.critical_alarm_threshold = (
            critical_alarm_threshold if critical_alarm_threshold is not None else alarm_threshold * 1.5
        )
        self.execution_failure_threshold = max(1, execution_failure_threshold)
        self.alert_callback = alert_callback
        self.records: list[CalibrationRecord] = []
        self.alarms: list[DriftAlarm] = []
        self.execution_alarms: list[ExecutionFailureAlarm] = []
        self.execution_failure_count: int = 0
        self.crypto_rules: list[CryptoAgilityRule] = []

    def record_calibration(self, record: CalibrationRecord) -> None:
        self.records.append(record)
        if record.observed_drift >= self.alarm_threshold:
            severity = (
                "critical"
                if record.observed_drift >= self.critical_alarm_threshold
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

    def record_execution_result(
        self,
        verified: bool,
        failed_controls: tuple[str, ...] = (),
        rolled_back_controls: tuple[str, ...] = (),
        op_ids: tuple[str, ...] = (),
    ) -> ExecutionFailureAlarm | None:
        if verified and not failed_controls:
            return None
        self.execution_failure_count += 1
        if self.execution_failure_count < self.execution_failure_threshold:
            return None
        severity = "critical" if self.execution_failure_count >= self.execution_failure_threshold else "warning"
        alarm = ExecutionFailureAlarm(
            op_ids=tuple(op_ids),
            failed_controls=tuple(failed_controls),
            rolled_back_controls=tuple(rolled_back_controls),
            failure_count=self.execution_failure_count,
            severity=severity,
        )
        self.execution_alarms.append(alarm)
        if self.alert_callback:
            self.alert_callback(alarm)
        return alarm

    def register_crypto_rule(self, rule: CryptoAgilityRule) -> None:
        self.crypto_rules.append(rule)

    def is_crypto_compliant(self, schemes: list[str]) -> bool:
        if not self.crypto_rules:
            return True
        latest = self.crypto_rules[-1]
        if latest.minimum_scheme == "pq-sim-dilithium":
            return (
                "pq-sim-dilithium" in schemes
                or "pq-ext" in schemes
                or latest.grace_days_remaining > 0
            )
        if latest.minimum_scheme == "pq-ext":
            return "pq-ext" in schemes or latest.grace_days_remaining > 0
        return True

    def latest_for(self, chain_id: str, asset_symbol: str) -> CalibrationRecord | None:
        for rec in reversed(self.records):
            if rec.chain_id == chain_id and rec.asset_symbol == asset_symbol:
                return rec
        return None
