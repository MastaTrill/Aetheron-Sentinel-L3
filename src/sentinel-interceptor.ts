import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  SentinelInterceptor,
  AnomalyDetected as AnomalyDetectedEvent,
  AutonomousPauseTriggered as AutonomousPauseTriggeredEvent,
  TVLUpdated as TVLUpdatedEvent,
  AutonomousModeToggled as AutonomousModeToggledEvent,
  ThresholdUpdated as ThresholdUpdatedEvent
} from "../generated/SentinelInterceptor/SentinelInterceptor"
import { Sentinel, Threshold, TVLUpdate } from "../generated/schema"

export function handleAnomalyDetected(event: AnomalyDetectedEvent): void {
  let entity = new Sentinel(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.anomalyCount = BigInt.fromI32(1)
  entity.lastAnomalyBlock = event.params.blockNumber
  entity.autonomousMode = true

  entity.save()
}

export function handleAutonomousPauseTriggered(
  event: AutonomousPauseTriggeredEvent
): void {
  let entity = new Sentinel(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.autonomousMode = false

  entity.save()
}

export function handleTVLUpdated(event: TVLUpdatedEvent): void {
  let entity = new TVLUpdate(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.sentinel = "sentinel-1" // Reference to sentinel entity
  entity.tvl = event.params.newTVL
  entity.timestamp = event.block.timestamp

  entity.save()
}

export function handleAutonomousModeToggled(
  event: AutonomousModeToggledEvent
): void {
  let entity = new Sentinel(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.autonomousMode = event.params.enabled

  entity.save()
}

export function handleThresholdUpdated(event: ThresholdUpdatedEvent): void {
  let entity = new Threshold(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.sentinel = "sentinel-1" // Reference to sentinel entity
  entity.thresholdType = event.params.thresholdType
  entity.value = event.params.newValue
  entity.updatedAt = event.block.timestamp

  entity.save()
}