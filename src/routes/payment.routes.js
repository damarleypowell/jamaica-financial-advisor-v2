const { Router } = require("express");
const axios = require("axios");
const { authMiddleware } = require("../middleware/auth");
const { logAudit } = require("../services/audit.service");

let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const router = Router();

// ── PayPal helpers ────────────────────────────────────────────────────────────
const PAYPAL_BASE = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getPayPalToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const { data } = await axios.post(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      auth: { username: clientId, password: secret },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return data.access_token;
}

async function paypalRequest(method, path, body, token) {
  const { data } = await axios({
    method,
    url: `${PAYPAL_BASE}${path}`,
    data: body,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/create-order
// Creates a PayPal order for wallet deposit or subscription upgrade.
// Body: { amount, currency, type: 'DEPOSIT'|'SUBSCRIPTION', plan? }
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/payments/create-order", authMiddleware, async (req, res) => {
  try {
    const { amount, currency = "USD", type = "DEPOSIT", plan } = req.body;

    if (!amount || Number(amount) < 1) {
      return res.status(400).json({ error: "Amount must be at least 1 USD" });
    }

    const token = await getPayPalToken();

    const description = type === "SUBSCRIPTION"
      ? `Gotham Financial — ${plan || "BASIC"} Plan (Monthly)`
      : `Gotham Financial — Wallet Deposit`;

    const order = await paypalRequest("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: currency.toUpperCase(),
          value: Number(amount).toFixed(2),
        },
        description,
        custom_id: JSON.stringify({ userId: req.user.id, type, plan: plan || null }),
      }],
      application_context: {
        brand_name: "Gotham Financial",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${process.env.APP_URL || "http://localhost:3001"}/subscription?payment=success`,
        cancel_url: `${process.env.APP_URL || "http://localhost:3001"}/subscription?payment=cancelled`,
      },
    }, token);

    // Record pending payment
    if (USE_DB) {
      await prisma.payment.create({
        data: {
          userId: req.user.id,
          provider: "paypal",
          externalId: order.id,
          type,
          amount: Number(amount),
          currency: currency.toUpperCase(),
          status: "PENDING",
          metadata: { orderId: order.id, plan: plan || null },
        },
      });
    }

    res.json({
      orderId: order.id,
      approveUrl: order.links?.find(l => l.rel === "approve")?.href,
    });
  } catch (err) {
    console.error("[payments/create-order]", err.response?.data || err.message);
    if (err.message === "PayPal credentials not configured") {
      return res.status(503).json({
        error: "Payment processing not configured",
        message: "PayPal credentials are not set up. Contact support.",
      });
    }
    res.status(500).json({ error: "Failed to create PayPal order" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/capture-order
// Captures an approved PayPal order and credits the user's wallet / upgrades plan.
// Body: { orderId }
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/payments/capture-order", authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "orderId required" });

    const token  = await getPayPalToken();
    const result = await paypalRequest("POST", `/v2/checkout/orders/${orderId}/capture`, {}, token);

    if (result.status !== "COMPLETED") {
      return res.status(400).json({ error: "Payment not completed", status: result.status });
    }

    const capture  = result.purchase_units?.[0]?.payments?.captures?.[0];
    const metadata = JSON.parse(result.purchase_units?.[0]?.custom_id || "{}");
    const amount   = parseFloat(capture?.amount?.value || "0");
    const currency = capture?.amount?.currency_code || "USD";
    const { userId, type, plan } = metadata;

    if (userId !== req.user.id) {
      return res.status(403).json({ error: "Order does not belong to this user" });
    }

    if (USE_DB) {
      await prisma.$transaction(async (tx) => {
        // Update payment record
        await tx.payment.updateMany({
          where: { externalId: orderId },
          data: { status: "COMPLETED" },
        });

        if (type === "DEPOSIT") {
          // Credit wallet
          const existing = await tx.wallet.findFirst({ where: { userId, currency } });
          if (existing) {
            await tx.wallet.update({ where: { id: existing.id }, data: { balance: { increment: amount } } });
          } else {
            await tx.wallet.create({ data: { userId, currency, balance: amount } });
          }
          await tx.transaction.create({
            data: { userId, type: "DEPOSIT", totalAmount: amount, currency },
          });
        } else if (type === "SUBSCRIPTION" && plan) {
          // Upgrade subscription
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await tx.subscription.upsert({
            where: { userId },
            update: { plan, status: "ACTIVE", currentPeriodEnd: periodEnd },
            create: { id: require("crypto").randomUUID(), userId, plan, status: "ACTIVE", currentPeriodEnd: periodEnd },
          });
        }
      });
    }

    logAudit("PAYMENT_COMPLETED", { userId, amount, currency, type, plan, orderId });

    res.json({
      success: true,
      type,
      amount,
      currency,
      plan: plan || null,
      message: type === "SUBSCRIPTION"
        ? `Successfully upgraded to ${plan} plan`
        : `Deposited ${currency} ${amount.toFixed(2)} to your wallet`,
    });
  } catch (err) {
    console.error("[payments/capture-order]", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to capture payment" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/create-withdrawal
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/payments/create-withdrawal", authMiddleware, async (req, res) => {
  try {
    const { amount, currency = "USD" } = req.body;
    if (!amount || amount < 10) {
      return res.status(400).json({ error: "Minimum withdrawal is $10" });
    }

    if (USE_DB) {
      const wallet = await prisma.wallet.findFirst({
        where: { userId: req.user.id, currency: currency.toUpperCase() },
      });
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } },
        });
        await tx.payment.create({
          data: {
            userId: req.user.id,
            provider: "paypal",
            type: "WITHDRAWAL",
            amount,
            currency: currency.toUpperCase(),
            status: "PENDING",
          },
        });
        await tx.transaction.create({
          data: { userId: req.user.id, type: "WITHDRAWAL", totalAmount: amount, currency: currency.toUpperCase() },
        });
      });

      logAudit("WITHDRAWAL_REQUEST", { userId: req.user.id, amount, currency, ip: req.ip });
      return res.json({ message: "Withdrawal request submitted. Funds sent to your PayPal within 1–3 business days." });
    }

    res.status(503).json({ error: "Withdrawals require database mode" });
  } catch (err) {
    console.error("[payments/withdrawal]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/payments/history
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/payments/history", authMiddleware, async (req, res) => {
  try {
    if (!USE_DB) return res.json({ payments: [] });
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/payments/config — Returns public PayPal client ID for frontend SDK
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/payments/config", (_req, res) => {
  res.json({
    provider: "paypal",
    clientId: process.env.PAYPAL_CLIENT_ID || null,
    mode: process.env.PAYPAL_MODE || "sandbox",
    configured: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
  });
});

module.exports = router;
