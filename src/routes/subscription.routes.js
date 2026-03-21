// ══════════════════════════════════════════════════════════════════════════════
// ── Subscription Routes ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const { Router } = require("express");
const crypto = require("crypto");
const { authMiddleware } = require("../middleware/auth");
const {
  TIER_LIMITS,
  TIER_ORDER,
  getUserTier,
  getAIChatCount,
  tierCache,
} = require("../middleware/subscription");

// ── Prisma / DB toggle ───────────────────────────────────────────────────────
let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// ── Plan Pricing & Descriptions (public catalog) ────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const PLAN_CATALOG = [
  {
    plan: "FREE",
    name: "Free",
    priceJMD: 0,
    priceUSD: 0,
    billingPeriod: null,
    description: "Get started with basic JSE trading",
    features: {
      maxTrades: "5 per month",
      maxWatchlists: 1,
      maxAlerts: 3,
      aiChats: "10 per day",
      usStocks: false,
      advancedAnalytics: false,
      mlPredictions: false,
      support: "Community",
    },
  },
  {
    plan: "BASIC",
    name: "Basic",
    priceJMD: 1500,
    priceUSD: 9.99,
    billingPeriod: "monthly",
    description: "For active traders who want US market access",
    features: {
      maxTrades: "50 per month",
      maxWatchlists: 5,
      maxAlerts: 20,
      aiChats: "50 per day",
      usStocks: true,
      advancedAnalytics: true,
      mlPredictions: false,
      support: "Email",
    },
  },
  {
    plan: "PRO",
    name: "Pro",
    priceJMD: 4500,
    priceUSD: 29.99,
    billingPeriod: "monthly",
    description: "Unlimited trading with ML-powered predictions",
    features: {
      maxTrades: "Unlimited",
      maxWatchlists: "Unlimited",
      maxAlerts: "Unlimited",
      aiChats: "Unlimited",
      usStocks: true,
      advancedAnalytics: true,
      mlPredictions: true,
      support: "Priority",
    },
  },
  {
    plan: "ENTERPRISE",
    name: "Enterprise",
    priceJMD: null,
    priceUSD: null,
    billingPeriod: "custom",
    description: "Custom solutions for institutions and teams",
    features: {
      maxTrades: "Unlimited",
      maxWatchlists: "Unlimited",
      maxAlerts: "Unlimited",
      aiChats: "Unlimited",
      usStocks: true,
      advancedAnalytics: true,
      mlPredictions: true,
      support: "Dedicated account manager",
    },
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ── GET /api/subscription — Current plan, limits, usage ─────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/subscription", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const tier = await getUserTier(userId);
    const limits = TIER_LIMITS[tier];

    // ── Gather usage stats ──
    let tradesThisMonth = 0;
    let watchlistCount = 0;
    let alertCount = 0;
    let subscription = null;

    if (USE_DB) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [tradeCountResult, watchlistResult, alertResult, subResult] =
        await Promise.all([
          prisma.order.count({
            where: { userId, createdAt: { gte: monthStart } },
          }),
          prisma.watchlist.count({ where: { userId } }),
          prisma.priceAlert.count({ where: { userId, isTriggered: false } }),
          prisma.subscription.findUnique({ where: { userId } }),
        ]);

      tradesThisMonth = tradeCountResult;
      watchlistCount = watchlistResult;
      alertCount = alertResult;
      subscription = subResult;
    }

    const aiChatsToday = getAIChatCount(userId);

    res.json({
      plan: tier,
      status: subscription ? subscription.status : "ACTIVE",
      currentPeriodEnd: subscription ? subscription.currentPeriodEnd : null,
      limits: {
        maxTrades: limits.maxTrades === Infinity ? "Unlimited" : limits.maxTrades,
        maxWatchlists: limits.maxWatchlists === Infinity ? "Unlimited" : limits.maxWatchlists,
        maxAlerts: limits.maxAlerts === Infinity ? "Unlimited" : limits.maxAlerts,
        aiChats: limits.aiChats === Infinity ? "Unlimited" : limits.aiChats,
        usStocks: limits.usStocks,
        advancedAnalytics: limits.advancedAnalytics,
        mlPredictions: limits.mlPredictions,
      },
      usage: {
        tradesThisMonth,
        tradesRemaining:
          limits.maxTrades === Infinity
            ? "Unlimited"
            : Math.max(0, limits.maxTrades - tradesThisMonth),
        watchlists: watchlistCount,
        watchlistsRemaining:
          limits.maxWatchlists === Infinity
            ? "Unlimited"
            : Math.max(0, limits.maxWatchlists - watchlistCount),
        activeAlerts: alertCount,
        alertsRemaining:
          limits.maxAlerts === Infinity
            ? "Unlimited"
            : Math.max(0, limits.maxAlerts - alertCount),
        aiChatsToday,
        aiChatsRemaining:
          limits.aiChats === Infinity
            ? "Unlimited"
            : Math.max(0, limits.aiChats - aiChatsToday),
      },
    });
  } catch (err) {
    console.error("[subscription/get] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── GET /api/subscription/plans — Public plan catalog ───────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/subscription/plans", (_req, res) => {
  res.json({ plans: PLAN_CATALOG });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── POST /api/subscription/upgrade — Create or upgrade subscription ─────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/subscription/upgrade", authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    // ── Validate plan ──
    if (!plan || !TIER_ORDER.includes(plan)) {
      return res.status(400).json({
        error: "Invalid plan",
        validPlans: TIER_ORDER,
      });
    }

    if (plan === "ENTERPRISE") {
      return res.status(400).json({
        error: "Enterprise plans require contacting sales",
        message: "Please contact sales@jselive.com for Enterprise pricing.",
      });
    }

    const currentTier = await getUserTier(userId);

    // Check if downgrading
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const targetIndex = TIER_ORDER.indexOf(plan);

    if (targetIndex < currentIndex) {
      return res.status(400).json({
        error: "Downgrades are not yet supported",
        currentPlan: currentTier,
        requestedPlan: plan,
        message:
          "Please contact support to downgrade your subscription.",
      });
    }

    if (targetIndex === currentIndex) {
      return res.status(400).json({
        error: "Already on this plan",
        currentPlan: currentTier,
      });
    }

    // ── Set subscription (Stripe integration comes later) ──
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1); // 1-month period

    let subscription;

    if (USE_DB) {
      subscription = await prisma.subscription.upsert({
        where: { userId },
        update: {
          plan,
          status: "ACTIVE",
          currentPeriodEnd: periodEnd,
        },
        create: {
          id: crypto.randomUUID(),
          userId,
          plan,
          status: "ACTIVE",
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      // File-based fallback: just acknowledge the upgrade (not persisted)
      subscription = {
        id: crypto.randomUUID(),
        userId,
        plan,
        status: "ACTIVE",
        currentPeriodEnd: periodEnd.toISOString(),
        createdAt: new Date().toISOString(),
      };
    }

    // Invalidate tier cache so the new tier takes effect immediately
    tierCache.delete(userId);

    const planInfo = PLAN_CATALOG.find((p) => p.plan === plan);

    res.json({
      message: `Successfully upgraded to ${planInfo.name} plan`,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      note: "Payment processing via Stripe coming soon. This upgrade has been applied directly.",
    });
  } catch (err) {
    console.error("[subscription/upgrade] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
