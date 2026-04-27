require("dotenv").config();
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// ── Required environment variables ────────────────────────────────────────────
const REQUIRED_VARS = ["ANTHROPIC_API_KEY"];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error("Please set them in your .env file.");
  process.exit(1);
}

// ── Data directory ────────────────────────────────────────────────────────────
// Vercel (and other serverless platforms) have a read-only filesystem.
// Only /tmp is writable on Vercel. Fall back to /tmp when VERCEL is set.
const DATA_DIR = process.env.VERCEL
  ? "/tmp/gotham-data"
  : path.join(__dirname, "..", "..", "data");

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (err) {
  // On read-only filesystems the app will rely entirely on DATABASE_URL.
  console.warn(`[env] Could not create data dir ${DATA_DIR}: ${err.message}`);
}

// ── Config object ─────────────────────────────────────────────────────────────
const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || null,
  databaseUrl: process.env.DATABASE_URL || null,
  dataDir: DATA_DIR,
  priceRefreshInterval: 30 * 1000, // 30 seconds
  enrichInterval: 10 * 60 * 1000, // 10 minutes
  newsRefreshInterval: 10 * 60 * 1000, // 10 minutes

  // ── SMTP / Email ──────────────────────────────────────────────────────────
  smtpHost: process.env.SMTP_HOST || process.env.EMAIL_HOST || null,
  smtpPort: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT, 10) || 587,
  smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER || null,
  smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASS || null,
  appUrl: process.env.APP_URL || "http://localhost:3000",
};

module.exports = config;
