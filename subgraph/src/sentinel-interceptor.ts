import {
  AnomalyDetected,
  AutonomousPauseTriggered,
  TVLUpdated,
  AutonomousModeToggled,
  ThresholdUpdated,
} from "../generated/SentinelInterceptor/SentinelInterceptor";
import { AnomalyAlert, PauseEvent, Sentinel } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

function loadOrCreateSentinel(id: string, timestamp: BigInt): Sentinel {
  let sentinel = Sentinel.load(id);
  if (sentinel == null) {
    sentinel = new Sentinel(id);
    sentinel.isPaused = false;
    sentinel.autonomousMode = true;
    sentinel.tvlSpikeThreshold = BigInt.fromI32(1520);
    sentinel.totalValueLocked = BigInt.fromI32(0);
    sentinel.totalAlerts = BigInt.fromI32(0);
    sentinel.totalPauses = BigInt.fromI32(0);
    sentinel.createdAt = timestamp;
  }
  return sentinel;
}

function eventEntityId(txHash: string, logIndex: BigInt): string {
  return txHash + "-" + logIndex.toString();
}

export function handleAnomalyDetected(event: AnomalyDetected): void {
  let sentinel = loadOrCreateSentinel(event.address.toHex(), event.block.timestamp);
  sentinel.totalAlerts = sentinel.totalAlerts.plus(BigInt.fromI32(1));
  sentinel.updatedAt = event.block.timestamp;
  sentinel.save();

  let alert = new AnomalyAlert(
    eventEntityId(event.transaction.hash.toHex(), event.logIndex),
  );
  alert.sentinel = sentinel.id;
  alert.tvlPercentage = event.params.tvlPercentage;
  alert.threshold = event.params.threshold;
  alert.timestamp = event.block.timestamp;
  alert.blockNumber = event.block.number;
  alert.transactionHash = event.transaction.hash;
  alert.autoTriggered = event.params.tvlPercentage >= event.params.threshold;
  alert.save();
}

export function handleAutonomousPauseTriggered(
  event: AutonomousPauseTriggered,
): void {
  let sentinel = loadOrCreateSentinel(event.address.toHex(), event.block.timestamp);
  sentinel.isPaused = true;
  sentinel.totalPauses = sentinel.totalPauses.plus(BigInt.fromI32(1));
  sentinel.updatedAt = event.block.timestamp;
  sentinel.save();

  let pauseEvent = new PauseEvent(
    eventEntityId(event.transaction.hash.toHex(), event.logIndex),
  );
  pauseEvent.sentinel = sentinel.id;
  pauseEvent.trigger = event.params.trigger;
  pauseEvent.tvlAtPause = event.params.tvlAtPause;
  pauseEvent.timestamp = event.block.timestamp;
  pauseEvent.blockNumber = event.block.number;
  pauseEvent.transactionHash = event.transaction.hash;
  pauseEvent.save();
}

export function handleTVLUpdated(event: TVLUpdated): void {
  let sentinel = loadOrCreateSentinel(event.address.toHex(), event.block.timestamp);
  sentinel.totalValueLocked = event.params.newTVL;
  sentinel.updatedAt = event.block.timestamp;
  sentinel.save();
}

export function handleAutonomousModeToggled(
  event: AutonomousModeToggled,
): void {
  let sentinel = loadOrCreateSentinel(event.address.toHex(), event.block.timestamp);
  sentinel.autonomousMode = event.params.enabled;
  sentinel.updatedAt = event.block.timestamp;
  sentinel.save();
}

export function handleThresholdUpdated(event: ThresholdUpdated): void {
  let sentinel = loadOrCreateSentinel(event.address.toHex(), event.block.timestamp);
  sentinel.tvlSpikeThreshold = event.params.newThreshold;
  sentinel.updatedAt = event.block.timestamp;
  sentinel.save();
}
