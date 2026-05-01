"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAnomalyDetected = handleAnomalyDetected;
exports.handleAutonomousPauseTriggered = handleAutonomousPauseTriggered;
exports.handleTVLUpdated = handleTVLUpdated;
exports.handleAutonomousModeToggled = handleAutonomousModeToggled;
exports.handleThresholdUpdated = handleThresholdUpdated;
const graph_ts_1 = require("@graphprotocol/graph-ts");
const schema_1 = require("../generated/schema");
const SENTINEL_ID = 'sentinel-global';
function loadOrCreateSentinel() {
    let entity = schema_1.Sentinel.load(SENTINEL_ID);
    if (!entity) {
        entity = new schema_1.Sentinel(SENTINEL_ID);
        entity.anomalyCount = graph_ts_1.BigInt.fromI32(0);
        entity.lastAnomalyBlock = graph_ts_1.BigInt.fromI32(0);
        entity.autonomousMode = false;
    }
    return entity;
}
function handleAnomalyDetected(event) {
    const entity = loadOrCreateSentinel();
    entity.anomalyCount = entity.anomalyCount.plus(graph_ts_1.BigInt.fromI32(1));
    entity.lastAnomalyBlock = event.params.blockNumber;
    entity.save();
}
function handleAutonomousPauseTriggered(event) {
    const entity = loadOrCreateSentinel();
    entity.autonomousMode = false;
    entity.save();
}
function handleTVLUpdated(event) {
    const sentinel = loadOrCreateSentinel();
    sentinel.save();
    const update = new schema_1.TVLUpdate(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
    update.sentinel = SENTINEL_ID;
    update.tvl = event.params.newTVL;
    update.timestamp = event.block.timestamp;
    update.save();
}
function handleAutonomousModeToggled(event) {
    const entity = loadOrCreateSentinel();
    entity.autonomousMode = event.params.enabled;
    entity.save();
}
function handleThresholdUpdated(event) {
    const sentinel = loadOrCreateSentinel();
    sentinel.save();
    const threshold = new schema_1.Threshold(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
    threshold.sentinel = SENTINEL_ID;
    threshold.thresholdType = event.params.thresholdType;
    threshold.value = event.params.newValue;
    threshold.updatedAt = event.block.timestamp;
    threshold.save();
}
