const { Router } = require("express");
const { authMiddleware } = require("../middleware/auth");
const { logAudit, AuditAction } = require("../services/audit.service");

let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const router = Router();

// Admin emails — add your admin emails here
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function isAdmin(req) {
  return ADMIN_EMAILS.includes(req.user?.email?.toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/dashboard — Overview metrics
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/dashboard", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) {
      return res.json({ error: "Admin dashboard requires database mode" });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      newUsersToday,
      newUsersMonth,
      totalOrders,
      ordersToday,
      ordersMonth,
      activeSubscriptions,
      totalAlerts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.priceAlert.count({ where: { isActive: true } }),
    ]);

    // Recent signups
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, email: true, createdAt: true, kycStatus: true, isActive: true },
    });

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, symbol: true, side: true, type: true, quantity: true, price: true, status: true, createdAt: true, userId: true },
    });

    // Subscription breakdown
    const subscriptionBreakdown = await prisma.subscription.groupBy({
      by: ["plan"],
      _count: { plan: true },
      where: { status: "ACTIVE" },
    });

    // Order volume by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    res.json({
      metrics: {
        totalUsers,
        newUsersToday,
        newUsersMonth,
        totalOrders,
        ordersToday,
        ordersMonth,
        activeSubscriptions,
        totalAlerts,
      },
      recentUsers,
      recentOrders,
      subscriptionBreakdown: subscriptionBreakdown.map((s) => ({ plan: s.plan, count: s._count.plan })),
      ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count.status })),
    });
  } catch (err) {
    console.error("[admin/dashboard] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users — Paginated user list
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ users: [], total: 0 });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, email: true, createdAt: true, isActive: true, kycStatus: true,
          _count: { select: { orders: true, wallets: true, portfolioPositions: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[admin/users] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users/:id — User detail
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.status(404).json({ error: "Not found" });

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        wallets: true,
        portfolioPositions: true,
        orders: { orderBy: { createdAt: "desc" }, take: 20 },
        subscriptions: true,
        priceAlerts: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Remove sensitive fields
    const { passwordHash, salt, twoFactorSecret, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error("[admin/users/:id] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/users/:id — Update user (activate/deactivate, KYC status)
// ══════════════════════════════════════════════════════════════════════════════
router.put("/api/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.status(400).json({ error: "Requires database mode" });

    const { isActive, kycStatus } = req.body;
    const data = {};
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (kycStatus && ["NONE", "PENDING", "VERIFIED", "REJECTED"].includes(kycStatus)) {
      data.kycStatus = kycStatus;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, isActive: true, kycStatus: true },
    });

    logAudit(AuditAction.PROFILE_UPDATE || "ADMIN_USER_UPDATE", {
      adminId: req.user.id,
      targetUserId: req.params.id,
      changes: data,
      ip: req.ip,
    });

    res.json(user);
  } catch (err) {
    console.error("[admin/users/:id PUT] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/orders — All orders (paginated)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/orders", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ orders: [], total: 0 });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const status = req.query.status || "";
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[admin/orders] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
