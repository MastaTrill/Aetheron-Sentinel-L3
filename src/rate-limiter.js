"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWithdrawalProcessed = handleWithdrawalProcessed;
exports.handleRateLimitUpdated = handleRateLimitUpdated;
exports.handleChainLimitSet = handleChainLimitSet;
const graph_ts_1 = require("@graphprotocol/graph-ts");
const schema_1 = require("../generated/schema");
function handleWithdrawalProcessed(event) {
    const entity = new schema_1.Withdrawal(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
    entity.rateLimit = event.params.chainId.toString();
    entity.user = event.params.user;
    entity.amount = event.params.amount;
    entity.timestamp = event.params.timestamp;
    entity.save();
    // Update rate limit stats
    const stats = schema_1.RateLimitStats.load(event.params.chainId.toString());
    if (stats) {
        stats.currentUsage = stats.currentUsage.plus(event.params.amount);
        stats.save();
    }
}
function handleRateLimitUpdated(event) {
    let entity = schema_1.RateLimitStats.load(event.params.chainId.toString());
    if (!entity) {
        entity = new schema_1.RateLimitStats(event.params.chainId.toString());
        entity.currentUsage = graph_ts_1.BigInt.fromI32(0);
        entity.lastUpdate = graph_ts_1.BigInt.fromI32(0);
    }
    entity.chainId = event.params.chainId;
    entity.limit = event.params.newLimit;
    entity.lastUpdate = event.block.timestamp;
    entity.save();
}
function handleChainLimitSet(event) {
    let entity = schema_1.RateLimitStats.load(event.params.chainId.toString());
    if (!entity) {
        entity = new schema_1.RateLimitStats(event.params.chainId.toString());
        entity.currentUsage = graph_ts_1.BigInt.fromI32(0);
    }
    entity.chainId = event.params.chainId;
    entity.limit = event.params.limit;
    entity.lastUpdate = event.block.timestamp;
    entity.save();
}
