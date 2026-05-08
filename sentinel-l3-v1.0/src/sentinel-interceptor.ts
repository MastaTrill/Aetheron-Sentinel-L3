// @ts-nocheck
import { BigInt } from '@graphprotocol/graph-ts';
import {
  AnomalyDetected as AnomalyDetectedEvent,
  AutonomousPauseTriggered as AutonomousPauseTriggeredEvent,
  TVLUpdated as TVLUpdatedEvent,
  AutonomousModeToggled as AutonomousModeToggledEvent,
  ThresholdUpdated as ThresholdUpdatedEvent,
} from '../generated/SentinelInterceptor/SentinelInterceptor';
import { Sentinel, Threshold, TVLUpdate } from '../generated/schema';

const SENTINEL_ID = 'sentinel-global';

function loadOrCreateSentinel(): Sentinel {
  let entity = Sentinel.load(SENTINEL_ID);
  if (!entity) {
    entity = new Sentinel(SENTINEL_ID);
    entity.anomalyCount = BigInt.fromI32(0);
    entity.lastAnomalyBlock = BigInt.fromI32(0);
    entity.autonomousMode = false;
  }
  return entity as Sentinel;
}

export function handleAnomalyDetected(event: AnomalyDetectedEvent): void {
  const entity = loadOrCreateSentinel();
  entity.anomalyCount = entity.anomalyCount.plus(BigInt.fromI32(1));
  entity.lastAnomalyBlock = event.params.blockNumber;
  entity.save();
}

export function handleAutonomousPauseTriggered(event: AutonomousPauseTriggeredEvent): void {
  const entity = loadOrCreateSentinel();
  entity.autonomousMode = false;
  entity.save();
}

export function handleTVLUpdated(event: TVLUpdatedEvent): void {
  const sentinel = loadOrCreateSentinel();
  sentinel.save();

  const update = new TVLUpdate(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  update.sentinel = SENTINEL_ID;
  update.tvl = event.params.newTVL;
  update.timestamp = event.block.timestamp;
  update.save();
}

export function handleAutonomousModeToggled(event: AutonomousModeToggledEvent): void {
  const entity = loadOrCreateSentinel();
  entity.autonomousMode = event.params.enabled;
  entity.save();
}

export function handleThresholdUpdated(event: ThresholdUpdatedEvent): void {
  const sentinel = loadOrCreateSentinel();
  sentinel.save();

  const threshold = new Threshold(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  threshold.sentinel = SENTINEL_ID;
  threshold.thresholdType = event.params.thresholdType;
  threshold.value = event.params.newValue;
  threshold.updatedAt = event.block.timestamp;
  threshold.save();
}
