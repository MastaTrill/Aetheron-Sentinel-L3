import {
  reportAnomalyCall,
  emergencyPauseCall,
  resumeBridgeCall,
} from "../generated/SentinelInterceptor/SentinelInterceptor";
import { AnomalyAlert, PauseEvent } from "../generated/schema";

export function handleReportAnomaly(call: reportAnomalyCall): void {
  let alert = new AnomalyAlert(
    call.transaction.hash.concatI32(call.transaction.index.toI32()),
  );
  alert.sentinel = call.to.toHex();
  alert.tvlPercentage = call.inputs.tvlPercentage;
  alert.threshold = 1520; // TVL_SPIKE_THRESHOLD
  alert.timestamp = call.block.timestamp;
  alert.blockNumber = call.block.number;
  alert.save();
}

export function handleEmergencyPause(call: emergencyPauseCall): void {
  let pause = new PauseEvent(
    call.transaction.hash.concatI32(call.transaction.index.toI32()),
  );
  pause.sentinel = call.to.toHex();
  pause.trigger = call.from;
  pause.reason = call.inputs.reason;
  pause.timestamp = call.block.timestamp;
  pause.blockNumber = call.block.number;
  pause.save();
}

export function handleResumeBridge(call: resumeBridgeCall): void {
  // Resume logic - could update pause status
  let pause = PauseEvent.load(
    call.transaction.hash.concatI32(call.transaction.index.toI32()),
  );
  if (pause) {
    // Mark as resumed - in a real implementation, you'd track pause state
  }
}
