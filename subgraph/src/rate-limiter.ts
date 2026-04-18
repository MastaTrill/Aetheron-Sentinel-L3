import {
  WithdrawalProcessed,
  RateLimitUpdated,
  ChainLimitSet,
  RateLimiter,
} from "../generated/RateLimiter/RateLimiter";
import { RateLimitStats } from "../generated/schema";
import { Address } from "@graphprotocol/graph-ts";

function loadOrCreateStats(id: string): RateLimitStats {
  let stats = RateLimitStats.load(id);
  if (stats == null) {
    stats = new RateLimitStats(id);
  }
  return stats;
}

export function handleWithdrawalProcessed(event: WithdrawalProcessed): void {
  const contract = RateLimiter.bind(event.address);
  const id = event.address.toHex();
  let stats = loadOrCreateStats(id);

  stats.windowStart = contract.windowStart();
  stats.windowDuration = contract.windowDuration();
  stats.currentWindowAmount = contract.currentWindowAmount();
  stats.maxWithdrawalPerWindow = contract.maxWithdrawalPerWindow();
  stats.windowRemaining = event.params.windowRemaining;
  stats.timestamp = event.block.timestamp;
  stats.save();
}

export function handleRateLimitUpdated(event: RateLimitUpdated): void {
  const contract = RateLimiter.bind(event.address);
  const id = event.address.toHex();
  let stats = loadOrCreateStats(id);

  stats.windowStart = contract.windowStart();
  stats.windowDuration = event.params.windowDuration;
  stats.currentWindowAmount = contract.currentWindowAmount();
  stats.maxWithdrawalPerWindow = event.params.newLimit;
  let windowStats = contract.getWindowStats();
  stats.windowRemaining = windowStats.value0;
  stats.timestamp = event.block.timestamp;
  stats.save();
}

export function handleChainLimitSet(event: ChainLimitSet): void {
  const contract = RateLimiter.bind(event.address);
  const id = event.address.toHex() + "-" + event.params.chainId.toString();
  let stats = loadOrCreateStats(id);

  stats.windowStart = contract.windowStart();
  stats.windowDuration = contract.windowDuration();
  stats.currentWindowAmount = contract.currentWindowAmount();
  stats.maxWithdrawalPerWindow = event.params.limit;
  let windowStats = contract.getWindowStats();
  stats.windowRemaining = windowStats.value0;
  stats.timestamp = event.block.timestamp;
  stats.save();
}
