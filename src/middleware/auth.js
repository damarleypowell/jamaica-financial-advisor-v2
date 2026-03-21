const crypto = require("crypto");
const config = require("../config/env");
const path = require("path");
const fs = require("fs");

// ══════════════════════════════════════════════════════════════════════════════
// ── JWT Helpers ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function signJWT(payload, expiresIn = "7d") {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const expMs = expiresIn === "7d" ? 7 * 86400000 : 3600000;
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + expMs, iat: Date.now() })
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

// ── Password hashing (scrypt) ─────────────────────────────────────────────────

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

// ── Auth middleware ────────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Authentication required" });

  const rawToken = auth.slice(7);

  // Check in-memory revocation set (lazy-loaded to avoid circular deps)
  try {
    const { isTokenRevoked } = require("../routes/auth.routes");
    if (isTokenRevoked && isTokenRevoked(rawToken)) {
      return res.status(401).json({ error: "Token has been revoked" });
    }
  } catch (_) {
    // auth.routes not yet loaded — skip revocation check during startup
  }

  const user = verifyJWT(rawToken);
  if (!user)
    return res.status(401).json({ error: "Invalid or expired token" });
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
  verifyJWT,
  hashPassword,
  authMiddleware,
  getUsersDB,
  saveUsersDB,
};
