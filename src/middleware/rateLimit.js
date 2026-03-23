// ══════════════════════════════════════════════════════════════════════════════
// ── Rate Limiter — Redis-backed (production) or in-memory (dev) ─────────────
// ══════════════════════════════════════════════════════════════════════════════

let redis = null;

// Try to connect to Redis if REDIS_URL is set
if (process.env.REDIS_URL) {
  try {
    const Redis = require("ioredis");
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
    redis.connect().then(() => {
      console.log("✅ Redis connected for rate limiting");
    }).catch((err) => {
      console.warn("⚠️  Redis connection failed, falling back to in-memory rate limiting:", err.message);
      redis = null;
    });
  } catch (_) {
    console.warn("⚠️  ioredis not available, using in-memory rate limiting");
    redis = null;
  }
}

// In-memory fallback store
const memStore = new Map();

/**
 * Rate limit middleware factory with progressive cooldown.
 * Uses Redis in production, in-memory Map in development.
 *
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum requests per window
 * @returns {Function} Express middleware
 */
function rateLimit(windowMs, max) {
  return async (req, res, next) => {
    const key = `rl:${req.ip}:${req.path}`;
    const now = Date.now();

    try {
      if (redis) {
        // ── Redis path ──
        const windowSec = Math.ceil(windowMs / 1000);
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, windowSec);
        }

        const ttl = await redis.ttl(key);
        const remaining = Math.max(0, max - count);

        res.setHeader("X-RateLimit-Limit", String(max));
        res.setHeader("X-RateLimit-Remaining", String(remaining));
        res.setHeader("X-RateLimit-Reset", String(ttl));

        if (count > max) {
          // Progressive cooldown: double the TTL on each violation
          const violationKey = `rl:v:${req.ip}:${req.path}`;
          const violations = await redis.incr(violationKey);
          if (violations === 1) await redis.expire(violationKey, windowSec * 4);

          const cooldown = Math.min(windowSec * Math.pow(2, Math.min(violations, 6)), 3600);
          await redis.expire(key, cooldown);

          res.setHeader("Retry-After", String(cooldown));
          return res.status(429).json({ error: "Too many requests. Please try again later." });
        }

        return next();
      }
    } catch (err) {
      // Redis error — fall through to in-memory
      console.warn("[rateLimit] Redis error, falling back to memory:", err.message);
    }

    // ── In-memory fallback ──
    let entry = memStore.get(key);

    if (!entry) {
      entry = { count: 0, reset: now + windowMs, violations: 0 };
    }

    if (now > entry.reset) {
      const cooldownMultiplier = entry.violations > 0 ? Math.pow(2, Math.min(entry.violations, 6)) : 1;
      entry.count = 0;
      entry.reset = now + (windowMs * cooldownMultiplier);
      if (entry.violations > 0) entry.violations = Math.max(0, entry.violations - 1);
    }

    entry.count++;
    memStore.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.reset - now) / 1000);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetSeconds));

    if (entry.count > max) {
      entry.violations++;
      const cooldownMultiplier = Math.pow(2, Math.min(entry.violations, 6));
      entry.reset = now + (windowMs * cooldownMultiplier);
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    next();
  };
}

// ── Pre-configured rate limiters ────────────────────────────────────────────

/** Signup: 3 requests per 15 minutes per IP */
rateLimit.signup = () => rateLimit(15 * 60 * 1000, 3);

/** Login: 10 requests per 15 minutes per IP */
rateLimit.login = () => rateLimit(15 * 60 * 1000, 10);

/** Password reset: 3 requests per hour per IP */
rateLimit.passwordReset = () => rateLimit(60 * 60 * 1000, 3);

/** 2FA setup: 3 requests per hour per IP */
rateLimit.twoFactorSetup = () => rateLimit(60 * 60 * 1000, 3);

// Clean up expired in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (now > entry.reset) memStore.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = rateLimit;
