import hypothesis
import hypothesis.strategies as st
from aetheron_sentinel_l3.orchestration import PauseResumeOrchestrator
from aetheron_sentinel_l3.bmnr_ingestion import BmnrAlert, BmnrAlertCorrelationEngine
from aetheron_sentinel_l3.execution import ActionExecutor, RuleBasedOnChainAdapter
from aetheron_sentinel_l3.telemetry import InMemoryAuditSink


# Fuzz test: random BMNR alert severities and actions
@hypothesis.given(
    severity=st.sampled_from(["low", "medium", "high"]),
    action=st.sampled_from(["pause", "resume", "monitor"]),
)
def test_bmnr_alert_fuzz(severity):
    # Setup orchestrator with in-memory fakes
    state = {"paused": False}

    def pause():
        state["paused"] = True

    def resume():
        state["paused"] = False

    adapter = RuleBasedOnChainAdapter(
        apply_map={"pause_bridge": pause, "resume_bridge": resume},
        rollback_map={"pause_bridge": resume, "resume_bridge": pause},
        fail_controls=set(),
    )
    executor = ActionExecutor(chain_adapter=adapter, failure_budget=0)
    sink = InMemoryAuditSink()
    engine = BmnrAlertCorrelationEngine(sink)
    orch = PauseResumeOrchestrator(executor, sink, engine)

    alert = BmnrAlert(id="fuzz", severity=severity, type="fuzz", data={}, timestamp=0)
    decision = orch.handle_bmnr_alert(alert)
    # Should not raise, and decision.action should be one of the expected
    assert decision.action in ("pause_bridge", "resume_bridge", "monitor")
