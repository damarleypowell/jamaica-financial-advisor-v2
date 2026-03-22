// ══════════════════════════════════════════════════════════════════════════════
// ── In-memory Rate Limiter with Progressive Cooldown ────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const rateLimits = new Map();

/**
 * Rate limit middleware factory with progressive cooldown.
 * After hitting the limit, each subsequent request doubles the cooldown period.
 *
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum requests per window
 * @returns {Function} Express middleware
 */
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    let entry = rateLimits.get(key);

    if (!entry) {
      entry = { count: 0, reset: now + windowMs, baseWindow: windowMs, violations: 0 };
    }

    // If window has expired, reset — but keep violation count for progressive cooldown
    if (now > entry.reset) {
      // Progressive cooldown: if they had violations, double the window
      const cooldownMultiplier = entry.violations > 0 ? Math.pow(2, Math.min(entry.violations, 6)) : 1;
      const effectiveWindow = windowMs * cooldownMultiplier;

      entry.count = 0;
      entry.reset = now + effectiveWindow;
      entry.baseWindow = windowMs;

      // Decay violations over time (reset after a clean window)
      if (entry.violations > 0) {
        entry.violations = Math.max(0, entry.violations - 1);
      }
    }

    entry.count++;
    rateLimits.set(key, entry);

    // Set rate limit headers
    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.reset - now) / 1000);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetSeconds));

    if (entry.count > max) {
      // Increment violations for progressive cooldown
      entry.violations++;
      const cooldownMultiplier = Math.pow(2, Math.min(entry.violations, 6));
      entry.reset = now + (windowMs * cooldownMultiplier);

      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Reset", String(retryAfter));

      return res
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}

// ── Pre-configured rate limiters for auth endpoints ──────────────────────────

/** Signup: 3 requests per 15 minutes per IP */
rateLimit.signup = () => rateLimit(15 * 60 * 1000, 3);

/** Login: 10 requests per 15 minutes per IP */
rateLimit.login = () => rateLimit(15 * 60 * 1000, 10);

/** Password reset: 3 requests per hour per IP */
rateLimit.passwordReset = () => rateLimit(60 * 60 * 1000, 3);

/** 2FA setup: 3 requests per hour per IP */
rateLimit.twoFactorSetup = () => rateLimit(60 * 60 * 1000, 3);

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.reset) rateLimits.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = rateLimit;
