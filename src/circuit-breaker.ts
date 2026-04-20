import { BigInt } from "@graphprotocol/graph-ts"
import {
  CircuitBreaker,
  CircuitOpened as CircuitOpenedEvent,
  CircuitHalfOpened as CircuitHalfOpenedEvent,
  CircuitClosed as CircuitClosedEvent,
  FailureRecorded as FailureRecordedEvent,
  SuccessRecorded as SuccessRecordedEvent
} from "../generated/CircuitBreaker/CircuitBreaker"
import { CircuitBreakerState } from "../generated/schema"

export function handleCircuitOpened(event: CircuitOpenedEvent): void {
  let entity = CircuitBreakerState.load(event.params.chainId.toString())
  if (!entity) {
    entity = new CircuitBreakerState(event.params.chainId.toString())
  }
  entity.chainId = event.params.chainId
  entity.state = "OPEN"
  entity.failureCount = event.params.failureCount
  entity.lastFailure = event.block.timestamp

  entity.save()
}

export function handleCircuitHalfOpened(event: CircuitHalfOpenedEvent): void {
  let entity = CircuitBreakerState.load(event.params.chainId.toString())
  if (entity) {
    entity.state = "HALF_OPEN"
    entity.save()
  }
}

export function handleCircuitClosed(event: CircuitClosedEvent): void {
  let entity = CircuitBreakerState.load(event.params.chainId.toString())
  if (entity) {
    entity.state = "CLOSED"
    entity.failureCount = BigInt.fromI32(0)
    entity.save()
  }
}

export function handleFailureRecorded(event: FailureRecordedEvent): void {
  let entity = CircuitBreakerState.load(event.params.chainId.toString())
  if (!entity) {
    entity = new CircuitBreakerState(event.params.chainId.toString())
    entity.state = "CLOSED"
  }
  entity.failureCount = entity.failureCount.plus(BigInt.fromI32(1))
  entity.lastFailure = event.block.timestamp

  entity.save()
}

export function handleSuccessRecorded(event: SuccessRecordedEvent): void {
  let entity = CircuitBreakerState.load(event.params.chainId.toString())
  if (entity) {
    entity.lastSuccess = event.block.timestamp
    entity.save()
  }
}