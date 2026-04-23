import { BigInt, Address } from '@graphprotocol/graph-ts';
import {
  RateLimiter,
  WithdrawalProcessed as WithdrawalProcessedEvent,
  RateLimitUpdated as RateLimitUpdatedEvent,
  ChainLimitSet as ChainLimitSetEvent,
} from '../generated/RateLimiter/RateLimiter';
import { RateLimitStats, Withdrawal } from '../generated/schema';

export function handleWithdrawalProcessed(
  event: WithdrawalProcessedEvent,
): void {
  let entity = new Withdrawal(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString(),
  );
  entity.rateLimit = event.params.chainId.toString();
  entity.user = event.params.user;
  entity.amount = event.params.amount;
  entity.timestamp = event.params.timestamp;

  entity.save();

  // Update rate limit stats
  let stats = RateLimitStats.load(event.params.chainId.toString());
  if (stats) {
    stats.currentUsage = stats.currentUsage.plus(event.params.amount);
    stats.save();
  }
}

export function handleRateLimitUpdated(event: RateLimitUpdatedEvent): void {
  let entity = RateLimitStats.load(event.params.chainId.toString());
  if (!entity) {
    entity = new RateLimitStats(event.params.chainId.toString());
    entity.currentUsage = BigInt.fromI32(0);
    entity.lastUpdate = BigInt.fromI32(0);
  }
  entity.chainId = event.params.chainId;
  entity.limit = event.params.newLimit;
  entity.lastUpdate = event.block.timestamp;
  entity.save();
}

export function handleChainLimitSet(event: ChainLimitSetEvent): void {
  let entity = RateLimitStats.load(event.params.chainId.toString());
  if (!entity) {
    entity = new RateLimitStats(event.params.chainId.toString());
    entity.currentUsage = BigInt.fromI32(0);
  }
  entity.chainId = event.params.chainId;
  entity.limit = event.params.limit;
  entity.lastUpdate = event.block.timestamp;

  entity.save();
}
