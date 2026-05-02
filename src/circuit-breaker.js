'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.handleCircuitOpened = handleCircuitOpened;
exports.handleCircuitHalfOpened = handleCircuitHalfOpened;
exports.handleCircuitClosed = handleCircuitClosed;
exports.handleFailureRecorded = handleFailureRecorded;
exports.handleSuccessRecorded = handleSuccessRecorded;
const graph_ts_1 = require('@graphprotocol/graph-ts');
const schema_1 = require('../generated/schema');
function handleCircuitOpened(event) {
  let entity = schema_1.CircuitBreakerState.load(event.params.chainId.toString());
  if (!entity) {
    entity = new schema_1.CircuitBreakerState(event.params.chainId.toString());
  }
  entity.chainId = event.params.chainId;
  entity.state = 'OPEN';
  entity.failureCount = event.params.failureCount;
  entity.lastFailure = event.block.timestamp;
  entity.save();
}
function handleCircuitHalfOpened(event) {
  const entity = schema_1.CircuitBreakerState.load(event.params.chainId.toString());
  if (entity) {
    entity.state = 'HALF_OPEN';
    entity.save();
  }
}
function handleCircuitClosed(event) {
  const entity = schema_1.CircuitBreakerState.load(event.params.chainId.toString());
  if (entity) {
    entity.state = 'CLOSED';
    entity.failureCount = graph_ts_1.BigInt.fromI32(0);
    entity.save();
  }
}
function handleFailureRecorded(event) {
  let entity = schema_1.CircuitBreakerState.load(event.params.chainId.toString());
  if (!entity) {
    entity = new schema_1.CircuitBreakerState(event.params.chainId.toString());
    entity.chainId = event.params.chainId;
    entity.state = 'CLOSED';
    entity.failureCount = graph_ts_1.BigInt.fromI32(0);
    entity.lastFailure = graph_ts_1.BigInt.fromI32(0);
    entity.lastSuccess = graph_ts_1.BigInt.fromI32(0);
  }
  entity.failureCount = entity.failureCount.plus(graph_ts_1.BigInt.fromI32(1));
  entity.lastFailure = event.block.timestamp;
  entity.save();
}
function handleSuccessRecorded(event) {
  let entity = schema_1.CircuitBreakerState.load(event.params.chainId.toString());
  if (!entity) {
    entity = new schema_1.CircuitBreakerState(event.params.chainId.toString());
    entity.chainId = event.params.chainId;
    entity.state = 'CLOSED';
    entity.failureCount = graph_ts_1.BigInt.fromI32(0);
    entity.lastFailure = graph_ts_1.BigInt.fromI32(0);
    entity.lastSuccess = graph_ts_1.BigInt.fromI32(0);
  }
  entity.lastSuccess = event.block.timestamp;
  entity.save();
}
