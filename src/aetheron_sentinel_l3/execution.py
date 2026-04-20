"""On-chain execution adapters, rollback safety, and execution result tracking."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from itertools import count
from typing import Callable


@dataclass(frozen=True)
class OperationReceipt:
    """Receipt produced by applying a single on-chain control operation."""

    op_id: str
    control: str
    status: str
    tx_hash: str
    finalized: bool


@dataclass(frozen=True)
class ExecutionResult:
    """Immutable summary of an apply_controls call, including failures and rollbacks."""

    applied: tuple[str, ...]
    rolled_back: tuple[str, ...]
    failures: tuple[str, ...]
    verified: bool
    receipts: tuple[OperationReceipt, ...]


class OnChainAdapter:
    """Abstract base for on-chain adapters that apply, roll back, and verify controls."""

    def apply(self, control: str, op_id: str) -> OperationReceipt:
        """Apply a named control and return an operation receipt."""
        raise NotImplementedError

    def rollback(self, control: str, op_id: str) -> None:
        """Roll back a previously applied control."""
        raise NotImplementedError

    def verify(self, receipt: OperationReceipt) -> bool:
        """Return True if the receipt confirms the control was applied and finalized."""
        raise NotImplementedError


class RuleBasedOnChainAdapter(OnChainAdapter):
    """Concrete adapter mapping control names to apply/rollback functions."""

    def __init__(
        self,
        apply_map: dict[str, Callable[[], None]] | None = None,
        rollback_map: dict[str, Callable[[], None]] | None = None,
        fail_controls: set[str] | None = None,
        pending_controls: set[str] | None = None,
    ) -> None:
        """Initialize the adapter with optional apply/rollback function maps and simulated failure sets."""
        self.apply_map = apply_map or {}
        self.rollback_map = rollback_map or {}
        self.fail_controls = fail_controls or set()
        self.pending_controls = pending_controls or set()
        self.applied_log: list[str] = []
        self.rollback_log: list[str] = []

    def apply(self, control: str, op_id: str) -> OperationReceipt:
        """Invoke the mapped apply function and return a receipt; raise RuntimeError for fail_controls."""
        if control in self.fail_controls:
            raise RuntimeError(f"simulated failure for control: {control}")
        fn = self.apply_map.get(control)
        if fn is not None:
            fn()
        self.applied_log.append(control)
        tx_hash = hashlib.sha256(f"{op_id}:{control}".encode("utf-8")).hexdigest()
        finalized = control not in self.pending_controls
        return OperationReceipt(
            op_id=op_id,
            control=control,
            status="applied",
            tx_hash=tx_hash,
            finalized=finalized,
        )

    def rollback(self, control: str, op_id: str) -> None:
        """Invoke the mapped rollback function for the given control."""
        fn = self.rollback_map.get(control)
        if fn is not None:
            fn()
        self.rollback_log.append(control)

    def verify(self, receipt: OperationReceipt) -> bool:
        """Return True if the control was applied, not rolled back, and finalized."""
        return (
            receipt.control in self.applied_log
            and receipt.control not in self.rollback_log
            and receipt.finalized
        )


class ActionExecutor:
    """Execution adapter for controls with rollback safety and failure budget."""

    def __init__(
        self, chain_adapter: OnChainAdapter | None = None, failure_budget: int = 1
    ) -> None:
        """Initialize the executor with an on-chain adapter and a failure budget."""
        self.chain_adapter = chain_adapter or RuleBasedOnChainAdapter()
        self.failure_budget = failure_budget
        self._seq = count(1)

    def apply_controls(self, controls: tuple[str, ...]) -> ExecutionResult:
        """Apply each control in order; roll back all applied controls when failure budget is exceeded."""
        applied: list[str] = []
        failures: list[str] = []
        receipts: list[OperationReceipt] = []

        for control in controls:
            op_id = f"op-{next(self._seq)}"
            try:
                receipt = self.chain_adapter.apply(control, op_id)
                receipts.append(receipt)
                applied.append(control)
            except Exception:  # pylint: disable=broad-except
                failures.append(control)
                if len(failures) > self.failure_budget:
                    rolled_back: list[str] = []
                    for applied_control in reversed(applied):
                        try:
                            self.chain_adapter.rollback(
                                applied_control, op_id=f"rollback-{next(self._seq)}"
                            )
                            rolled_back.append(applied_control)
                        except Exception:  # pylint: disable=broad-except
                            failures.append(f"rollback:{applied_control}")
                    return ExecutionResult(
                        (), tuple(rolled_back), tuple(failures), False, tuple(receipts)
                    )

        verified = all(self.chain_adapter.verify(r) for r in receipts)
        return ExecutionResult(
            tuple(applied), (), tuple(failures), verified, tuple(receipts)
        )
