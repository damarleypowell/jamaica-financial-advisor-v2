// ══════════════════════════════════════════════════════════════════════════════
// ── Security Middleware ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Security headers middleware.
 * Sets X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
 * Referrer-Policy, Permissions-Policy, Content-Security-Policy, and CORS headers.
 */
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=()"
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:;"
  );
  next();
}

/**
 * CORS middleware.
 * In production, restrict to specific domains. In development, allow localhost.
 */
function corsMiddleware(req, res, next) {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

/**
 * CSRF protection via double-submit cookie pattern.
 * On GET requests, sets a random CSRF token cookie.
 * On state-changing requests (POST/PUT/DELETE), validates
 * that the X-CSRF-Token header matches the cookie.
 * Skipped for requests with Bearer token auth (API clients).
 */
function csrfProtection(req, res, next) {
  const crypto = require("crypto");

  // Skip for API clients using Bearer auth (JWT) — CSRF only matters for cookie-based auth
  // But we add it as defense-in-depth for any future cookie usage
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    return next();
  }

  // For GET/HEAD/OPTIONS — set the CSRF cookie if not present
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!req.headers.cookie || !req.headers.cookie.includes("csrf_token")) {
      const token = crypto.randomBytes(32).toString("hex");
      res.setHeader("Set-Cookie", `csrf_token=${token}; Path=/; SameSite=Strict; HttpOnly=false`);
    }
    return next();
  }

  // For state-changing methods, validate the token
  const cookieHeader = req.headers.cookie || "";
  const cookieToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrf_token="));
  const csrfCookie = cookieToken ? cookieToken.split("=")[1] : null;
  const csrfHeader = req.headers["x-csrf-token"];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    // Allow requests without cookies (pure API usage with JWT)
    if (!cookieHeader.includes("csrf_token")) {
      return next();
    }
    return res.status(403).json({ error: "CSRF token mismatch" });
  }

  next();
}

module.exports = { securityHeaders, corsMiddleware, csrfProtection };
