"use strict";
// ── Express app setup (no listen — imported by server.js and api/index.js) ───

const express = require("express");
const path    = require("path");

let prisma;
try { prisma = require("./config/database").prisma; } catch (_) { prisma = null; }
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const { securityHeaders, corsMiddleware, csrfProtection } = require("./middleware/security");
const { sanitizeBody, protectBody } = require("./middleware/validation");
const { auditMiddleware } = require("./services/audit.service");
const {
  ipBlockMiddleware, generalLimiter, authLimiter,
  adminLimiter, aiLimiter, honeypotMiddleware, suspiciousRequestDetector,
} = require("./middleware/firewall");

const authRoutes         = require("./routes/auth.routes");
const marketRoutes       = require("./routes/market.routes");
const aiRoutes           = require("./routes/ai.routes");
const orderRoutes        = require("./routes/orders.routes");
const analyticsRoutes    = require("./routes/analytics.routes");
const usStocksRoutes     = require("./routes/us-stocks.routes");
const alertRoutes        = require("./routes/alerts.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const adminRoutes        = require("./routes/admin.routes");
const paymentRoutes      = require("./routes/payment.routes");
const kycRoutes          = require("./routes/kyc.routes");
const watchlistRoutes    = require("./routes/watchlist.routes");
const docsRoutes         = require("./routes/docs.routes");
const marketService      = require("./services/market.service");

const app = express();
app.disable("trust proxy");
app.set("x-powered-by", false);

// Firewall
app.use(suspiciousRequestDetector);
app.use(ipBlockMiddleware);
app.use(honeypotMiddleware);

// Security headers & CORS
app.use(securityHeaders);
app.use(corsMiddleware);

// Rate limiting
app.use('/api/auth',   authLimiter);
app.use('/api/admin',  adminLimiter);
app.use(['/api/ai', '/api/chat', '/api/analysis'], aiLimiter);
app.use('/api',        generalLimiter);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(csrfProtection);
app.use(protectBody);
app.use(sanitizeBody);
app.use(auditMiddleware);

// Static files — only in non-Vercel (Vercel serves them from CDN)
if (!process.env.VERCEL) {
  const staticDir = path.join(__dirname, "..", "public-react");
  app.use(express.static(staticDir));
}

// Routes
app.use(authRoutes);
app.use(marketRoutes);
app.use(aiRoutes);
app.use(orderRoutes);
app.use(alertRoutes);
app.use(subscriptionRoutes);
app.use(adminRoutes);
app.use(paymentRoutes);
app.use(kycRoutes);
app.use(watchlistRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/us",        usStocksRoutes);
app.use(docsRoutes);

app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    stocks: marketService.livePrices.length,
    database: USE_DB ? "postgresql" : "file-based",
  })
);

// SPA fallback — only in non-Vercel
if (!process.env.VERCEL) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public-react", "index.html"));
  });
}

module.exports = app;
