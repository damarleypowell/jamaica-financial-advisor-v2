// ══════════════════════════════════════════════════════════════════════════════
// ── Subscription Tier Enforcement Middleware ─────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Prisma / DB toggle ───────────────────────────────────────────────────────
let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

// ══════════════════════════════════════════════════════════════════════════════
// ── Tier Definitions ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const TIER_ORDER = ["BASIC", "PRO", "ENTERPRISE"];

const TIER_LIMITS = {
  BASIC: {
    maxTrades: 50,          // per month
    maxWatchlists: 5,
    maxAlerts: 20,
    aiChats: 50,            // per day
    usStocks: true,
    advancedAnalytics: true,
    mlPredictions: false,
    voiceAgent: false,
    tradeServiceCharge: "1% JSE / 0.5% US per trade",
  },
  PRO: {
    maxTrades: Infinity,
    maxWatchlists: Infinity,
    maxAlerts: Infinity,
    aiChats: Infinity,
    usStocks: true,
    advancedAnalytics: true,
    mlPredictions: true,
    voiceAgent: true,
    tradeServiceCharge: "1% JSE / 0.5% US per trade",
  },
  ENTERPRISE: {
    maxTrades: Infinity,
    maxWatchlists: Infinity,
    maxAlerts: Infinity,
    aiChats: Infinity,
    usStocks: true,
    advancedAnalytics: true,
    mlPredictions: true,
    voiceAgent: true,
    tradeServiceCharge: "1% JSE / 0.5% US per trade",
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ── Tier Cache (5-minute TTL) ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const tierCache = new Map(); // userId -> { tier, expiry }

function getCachedTier(userId) {
  const entry = tierCache.get(userId);
  if (entry && Date.now() < entry.expiry) return entry.tier;
  tierCache.delete(userId);
  return null;
}

function setCachedTier(userId, tier) {
  tierCache.set(userId, { tier, expiry: Date.now() + CACHE_TTL_MS });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── AI Chat Rate Limiter (in-memory, resets daily) ──────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const aiChatCounts = new Map(); // `userId:YYYY-MM-DD` -> count

function getTodayKey(userId) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${userId}:${date}`;
}

function getAIChatCount(userId) {
  return aiChatCounts.get(getTodayKey(userId)) || 0;
}

function incrementAIChatCount(userId) {
  const key = getTodayKey(userId);
  aiChatCounts.set(key, (aiChatCounts.get(key) || 0) + 1);
}

// Clean up stale entries once per hour
setInterval(() => {
  const today = new Date().toISOString().slice(0, 10);
  for (const key of aiChatCounts.keys()) {
    if (!key.endsWith(today)) aiChatCounts.delete(key);
  }
}, 60 * 60 * 1000);

// ══════════════════════════════════════════════════════════════════════════════
// ── getUserTier — resolve active subscription tier ──────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function getUserTier(userId) {
  // Check cache first
  const cached = getCachedTier(userId);
  if (cached) return cached;

  let tier = "BASIC";

  if (USE_DB) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      if (
        subscription &&
        subscription.status === "ACTIVE" &&
        (!subscription.currentPeriodEnd ||
          new Date(subscription.currentPeriodEnd) > new Date())
      ) {
        tier = subscription.plan; // FREE | BASIC | PRO | ENTERPRISE
      }
    } catch (err) {
      console.error("[subscription] Error fetching tier:", err.message);
      // Fall through to FREE
    }
  }
  // File-based fallback: everyone defaults to FREE

  setCachedTier(userId, tier);
  return tier;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── requireTier(minimumTier) ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function requireTier(minimumTier) {
  const minIndex = TIER_ORDER.indexOf(minimumTier);
  if (minIndex === -1) throw new Error(`Unknown tier: ${minimumTier}`);

  return async (req, res, next) => {
    try {
      const userTier = await getUserTier(req.user.id);
      const userIndex = TIER_ORDER.indexOf(userTier);

      if (userIndex < minIndex) {
        return res.status(403).json({
          error: "Subscription upgrade required",
          currentTier: userTier,
          requiredTier: minimumTier,
          message: `This feature requires a ${minimumTier} plan or higher. Please upgrade your subscription.`,
          upgradeUrl: "/api/subscription/plans",
        });
      }

      req.subscriptionTier = userTier;
      next();
    } catch (err) {
      console.error("[subscription] requireTier error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── checkFeature(featureName) ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function checkFeature(featureName) {
  return async (req, res, next) => {
    try {
      const userTier = await getUserTier(req.user.id);
      const limits = TIER_LIMITS[userTier];

      if (!limits || limits[featureName] === undefined) {
        return res.status(400).json({ error: `Unknown feature: ${featureName}` });
      }

      if (limits[featureName] === false) {
        return res.status(403).json({
          error: "Feature not available on your plan",
          feature: featureName,
          currentTier: userTier,
          message: `The "${featureName}" feature is not included in the ${userTier} plan. Please upgrade.`,
          upgradeUrl: "/api/subscription/plans",
        });
      }

      req.subscriptionTier = userTier;
      next();
    } catch (err) {
      console.error("[subscription] checkFeature error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── checkTradeLimit() ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function checkTradeLimit() {
  return async (req, res, next) => {
    try {
      const userTier = await getUserTier(req.user.id);
      const limits = TIER_LIMITS[userTier];

      // Unlimited tiers skip the check
      if (limits.maxTrades === Infinity) {
        req.subscriptionTier = userTier;
        return next();
      }

      // Count orders placed this calendar month
      let tradeCount = 0;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      if (USE_DB) {
        tradeCount = await prisma.order.count({
          where: {
            userId: req.user.id,
            createdAt: { gte: monthStart },
          },
        });
      } else {
        // In-memory: no persistent orders to count, allow all in file-based mode
        tradeCount = 0;
      }

      if (tradeCount >= limits.maxTrades) {
        return res.status(403).json({
          error: "Monthly trade limit reached",
          currentTier: userTier,
          limit: limits.maxTrades,
          used: tradeCount,
          message: `You have used all ${limits.maxTrades} trades for this month on the ${userTier} plan. Upgrade for more trades.`,
          upgradeUrl: "/api/subscription/plans",
        });
      }

      req.subscriptionTier = userTier;
      req.tradeUsage = { used: tradeCount, limit: limits.maxTrades };
      next();
    } catch (err) {
      console.error("[subscription] checkTradeLimit error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── checkAIChatLimit() ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function checkAIChatLimit() {
  return async (req, res, next) => {
    try {
      const userTier = await getUserTier(req.user.id);
      const limits = TIER_LIMITS[userTier];

      // Unlimited tiers skip the check
      if (limits.aiChats === Infinity) {
        req.subscriptionTier = userTier;
        return next();
      }

      const chatCount = getAIChatCount(req.user.id);

      if (chatCount >= limits.aiChats) {
        return res.status(403).json({
          error: "Daily AI chat limit reached",
          currentTier: userTier,
          limit: limits.aiChats,
          used: chatCount,
          message: `You have used all ${limits.aiChats} AI chats for today on the ${userTier} plan. Upgrade for more.`,
          upgradeUrl: "/api/subscription/plans",
        });
      }

      // Increment the counter
      incrementAIChatCount(req.user.id);

      req.subscriptionTier = userTier;
      req.aiChatUsage = { used: chatCount + 1, limit: limits.aiChats };
      next();
    } catch (err) {
      console.error("[subscription] checkAIChatLimit error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Exports ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  TIER_LIMITS,
  TIER_ORDER,
  getUserTier,
  requireTier,
  checkFeature,
  checkTradeLimit,
  checkAIChatLimit,
  // Exposed for subscription routes
  getAIChatCount,
  tierCache,
};
