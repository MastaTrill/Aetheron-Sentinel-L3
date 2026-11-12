'use strict';

/**
 * Minimal in-memory fixed-window rate limiter for the standalone Express demo
 * servers in this folder. Keyed by client IP; responds 429 once a client exceeds
 * `max` requests within `windowMs`. Single-process only — put a shared limiter
 * (e.g. at the gateway) in front of any multi-instance deployment.
 */
function createRateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  if (typeof sweep.unref === 'function') sweep.unref();

  return function rateLimit(req, res, next) {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests' });
    }
    return next();
  };
}

module.exports = { createRateLimiter };
