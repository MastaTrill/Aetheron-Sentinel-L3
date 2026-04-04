import {
  AnomalyDetected,
  AutonomousPauseTriggered,
  TVLUpdated,
  AutonomousModeToggled,
  ThresholdUpdated,
} from "../generated/SentinelInterceptor/SentinelInterceptor";
import { Sentinel } from "../generated/schema";

export function handleAnomalyDetected(event: AnomalyDetected): void {
  // Create or update Sentinel entity
  let sentinel = Sentinel.load(event.address.toHex());
  if (!sentinel) {
    sentinel = new Sentinel(event.address.toHex());
    sentinel.isPaused = false;
    sentinel.autonomousMode = true;
    sentinel.tvlSpikeThreshold = 1520;
    sentinel.totalValueLocked = 0;
    sentinel.totalAlerts = 0;
    sentinel.totalPauses = 0;
    sentinel.createdAt = event.block.timestamp;
  }

  sentinel.totalAlerts = sentinel.totalAlerts.plus(1);
  sentinel.updatedAt = event.block.timestamp;
  sentinel.save();
}

export function handleAutonomousPauseTriggered(
  event: AutonomousPauseTriggered,
): void {
  let sentinel = Sentinel.load(event.address.toHex());
  if (sentinel) {
    sentinel.isPaused = true;
    sentinel.totalPauses = sentinel.totalPauses.plus(1);
    sentinel.updatedAt = event.block.timestamp;
    sentinel.save();
  }
}

export function handleTVLUpdated(event: TVLUpdated): void {
  let sentinel = Sentinel.load(event.address.toHex());
  if (sentinel) {
    sentinel.totalValueLocked = event.params.newTVL;
    sentinel.updatedAt = event.block.timestamp;
    sentinel.save();
  }
}

export function handleAutonomousModeToggled(
  event: AutonomousModeToggled,
): void {
  let sentinel = Sentinel.load(event.address.toHex());
  if (sentinel) {
    sentinel.autonomousMode = event.params.enabled;
    sentinel.updatedAt = event.block.timestamp;
    sentinel.save();
  }
}

export function handleThresholdUpdated(event: ThresholdUpdated): void {
  let sentinel = Sentinel.load(event.address.toHex());
  if (sentinel) {
    sentinel.tvlSpikeThreshold = event.params.newThreshold;
    sentinel.updatedAt = event.block.timestamp;
    sentinel.save();
  }
}
