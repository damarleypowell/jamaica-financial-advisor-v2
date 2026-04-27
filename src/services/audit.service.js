/**
 * Audit Logging Service
 * Logs security-relevant events for compliance and monitoring
 * Uses winston for structured logging with file rotation
 */

"use strict";

const winston = require("winston");
const path = require("path");
const fs = require("fs");

const LOG_DIR = process.env.VERCEL
  ? "/tmp/gotham-logs"
  : path.join(__dirname, "..", "..", "logs");
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  console.warn(`[audit] Could not create log dir ${LOG_DIR}: ${err.message}`);
}

// ─── Winston Logger ──────────────────────────────────────

const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.json()
  ),
  defaultMeta: { service: "jse-platform" },
  transports: [
    // Security events (auth, orders, admin actions)
    new winston.transports.File({
      filename: path.join(LOG_DIR, "security.log"),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      level: "info",
    }),
    // Errors only
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      level: "error",
    }),
  ],
});

// Also log to console in development
if (process.env.NODE_ENV !== "production") {
  auditLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const action = meta.action || "";
          return `${timestamp} [${level}] ${action}: ${message}`;
        })
      ),
      level: "warn", // only warnings+ to console to avoid noise
    })
  );
}

// ─── Audit Event Types ───────────────────────────────────

const AuditAction = {
  // Auth
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  SIGNUP: "SIGNUP",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  EMAIL_VERIFICATION_SENT: "EMAIL_VERIFICATION_SENT",
  TOKEN_REFRESH: "TOKEN_REFRESH",

  // Trading
  ORDER_PLACED: "ORDER_PLACED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_FILLED: "ORDER_FILLED",
  POSITION_CLOSED: "POSITION_CLOSED",

  // Wallet
  WALLET_DEPOSIT: "WALLET_DEPOSIT",
  WALLET_WITHDRAWAL: "WALLET_WITHDRAWAL",

  // Admin/Security
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
  INVALID_TOKEN: "INVALID_TOKEN",
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
  API_ERROR: "API_ERROR",
};

// ─── Logging Functions ───────────────────────────────────

/**
 * Log a security-relevant audit event
 */
function logAudit(action, details = {}) {
  const entry = {
    action,
    ip: details.ip || "unknown",
    userId: details.userId || null,
    ...details,
  };

  // Errors go to error level
  if (action.includes("FAILED") || action.includes("ERROR") || action.includes("SUSPICIOUS")) {
    auditLogger.warn(details.message || action, entry);
  } else {
    auditLogger.info(details.message || action, entry);
  }
}

/**
 * Express middleware to log all requests to sensitive endpoints
 */
function auditMiddleware(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const path = req.originalUrl || req.url;

    // Only log sensitive endpoints
    if (
      path.startsWith("/api/auth") ||
      path.startsWith("/api/orders") ||
      path.startsWith("/api/wallet") ||
      path.startsWith("/api/us/orders") ||
      path.startsWith("/api/us/positions")
    ) {
      logAudit("REQUEST", {
        method: req.method,
        path,
        status: res.statusCode,
        duration,
        ip: req.ip || req.connection?.remoteAddress,
        userId: req.user?.id || null,
        userAgent: req.headers["user-agent"]?.substring(0, 200),
      });
    }
  });

  next();
}

module.exports = { logAudit, auditMiddleware, AuditAction };
