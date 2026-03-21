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
const DATA_DIR = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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
};

module.exports = config;
