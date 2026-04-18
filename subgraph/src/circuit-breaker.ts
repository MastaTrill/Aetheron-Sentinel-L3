import {
  CircuitOpened,
  CircuitHalfOpened,
  CircuitClosed,
  FailureRecorded,
  SuccessRecorded,
  CircuitBreaker,
} from "../generated/CircuitBreaker/CircuitBreaker";
import { CircuitBreakerState } from "../generated/schema";
import { Address, BigInt } from "@graphprotocol/graph-ts";

function stateLabel(raw: i32): string {
  if (raw == 1) return "OPEN";
  if (raw == 2) return "HALF_OPEN";
  return "CLOSED";
}

function syncState(address: string, timestamp: BigInt): void {
  const contract = CircuitBreaker.bind(Address.fromString(address));
  let entity = CircuitBreakerState.load(address);

  if (entity == null) {
    entity = new CircuitBreakerState(address);
  }

  let stats = contract.getStats();
  entity.state = stateLabel(stats.value0);
  entity.failureCount = stats.value1;
  entity.successCount = stats.value2;
  entity.lastStateChange = contract.lastStateChange();
  entity.untilReset = stats.value4;
  entity.timestamp = timestamp;
  entity.save();
}

export function handleCircuitOpened(event: CircuitOpened): void {
  syncState(event.address.toHex(), event.block.timestamp);
}

export function handleCircuitHalfOpened(event: CircuitHalfOpened): void {
  syncState(event.address.toHex(), event.block.timestamp);
}

export function handleCircuitClosed(event: CircuitClosed): void {
  syncState(event.address.toHex(), event.block.timestamp);
}

export function handleFailureRecorded(event: FailureRecorded): void {
  syncState(event.address.toHex(), event.block.timestamp);
}

export function handleSuccessRecorded(event: SuccessRecorded): void {
  syncState(event.address.toHex(), event.block.timestamp);
}
