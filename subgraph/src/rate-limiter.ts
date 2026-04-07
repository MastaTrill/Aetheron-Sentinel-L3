import {
  WithdrawalProcessed,
  RateLimitUpdated,
  ChainLimitSet,
} from "../generated/RateLimiter/RateLimiter";
import { RateLimitStats } from "../generated/schema";

// Event handlers for RateLimiter contract
export function handleWithdrawalProcessed(event: WithdrawalProcessed): void {
  let stats = new RateLimitStats(event.transaction.hash.toHex());
  stats.withdrawalAmount = event.params.amount;
  stats.timestamp = event.block.timestamp;
  stats.chainId = event.params.chainId;
  stats.save();
}

export function handleRateLimitUpdated(event: RateLimitUpdated): void {
  // Update rate limit configuration
  // This would typically update global rate limit settings
}

export function handleChainLimitSet(event: ChainLimitSet): void {
  // Update chain-specific limits
  // This would typically update per-chain rate limits
}
