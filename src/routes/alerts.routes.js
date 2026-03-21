const { Router } = require("express");
const crypto = require("crypto");
const { authMiddleware } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const marketService = require("../services/market.service");
const { logAudit } = require("../services/audit.service");

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
// ── In-memory store (fallback when no DB) ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const memAlerts = new Map(); // alertId -> alert
const memNotifications = new Map(); // notificationId -> notification

// ══════════════════════════════════════════════════════════════════════════════
// ── Create Price Alert ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/api/alerts",
  authMiddleware,
  rateLimit(60000, 20),
  async (req, res) => {
    try {
      const { symbol, targetPrice, condition } = req.body;

      if (!symbol || targetPrice === undefined || !condition) {
        return res
          .status(400)
          .json({ error: "symbol, targetPrice, and condition are required" });
      }

      const normalizedCondition = condition.toUpperCase();
      const validConditions = [
        "ABOVE",
        "BELOW",
        "PERCENT_CHANGE_ABOVE",
        "PERCENT_CHANGE_BELOW",
      ];
      if (!validConditions.includes(normalizedCondition)) {
        return res.status(400).json({
          error: `condition must be one of: ${validConditions.join(", ")}`,
        });
      }

      if (typeof targetPrice !== "number" || targetPrice <= 0) {
        return res
          .status(400)
          .json({ error: "targetPrice must be a positive number" });
      }

      // Verify symbol exists
      const stock = marketService.livePrices.find(
        (s) => s.symbol === symbol.toUpperCase()
      );
      if (!stock) {
        return res
          .status(404)
          .json({ error: `Stock ${symbol} not found` });
      }

      if (USE_DB) {
        // Deduplicate: check for existing active alert with same params
        const existing = await prisma.priceAlert.findFirst({
          where: {
            userId: req.user.id,
            symbol: symbol.toUpperCase(),
            condition: normalizedCondition,
            targetValue: targetPrice,
            isActive: true,
          },
        });
        if (existing) {
          return res.status(409).json({ error: "An identical alert already exists", alertId: existing.id });
        }

        const alert = await prisma.priceAlert.create({
          data: {
            userId: req.user.id,
            symbol: symbol.toUpperCase(),
            condition: normalizedCondition,
            targetValue: targetPrice,
          },
        });

        return res.status(201).json({
          alert: {
            id: alert.id,
            symbol: alert.symbol,
            condition: alert.condition,
            targetPrice: Number(alert.targetValue),
            isTriggered: alert.isTriggered,
            createdAt: alert.createdAt.toISOString(),
          },
        });
      }

      // ── In-memory fallback ──
      const alertId = crypto.randomUUID();
      const alert = {
        id: alertId,
        userId: req.user.id,
        symbol: symbol.toUpperCase(),
        condition: normalizedCondition,
        targetPrice,
        isTriggered: false,
        createdAt: new Date().toISOString(),
      };
      memAlerts.set(alertId, alert);

      res.status(201).json({ alert });
    } catch (err) {
      console.error("[alerts/create] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ── List User's Alerts ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/alerts", authMiddleware, async (req, res) => {
  try {
    const { triggered } = req.query;

    if (USE_DB) {
      const where = { userId: req.user.id };
      if (triggered !== undefined) {
        where.isTriggered = triggered === "true";
      }
      const alerts = await prisma.priceAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        alerts: alerts.map((a) => ({
          id: a.id,
          symbol: a.symbol,
          condition: a.condition,
          targetPrice: Number(a.targetValue),
          isTriggered: a.isTriggered,
          createdAt: a.createdAt.toISOString(),
        })),
      });
    }

    // ── In-memory fallback ──
    let alerts = [];
    for (const [, alert] of memAlerts) {
      if (alert.userId === req.user.id) {
        if (triggered !== undefined) {
          if ((triggered === "true") !== alert.isTriggered) continue;
        }
        alerts.push(alert);
      }
    }
    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ alerts });
  } catch (err) {
    console.error("[alerts/list] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Delete Alert ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.delete("/api/alerts/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (USE_DB) {
      const alert = await prisma.priceAlert.findUnique({ where: { id } });
      if (!alert || alert.userId !== req.user.id) {
        return res.status(404).json({ error: "Alert not found" });
      }
      await prisma.priceAlert.delete({ where: { id } });
      return res.json({ message: "Alert deleted" });
    }

    // ── In-memory fallback ──
    const alert = memAlerts.get(id);
    if (!alert || alert.userId !== req.user.id) {
      return res.status(404).json({ error: "Alert not found" });
    }
    memAlerts.delete(id);

    res.json({ message: "Alert deleted" });
  } catch (err) {
    console.error("[alerts/delete] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Check Alerts (called on price refresh interval) ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function checkAlerts() {
  try {
    const livePrices = marketService.livePrices;
    if (!livePrices || livePrices.length === 0) return;

    // Build a price lookup map
    const priceMap = new Map();
    for (const stock of livePrices) {
      priceMap.set(stock.symbol, {
        price: stock.livePrice,
        change: stock.liveChange || 0,
        changePct: stock.liveChangePct || 0,
      });
    }

    if (USE_DB) {
      const alerts = await prisma.priceAlert.findMany({
        where: { isTriggered: false },
      });

      for (const alert of alerts) {
        const data = priceMap.get(alert.symbol);
        if (!data) continue;

        const triggered = evaluateCondition(
          alert.condition,
          data.price,
          Number(alert.targetValue),
          data.changePct
        );

        if (triggered) {
          await prisma.$transaction([
            prisma.priceAlert.update({
              where: { id: alert.id },
              data: { isTriggered: true },
            }),
            prisma.notification.create({
              data: {
                userId: alert.userId,
                type: "PRICE_ALERT",
                title: `Price Alert: ${alert.symbol}`,
                body: buildAlertMessage(
                  alert.symbol,
                  alert.condition,
                  Number(alert.targetValue),
                  data.price
                ),
                data: {
                  alertId: alert.id,
                  symbol: alert.symbol,
                  condition: alert.condition,
                  targetPrice: Number(alert.targetValue),
                  currentPrice: data.price,
                },
              },
            }),
          ]);

          logAudit("PRICE_ALERT_TRIGGERED", {
            userId: alert.userId,
            alertId: alert.id,
            symbol: alert.symbol,
            condition: alert.condition,
            targetPrice: Number(alert.targetValue),
            currentPrice: data.price,
          });
        }
      }
    } else {
      // ── In-memory fallback ──
      for (const [, alert] of memAlerts) {
        if (alert.isTriggered) continue;

        const data = priceMap.get(alert.symbol);
        if (!data) continue;

        const triggered = evaluateCondition(
          alert.condition,
          data.price,
          alert.targetPrice,
          data.changePct
        );

        if (triggered) {
          alert.isTriggered = true;

          const notifId = crypto.randomUUID();
          memNotifications.set(notifId, {
            id: notifId,
            userId: alert.userId,
            type: "PRICE_ALERT",
            title: `Price Alert: ${alert.symbol}`,
            body: buildAlertMessage(
              alert.symbol,
              alert.condition,
              alert.targetPrice,
              data.price
            ),
            data: {
              alertId: alert.id,
              symbol: alert.symbol,
              condition: alert.condition,
              targetPrice: alert.targetPrice,
              currentPrice: data.price,
            },
            isRead: false,
            createdAt: new Date().toISOString(),
          });

          logAudit("PRICE_ALERT_TRIGGERED", {
            userId: alert.userId,
            alertId: alert.id,
            symbol: alert.symbol,
            condition: alert.condition,
            targetPrice: alert.targetPrice,
            currentPrice: data.price,
          });
        }
      }
    }
  } catch (err) {
    console.error("[alerts] checkAlerts error:", err);
  }
}

// ── Alert evaluation helpers ────────────────────────────────────────────────

function evaluateCondition(condition, currentPrice, targetValue, changePct) {
  switch (condition) {
    case "ABOVE":
      return currentPrice >= targetValue;
    case "BELOW":
      return currentPrice <= targetValue;
    case "PERCENT_CHANGE_ABOVE":
      return Math.abs(changePct) >= targetValue;
    case "PERCENT_CHANGE_BELOW":
      return Math.abs(changePct) <= targetValue && changePct !== 0;
    default:
      return false;
  }
}

function buildAlertMessage(symbol, condition, targetValue, currentPrice) {
  switch (condition) {
    case "ABOVE":
      return `${symbol} has risen to $${currentPrice.toFixed(2)}, above your target of $${targetValue.toFixed(2)}`;
    case "BELOW":
      return `${symbol} has fallen to $${currentPrice.toFixed(2)}, below your target of $${targetValue.toFixed(2)}`;
    case "PERCENT_CHANGE_ABOVE":
      return `${symbol} at $${currentPrice.toFixed(2)} has changed more than ${targetValue}%`;
    case "PERCENT_CHANGE_BELOW":
      return `${symbol} at $${currentPrice.toFixed(2)} has changed less than ${targetValue}%`;
    default:
      return `${symbol} alert triggered at $${currentPrice.toFixed(2)}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Notifications (read triggered alerts) ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;

    if (USE_DB) {
      const where = { userId: req.user.id };
      if (unreadOnly === "true") where.isRead = false;

      const notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
      });

      return res.json({
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        })),
      });
    }

    // ── In-memory fallback ──
    let notifs = [];
    for (const [, n] of memNotifications) {
      if (n.userId === req.user.id) {
        if (unreadOnly === "true" && n.isRead) continue;
        notifs.push(n);
      }
    }
    notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ notifications: notifs.slice(0, parseInt(limit)) });
  } catch (err) {
    console.error("[notifications/list] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put(
  "/api/notifications/:id/read",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (USE_DB) {
        const notif = await prisma.notification.findUnique({ where: { id } });
        if (!notif || notif.userId !== req.user.id) {
          return res.status(404).json({ error: "Notification not found" });
        }
        await prisma.notification.update({
          where: { id },
          data: { isRead: true },
        });
        return res.json({ message: "Notification marked as read" });
      }

      const notif = memNotifications.get(id);
      if (!notif || notif.userId !== req.user.id) {
        return res.status(404).json({ error: "Notification not found" });
      }
      notif.isRead = true;

      res.json({ message: "Notification marked as read" });
    } catch (err) {
      console.error("[notifications/read] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.put(
  "/api/notifications/read-all",
  authMiddleware,
  async (req, res) => {
    try {
      if (USE_DB) {
        await prisma.notification.updateMany({
          where: { userId: req.user.id, isRead: false },
          data: { isRead: true },
        });
        return res.json({ message: "All notifications marked as read" });
      }

      for (const [, n] of memNotifications) {
        if (n.userId === req.user.id) n.isRead = true;
      }

      res.json({ message: "All notifications marked as read" });
    } catch (err) {
      console.error("[notifications/read-all] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
module.exports.checkAlerts = checkAlerts;
