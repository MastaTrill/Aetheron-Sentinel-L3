import {
  WithdrawalProcessed,
  RateLimitUpdated,
  ChainLimitSet,
  RateLimiter,
} from "../generated/RateLimiter/RateLimiter";
import { RateLimitStats } from "../generated/schema";

function loadOrCreateStats(id: string): RateLimitStats {
  let stats = RateLimitStats.load(id);
  if (stats == null) {
    stats = new RateLimitStats(id);
  }
  return stats;
}

function syncStats(id: string, contract: RateLimiter, timestamp: BigInt): void {
  let stats = loadOrCreateStats(id);
  let windowStats = contract.getWindowStats();

  stats.windowStart = contract.windowStart();
  stats.windowDuration = contract.windowDuration();
  stats.currentWindowAmount = windowStats.value1;
  stats.maxWithdrawalPerWindow = windowStats.value2;
  stats.windowRemaining = windowStats.value0;
  stats.timestamp = timestamp;
  stats.save();
}

export function handleWithdrawalProcessed(event: WithdrawalProcessed): void {
  const contract = RateLimiter.bind(event.address);
  syncStats(event.address.toHex(), contract, event.block.timestamp);
}

export function handleRateLimitUpdated(event: RateLimitUpdated): void {
  const contract = RateLimiter.bind(event.address);
  syncStats(event.address.toHex(), contract, event.block.timestamp);
}

export function handleChainLimitSet(event: ChainLimitSet): void {
  const contract = RateLimiter.bind(event.address);
  syncStats(
    event.address.toHex() + "-" + event.params.chainId.toString(),
    contract,
    event.block.timestamp,
  );
}
