const crypto = require("crypto");
const bcrypt = require("bcrypt");
const config = require("../config/env");
const path = require("path");
const fs = require("fs");

// ══════════════════════════════════════════════════════════════════════════════
// ── JWT Helpers ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const BCRYPT_COST_FACTOR = 12;

function signJWT(payload, expiresIn = "30d") {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const expMs = expiresIn === "30d" ? 30 * 24 * 3600000
    : expiresIn === "24h" ? 24 * 3600000
    : expiresIn === "5m" ? 5 * 60000
    : 3600000;
  const jti = crypto.randomUUID();
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      jti,
      exp: Date.now() + expMs,
      iat: Date.now(),
    })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

/**
 * Sign a JWT with IP binding for audit/warning purposes.
 * @param {object} payload - User data to embed
 * @param {string} ip - The client IP to bind to the token
 * @param {string} expiresIn - Token lifetime (default 24h)
 */
function signJWTWithIP(payload, ip, expiresIn = "30d") {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const expMs = expiresIn === "30d" ? 30 * 24 * 3600000
    : expiresIn === "24h" ? 24 * 3600000
    : 3600000;
  const jti = crypto.randomUUID();
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      jti,
      ip,
      exp: Date.now() + expMs,
      iat: Date.now(),
    })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split(".");
    const expected = crypto
      .createHmac("sha256", config.jwtSecret)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Password hashing (bcrypt) ────────────────────────────────────────────────

/**
 * Hash a password using bcrypt (cost factor 12).
 * For backwards compatibility, if a salt is provided (existing scrypt users),
 * falls back to scrypt so existing passwords still verify.
 * New passwords always use bcrypt.
 *
 * Returns { hash, salt } where salt is "bcrypt" for bcrypt-hashed passwords.
 */
async function hashPasswordAsync(password, existingSalt) {
  // Legacy scrypt path: verify old passwords that were hashed with scrypt
  if (existingSalt && existingSalt !== "bcrypt") {
    const hash = crypto.scryptSync(password, existingSalt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    }).toString("hex");
    return { hash, salt: existingSalt };
  }

  // New bcrypt path
  const hash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
  return { hash, salt: "bcrypt" };
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt (salt === "bcrypt") and legacy scrypt.
 */
async function verifyPassword(password, storedHash, storedSalt) {
  if (storedSalt === "bcrypt") {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy scrypt verification
  const hash = crypto.scryptSync(password, storedSalt, 64).toString("hex");
  return hash === storedHash;
}

/**
 * Synchronous hashPassword for backward compatibility.
 * Used during signup and password reset (new passwords).
 * Falls back to scrypt if a salt is provided (for legacy verification).
 */
function hashPassword(password, salt) {
  if (salt && salt !== "bcrypt") {
    // Legacy scrypt path for verifying existing passwords
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { hash, salt };
  }
  // For new passwords, use scrypt with stronger params (sync fallback)
  // The async bcrypt path is preferred for new passwords
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  }).toString("hex");
  return { hash, salt };
}

// ── Clerk token verification (lazy — only if CLERK_SECRET_KEY is set) ──────────

async function verifyClerkToken(token) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  try {
    const { createClerkClient } = require("@clerk/backend");
    const clerk = createClerkClient({ secretKey });
    const payload = await clerk.verifyToken(token);
    return payload; // { sub: clerkUserId, ... }
  } catch {
    return null;
  }
}

// ── Auth middleware ────────────────────────────────────────────────────────────

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Authentication required" });

  const rawToken = auth.slice(7);

  // Try Clerk token first (if configured)
  if (process.env.CLERK_SECRET_KEY) {
    const clerkPayload = await verifyClerkToken(rawToken);
    if (clerkPayload) {
      // Fetch our user record keyed by Clerk user ID
      const clerkUserId = clerkPayload.sub;
      let ourUser = null;

      // Try DB first
      if (process.env.USE_DB === "true") {
        try {
          const { PrismaClient } = require("@prisma/client");
          const prisma = new PrismaClient();
          ourUser = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
          await prisma.$disconnect();
        } catch { /* fall through to file */ }
      }

      // Fall back to file store
      if (!ourUser) {
        const users = getUsersDB();
        ourUser = users.find(u => u.clerkId === clerkUserId);
      }

      if (ourUser) {
        req.user = { id: ourUser.id, email: ourUser.email, name: ourUser.name, subscriptionTier: ourUser.subscriptionTier };
        req.clerkUserId = clerkUserId;
        return next();
      }

      // Clerk user exists but no local record yet — allow through with basic identity
      req.user = { id: clerkUserId, clerkUserId, subscriptionTier: "FREE" };
      req.clerkUserId = clerkUserId;
      return next();
    }
  }

  // Fall back to custom JWT
  try {
    const { isTokenRevoked } = require("../routes/auth.routes");
    if (isTokenRevoked && isTokenRevoked(rawToken)) {
      return res.status(401).json({ error: "Token has been revoked" });
    }
  } catch (_) { /* startup race */ }

  const user = verifyJWT(rawToken);
  if (!user)
    return res.status(401).json({ error: "Invalid or expired token" });

  if (user.ip && user.ip !== req.ip) {
    console.warn(`[auth] IP mismatch for user ${user.id}: token=${user.ip}, request=${req.ip}`);
  }

  req.user = user;
  next();
}

// ── User storage (file-based) ─────────────────────────────────────────────────

function getUsersDB() {
  const p = path.join(config.dataDir, "users.json");
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function saveUsersDB(users) {
  fs.writeFileSync(
    path.join(config.dataDir, "users.json"),
    JSON.stringify(users, null, 2)
  );
}

module.exports = {
  signJWT,
  signJWTWithIP,
  verifyJWT,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  authMiddleware,
  getUsersDB,
  saveUsersDB,
  BCRYPT_COST_FACTOR,
};
