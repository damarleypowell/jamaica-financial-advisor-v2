"use strict";

const { Router } = require("express");
const { authMiddleware } = require("../middleware/auth");
const { logAudit } = require("../services/audit.service");
const os = require("os");
const process = require("process");

// Lazy-load firewall to avoid circular deps (firewall imports admin for pushSecurityEvent)
function getFirewall() {
  try { return require("../middleware/firewall"); } catch (_) { return null; }
}

let prisma;
try { prisma = require("../config/database").prisma; } catch (_) { prisma = null; }
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const router = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

function isAdmin(req) {
  return ADMIN_EMAILS.includes((req.user?.email || "").toLowerCase());
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ error: "Admin access required" });
  next();
}

// Tier is NOT a User column — it lives in the Subscription relation (admin
// emails are treated as ENTERPRISE). Derive it from a user that included
// `subscription: { select: { plan: true } }`.
function tierOf(u) {
  if (u && ADMIN_EMAILS.includes((u.email || "").toLowerCase())) return "ENTERPRISE";
  return (u && u.subscription && u.subscription.plan) || "FREE";
}

const startTime = Date.now();

// ── Security event log (in-memory ring buffer) ────────────────────────────────
const MAX_EVENTS = 500;
const securityEvents = [];
function pushEvent(type, detail, severity = "medium") {
  securityEvents.unshift({ id: Date.now() + Math.random(), type, detail, severity, ts: new Date().toISOString() });
  if (securityEvents.length > MAX_EVENTS) securityEvents.pop();
}
exports.pushSecurityEvent = pushEvent;

// ── Broadcast store ───────────────────────────────────────────────────────────
const broadcasts = [];

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/dashboard
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/dashboard", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ error: "Admin dashboard requires database mode" });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers, newUsersToday, newUsersMonth, newUsersLastMonth,
      totalOrders, ordersToday, ordersMonth,
      activeSubscriptions, totalAlerts,
      recentUsers, recentOrders, subscriptionBreakdown, ordersByStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.subscription?.count({ where: { status: "ACTIVE" } }).catch(() => 0) ?? 0,
      prisma.priceAlert?.count({ where: { isTriggered: false } }).catch(() => 0) ?? 0,
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, email: true, createdAt: true, kycStatus: true, isActive: true, subscription: { select: { plan: true } } } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true, email: true } } } }),
      prisma.subscription.groupBy({ by: ["plan"], where: { status: "ACTIVE" }, _count: { plan: true } }).catch(() => []),
      prisma.order.groupBy({ by: ["status"], _count: { status: true } }),
    ]);

    // User growth (last 30 days daily)
    const growth = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = await prisma.user.count({ where: { createdAt: { gte: d, lt: next } } });
      growth.push({ date: d.toISOString().slice(0, 10), count });
    }

    res.json({
      totalUsers, newUsersToday, newUsersMonth, newUsersLastMonth,
      totalOrders, ordersToday, ordersMonth, activeSubscriptions, totalAlerts,
      recentUsers: recentUsers.map(u => ({ ...u, subscriptionTier: tierOf(u) })),
      recentOrders,
      subscriptionBreakdown: (() => {
        const paid = subscriptionBreakdown.map(s => ({ plan: s.plan, count: s._count.plan }));
        const paidTotal = paid.reduce((a, b) => a + b.count, 0);
        return [{ plan: "FREE", count: Math.max(0, totalUsers - paidTotal) }, ...paid];
      })(),
      ordersByStatus: ordersByStatus.map(o => ({ status: o.status, count: o._count.status })),
      userGrowth: growth,
    });
  } catch (err) {
    console.error("[admin/dashboard]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ users: [], total: 0 });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const search = (req.query.search || "").trim();
    const tier = req.query.tier || "";
    const status = req.query.status || "";
    const skip = (page - 1) * limit;

    const where = {};
    if (search) where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
    if (tier) where.subscription = tier === "FREE" ? { is: null } : { is: { plan: tier } };
    if (status === "active") where.isActive = true;
    if (status === "suspended") where.isActive = false;

    const [rawUsers, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit, orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, createdAt: true, updatedAt: true, isActive: true, emailVerified: true, kycStatus: true, onboardingCompleted: true, settings: true, subscription: { select: { plan: true, status: true } }, _count: { select: { orders: true, portfolioPositions: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    const users = rawUsers.map(u => {
      const { settings, subscription, ...rest } = u;
      return { ...rest, subscriptionTier: tierOf(u), accountType: (settings && settings.accountType) || "paper" };
    });

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[admin/users]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users/:id
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.status(404).json({ error: "Not found" });
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { wallets: true, portfolioPositions: true, orders: { orderBy: { createdAt: "desc" }, take: 20 }, priceAlerts: { take: 10 }, subscription: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash, salt, twoFactorSecret, ...safe } = user;
    res.json({ ...safe, subscriptionTier: tierOf(user), accountType: (user.settings && user.settings.accountType) || "paper" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/users/:id — Update any user field
// ══════════════════════════════════════════════════════════════════════════════
router.put("/api/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.status(400).json({ error: "Requires database mode" });

    const VALID_TIERS = ["FREE", "CORE", "PRO", "ENTERPRISE"];
    const VALID_KYC   = ["NONE", "PENDING", "VERIFIED", "REJECTED"];

    const id = req.params.id;
    const data = {};
    const { isActive, kycStatus, subscriptionTier, emailVerified, accountType, notes } = req.body;
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (kycStatus && VALID_KYC.includes(kycStatus)) data.kycStatus = kycStatus;
    if (typeof emailVerified === "boolean") data.emailVerified = emailVerified;

    // accountType + notes live in the settings JSON — merge, don't overwrite.
    if ((accountType && ["paper", "live"].includes(accountType)) || notes !== undefined) {
      const cur = await prisma.user.findUnique({ where: { id }, select: { settings: true } });
      const merged = (cur && cur.settings && typeof cur.settings === "object") ? { ...cur.settings } : {};
      if (accountType && ["paper", "live"].includes(accountType)) merged.accountType = accountType;
      if (notes !== undefined) merged.notes = notes;
      data.settings = merged;
    }

    // Tier is in the Subscription table, not on User.
    if (subscriptionTier && VALID_TIERS.includes(subscriptionTier)) {
      if (subscriptionTier === "FREE") {
        await prisma.subscription.deleteMany({ where: { userId: id } });
      } else {
        const periodEnd = new Date(); periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        await prisma.subscription.upsert({
          where: { userId: id },
          update: { plan: subscriptionTier, status: "ACTIVE", currentPeriodEnd: periodEnd },
          create: { id: require("crypto").randomUUID(), userId: id, plan: subscriptionTier, status: "ACTIVE", currentPeriodEnd: periodEnd },
        });
      }
    }

    if (Object.keys(data).length === 0 && !subscriptionTier) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const sel = { id: true, name: true, email: true, isActive: true, kycStatus: true, emailVerified: true, subscription: { select: { plan: true } } };
    const updated = Object.keys(data).length > 0
      ? await prisma.user.update({ where: { id }, data, select: sel })
      : await prisma.user.findUnique({ where: { id }, select: sel });

    logAudit?.("ADMIN_USER_UPDATE", { adminId: req.user.id, adminEmail: req.user.email, targetUserId: id, changes: { ...data, subscriptionTier }, ip: req.ip });
    pushEvent("USER_UPDATE", `Admin ${req.user.email} updated user ${id}`, "low");
    res.json({ ...updated, subscriptionTier: tierOf(updated) });
  } catch (err) {
    console.error("[admin/users PUT]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id — Soft-delete (deactivate + anonymize)
// ══════════════════════════════════════════════════════════════════════════════
router.delete("/api/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.status(400).json({ error: "Requires database mode" });
    if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot delete your own account" });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false, email: `deleted_${req.params.id}@gotham.internal`, name: "Deleted User" },
    });

    pushEvent("USER_DELETED", `Admin ${req.user.email} deleted user ${req.params.id}`, "high");
    logAudit?.("ADMIN_USER_DELETE", { adminId: req.user.id, targetUserId: req.params.id, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/orders
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/orders", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ orders: [], total: 0 });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const statusFilter = req.query.status || "";
    const symbol = (req.query.symbol || "").toUpperCase();
    const skip = (page - 1) * limit;

    const where = {};
    if (statusFilter) where.status = statusFilter;
    if (symbol) where.symbol = symbol;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system/health
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/system/health", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const uptimeMs = Date.now() - startTime;
    const mem = process.memoryUsage();
    const cpus = os.cpus();

    let dbLatency = null;
    let dbStatus = "disconnected";
    if (USE_DB) {
      const t0 = Date.now();
      try { await prisma.$queryRaw`SELECT 1`; dbLatency = Date.now() - t0; dbStatus = "connected"; }
      catch { dbStatus = "error"; }
    }

    const services = {
      api:    { status: "up",    latency: null },
      db:     { status: dbStatus, latency: dbLatency },
      sse:    { status: "up",    latency: null },
      alpaca: { status: process.env.ALPACA_API_KEY ? "configured" : "not_configured" },
      finnhub:{ status: process.env.FINNHUB_API ? "configured" : "not_configured" },
      clerk:  { status: process.env.CLERK_SECRET_KEY ? "configured" : "not_configured" },
      email:  { status: process.env.EMAIL_HOST ? "configured" : "not_configured" },
    };

    res.json({
      uptime: uptimeMs,
      uptimeFormatted: formatUptime(uptimeMs),
      nodeVersion: process.version,
      platform: os.platform(),
      memory: { used: mem.heapUsed, total: mem.heapTotal, rss: mem.rss, external: mem.external },
      cpu: { count: cpus.length, model: cpus[0]?.model ?? "unknown", load: os.loadavg() },
      services,
      env: process.env.NODE_ENV || "development",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/security/events
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/security/events", authMiddleware, requireAdmin, (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const type = req.query.type || "";
  const filtered = type ? securityEvents.filter(e => e.type === type) : securityEvents;
  res.json({ events: filtered.slice(0, limit), total: filtered.length });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/audit
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/audit", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ entries: [], total: 0 });
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      prisma.auditLog?.findMany({ orderBy: { createdAt: "desc" }, take: limit, skip }) ?? [],
      prisma.auditLog?.count() ?? 0,
    ]);
    res.json({ entries, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.json({ entries: [], total: 0 });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/analytics/growth — User growth over time
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/analytics/growth", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ daily: [] });
    const days = Math.min(90, parseInt(req.query.days) || 30);
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const [users, orders] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: d, lt: next } } }),
        prisma.order.count({ where: { createdAt: { gte: d, lt: next } } }),
      ]);
      data.push({ date: d.toISOString().slice(0, 10), users, orders });
    }
    res.json({ daily: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/market/refresh — Force market data refresh
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/admin/market/refresh", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const marketService = require("../services/market.service");
    await marketService.refreshPrices?.();
    pushEvent("MARKET_REFRESH", `Manual refresh triggered by ${req.user.email}`, "low");
    res.json({ ok: true, message: "Market data refresh triggered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/broadcast — Send announcement to all users
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/admin/broadcast", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { title, message, type = "info" } = req.body;
    if (!title || !message) return res.status(400).json({ error: "title and message required" });
    if (!["info", "warning", "success", "critical"].includes(type)) return res.status(400).json({ error: "Invalid type" });

    const entry = { id: Date.now(), title, message, type, sentBy: req.user.email, sentAt: new Date().toISOString(), read: [] };
    broadcasts.unshift(entry);
    if (broadcasts.length > 100) broadcasts.pop();

    pushEvent("BROADCAST_SENT", `Admin ${req.user.email} sent broadcast: "${title}"`, "medium");
    res.json({ ok: true, broadcast: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/broadcasts
router.get("/api/admin/broadcasts", authMiddleware, requireAdmin, (req, res) => {
  res.json({ broadcasts });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/security/block-ip
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/admin/security/block-ip", authMiddleware, requireAdmin, (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: "ip required" });
  const fw = getFirewall();
  if (fw) fw.blockIP(ip);
  pushEvent("IP_BLOCKED", `IP ${ip} blocked by ${req.user.email}`, "high");
  res.json({ ok: true, blockedIPs: fw ? fw.getBlockedIPs() : [ip] });
});

router.delete("/api/admin/security/block-ip/:ip", authMiddleware, requireAdmin, (req, res) => {
  const fw = getFirewall();
  if (fw) fw.unblockIP(req.params.ip);
  res.json({ ok: true, blockedIPs: fw ? fw.getBlockedIPs() : [] });
});

router.get("/api/admin/security/blocked-ips", authMiddleware, requireAdmin, (req, res) => {
  const fw = getFirewall();
  res.json({ blockedIPs: fw ? fw.getBlockedIPs() : [] });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/stats/quick — Lightweight poll (every 10s)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/stats/quick", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const mem = process.memoryUsage();
    const total = USE_DB ? await prisma.user.count() : 0;
    const fw = getFirewall();
    res.json({ heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, uptime: Date.now() - startTime, totalUsers: total, securityEvents: securityEvents.length, blockedIPs: fw ? fw.getBlockedIPs().length : 0 });
  } catch {
    res.json({ heapUsed: 0, heapTotal: 0, uptime: 0, totalUsers: 0 });
  }
});

module.exports = router;
// Re-attach after the router assignment above (which would otherwise wipe the
// earlier `exports.pushSecurityEvent`). firewall.js relies on this.
module.exports.pushSecurityEvent = pushEvent;
