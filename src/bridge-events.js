"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTokensBridged = handleTokensBridged;
exports.handleTokensUnbridged = handleTokensUnbridged;
exports.handleTransferCompleted = handleTransferCompleted;
exports.handleBridgeInitialized = handleBridgeInitialized;
const graph_ts_1 = require("@graphprotocol/graph-ts");
const schema_1 = require("../generated/schema");
function loadOrCreateBridge(bridgeAddress) {
    const id = bridgeAddress.toHex();
    let entity = schema_1.Bridge.load(id);
    if (!entity) {
        entity = new schema_1.Bridge(id);
        entity.bridgeAddress = bridgeAddress;
        entity.totalValueLocked = graph_ts_1.BigInt.fromI32(0);
        entity.initializedAt = graph_ts_1.BigInt.fromI32(0);
    }
    return entity;
}
function handleTokensBridged(event) {
    const bridge = loadOrCreateBridge(event.address);
    bridge.totalValueLocked = bridge.totalValueLocked.plus(event.params.amount);
    bridge.save();
    const transfer = new schema_1.Transfer(event.params.transferId.toHex());
    transfer.bridge = event.address.toHex();
    transfer.sender = event.params.sender;
    transfer.recipient = event.params.recipient;
    transfer.amount = event.params.amount;
    transfer.chainId = event.params.chainId;
    transfer.tokenAddress = event.params.tokenAddress;
    transfer.transferId = event.params.transferId;
    transfer.status = 'PENDING';
    transfer.timestamp = event.block.timestamp;
    transfer.save();
}
function handleTokensUnbridged(event) {
    const entity = schema_1.Transfer.load(event.params.transferId.toHex());
    if (entity) {
        entity.status = 'COMPLETED';
        entity.save();
    }
}
function handleTransferCompleted(event) {
    const entity = schema_1.Transfer.load(event.params.transferId.toHex());
    if (entity) {
        entity.status = 'COMPLETED';
        entity.save();
    }
}
function handleBridgeInitialized(event) {
    const entity = loadOrCreateBridge(event.address);
    entity.initializedAt = event.block.timestamp;
    entity.save();
}
