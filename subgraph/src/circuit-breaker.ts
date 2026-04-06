import {
  CircuitOpened,
  CircuitHalfOpened,
  CircuitClosed,
  FailureRecorded,
  SuccessRecorded,
} from "../generated/CircuitBreaker/CircuitBreaker";
import { CircuitBreakerState } from "../generated/schema";

// Event handlers for CircuitBreaker contract
export function handleCircuitOpened(event: CircuitOpened): void {
  let state = new CircuitBreakerState(event.transaction.hash.toHex());
  state.isOpen = true;
  state.failureCount = event.params.failureCount;
  state.timestamp = event.block.timestamp;
  state.save();
}

export function handleCircuitHalfOpened(event: CircuitHalfOpened): void {
  let state = CircuitBreakerState.load(event.transaction.hash.toHex());
  if (state) {
    state.isHalfOpen = true;
    state.save();
  }
}

export function handleCircuitClosed(event: CircuitClosed): void {
  let state = CircuitBreakerState.load(event.transaction.hash.toHex());
  if (state) {
    state.isOpen = false;
    state.isHalfOpen = false;
    state.save();
  }
}

export function handleFailureRecorded(event: FailureRecorded): void {
  let state = new CircuitBreakerState(event.transaction.hash.toHex());
  state.failureCount = event.params.failureCount;
  state.lastFailureTime = event.block.timestamp;
  state.save();
}

export function handleSuccessRecorded(event: SuccessRecorded): void {
  let state = new CircuitBreakerState(event.transaction.hash.toHex());
  state.successCount = event.params.successCount;
  state.lastSuccessTime = event.block.timestamp;
  state.save();
}
