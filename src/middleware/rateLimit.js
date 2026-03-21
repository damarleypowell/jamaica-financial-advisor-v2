// ══════════════════════════════════════════════════════════════════════════════
// ── In-memory Rate Limiter ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const rateLimits = new Map();

/**
 * Rate limit middleware factory.
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum requests per window
 * @returns {Function} Express middleware
 */
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const entry = rateLimits.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) {
      entry.count = 0;
      entry.reset = now + windowMs;
    }
    entry.count++;
    rateLimits.set(key, entry);
    if (entry.count > max) {
      return res
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.reset) rateLimits.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = rateLimit;
