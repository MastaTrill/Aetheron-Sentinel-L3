"""Unit tests for PauseResumeOrchestrator bridge control logic."""

import unittest

from aetheron_sentinel_l3.bmnr_ingestion import BmnrAlert, BmnrAlertCorrelationEngine
from aetheron_sentinel_l3.execution import ActionExecutor, RuleBasedOnChainAdapter
from aetheron_sentinel_l3.orchestration import PauseResumeOrchestrator
from aetheron_sentinel_l3.telemetry import InMemoryAuditSink


class TestPauseResumeOrchestrator(unittest.TestCase):
    """Tests for PauseResumeOrchestrator pause/resume decision logic."""

    def make_orchestrator(
        self,
        *,
        fail_controls: set[str] | None = None,
        clock: float | None = None,
    ):
        """Build an orchestrator with in-memory fakes; optionally pin the clock to a fixed timestamp."""
        state = {"paused": False}

        def pause() -> None:
            state["paused"] = True

        def resume() -> None:
            state["paused"] = False

        adapter = RuleBasedOnChainAdapter(
            apply_map={"pause_bridge": pause, "resume_bridge": resume},
            rollback_map={"pause_bridge": resume, "resume_bridge": pause},
            fail_controls=fail_controls or set(),
        )
        executor = ActionExecutor(chain_adapter=adapter, failure_budget=0)
        sink = InMemoryAuditSink()
        engine = BmnrAlertCorrelationEngine(sink)
        fixed_clock = None
        if clock is not None:

            def _fixed() -> float:
                return clock

            fixed_clock = _fixed
        orchestrator = PauseResumeOrchestrator(
            executor=executor,
            sink=sink,
            correlation_engine=engine,
            **(({"clock": fixed_clock}) if fixed_clock is not None else {}),
        )
        return orchestrator, sink, state

    def test_bmnr_critical_anomaly_triggers_pause(self) -> None:
        """A critical BMNR anomaly alert must pause the bridge and record the action."""
        orchestrator, sink, state = self.make_orchestrator()
        alert = BmnrAlert(
            id="bmnr-1",
            type="anomaly",
            severity="critical",
            data={"tvl_spike": 0.21},
            timestamp=1_700_000_000.0,
            bridge_id="eth-main",
        )

        decision = orchestrator.handle_bmnr_alert(alert)

        self.assertEqual(decision.action, "pause_bridge")
        self.assertTrue(state["paused"])
        self.assertIsNotNone(decision.execution)
        assert decision.execution is not None
        self.assertTrue(decision.execution.verified)
        self.assertEqual(sink.events[-1].action, "orchestrated_pause")
        self.assertIn("pause_bridge", sink.events[-1].controls)

    def test_bmnr_resume_signal_triggers_resume(self) -> None:
        """A BMNR resume-type alert must resume the bridge and record the action."""
        orchestrator, sink, state = self.make_orchestrator()
        state["paused"] = True
        alert = BmnrAlert(
            id="bmnr-2",
            type="resume",
            severity="medium",
            data={"operator": "bmnr"},
            timestamp=1_700_000_100.0,
            bridge_id="eth-main",
        )

        decision = orchestrator.handle_bmnr_alert(alert)

        self.assertEqual(decision.action, "resume_bridge")
        self.assertFalse(state["paused"])
        self.assertIsNotNone(decision.execution)
        assert decision.execution is not None
        self.assertTrue(decision.execution.verified)
        self.assertEqual(sink.events[-1].action, "orchestrated_resume")
        self.assertIn("resume_bridge", sink.events[-1].controls)

    def test_sentinel_block_triggers_pause(self) -> None:
        """A Sentinel BLOCK decision correlated with a pending BMNR alert must pause the bridge."""
        # clock is set within the 300-second TTL window of the fixture alert timestamp
        orchestrator, sink, state = self.make_orchestrator(clock=1_700_000_210.0)
        orchestrator.handle_bmnr_alert(
            BmnrAlert(
                id="bmnr-3",
                type="anomaly",
                severity="high",
                data={"source": "bmnr"},
                timestamp=1_700_000_200.0,
                bridge_id="eth-main",
            )
        )

        decision = orchestrator.handle_sentinel_decision(
            event_id="sentinel-1",
            bridge_id="eth-main",
            action="BLOCK",
            risk_score=0.97,
        )

        self.assertEqual(decision.action, "pause_bridge")
        self.assertTrue(state["paused"])
        self.assertIsNotNone(decision.correlated)
        assert decision.correlated is not None
        self.assertEqual(decision.correlated.correlation_key, "eth-main:anomaly")
        self.assertEqual(sink.events[-1].action, "sentinel_pause")

    def test_correlated_resume_path_triggers_resume(self) -> None:
        """A Sentinel ALLOW decision correlated with a pending BMNR resume alert must resume the bridge."""
        # clock is set within the 300-second TTL window of the fixture alert timestamp
        orchestrator, sink, state = self.make_orchestrator(clock=1_700_000_310.0)
        state["paused"] = True
        orchestrator.handle_bmnr_alert(
            BmnrAlert(
                id="bmnr-4",
                type="resume",
                severity="medium",
                data={"reason": "manual_clear"},
                timestamp=1_700_000_300.0,
                bridge_id="eth-main",
            )
        )

        decision = orchestrator.handle_sentinel_decision(
            event_id="sentinel-2",
            bridge_id="eth-main",
            action="ALLOW",
            risk_score=0.12,
        )

        self.assertEqual(decision.action, "resume_bridge")
        self.assertFalse(state["paused"])
        self.assertIsNotNone(decision.correlated)
        assert decision.correlated is not None
        self.assertEqual(decision.correlated.correlation_key, "eth-main:resume")
        self.assertEqual(sink.events[-1].action, "sentinel_resume")
        self.assertIn("resume_bridge", sink.events[-1].controls)

    def test_failed_pause_execution_is_recorded(self) -> None:
        """When pause_bridge fails, the execution result must record the failure and remain unverified."""
        orchestrator, sink, state = self.make_orchestrator(
            fail_controls={"pause_bridge"}
        )
        alert = BmnrAlert(
            id="bmnr-5",
            type="anomaly",
            severity="critical",
            data={"tvl_spike": 0.31},
            timestamp=1_700_000_400.0,
            bridge_id="eth-main",
        )

        decision = orchestrator.handle_bmnr_alert(alert)

        self.assertEqual(decision.action, "pause_bridge")
        self.assertFalse(state["paused"])
        self.assertIsNotNone(decision.execution)
        assert decision.execution is not None
        self.assertFalse(decision.execution.verified)
        self.assertIn("pause_bridge", decision.execution.failures)
        self.assertEqual(sink.events[-1].action, "orchestrated_pause")
        self.assertIn("pause_bridge", sink.events[-1].controls)


if __name__ == "__main__":
    unittest.main()
