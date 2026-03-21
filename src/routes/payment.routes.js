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

// ── Stripe setup (lazy init) ─────────────────────────────────────────────────
let stripe = null;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/create-checkout — Create Stripe checkout for deposit
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/payments/create-checkout", authMiddleware, async (req, res) => {
  try {
    const s = getStripe();
    if (!s) {
      return res.status(503).json({
        error: "Payment processing not configured",
        message: "Stripe is not set up yet. Use the wallet deposit feature for paper trading.",
      });
    }

    const { amount, currency = "USD" } = req.body;
    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Amount must be at least $1" });
    }
    if (amount > 100000) {
      return res.status(400).json({ error: "Maximum deposit is $100,000" });
    }

    const session = await s.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: "JSE Live Wallet Deposit",
              description: `Deposit ${currency} ${amount} to your trading wallet`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.APP_URL || "http://localhost:3000"}?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || "http://localhost:3000"}?deposit=cancelled`,
      metadata: {
        userId: req.user.id,
        amount: String(amount),
        currency,
        type: "DEPOSIT",
      },
    });

    if (USE_DB) {
      await prisma.payment.create({
        data: {
          userId: req.user.id,
          type: "DEPOSIT",
          amount,
          currency,
          status: "PENDING",
          stripeSessionId: session.id,
        },
      });
    }

    logAudit(AuditAction.WALLET_DEPOSIT || "PAYMENT_INIT", {
      userId: req.user.id,
      amount,
      currency,
      sessionId: session.id,
      ip: req.ip,
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[payments/create-checkout] Error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/webhook — Stripe webhook handler
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/payments/webhook", async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: "Stripe not configured" });

  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (endpointSecret && sig) {
      event = s.webhooks.constructEvent(req.rawBody || req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, amount, currency, type } = session.metadata || {};

    if (userId && amount && USE_DB) {
      try {
        // Credit the wallet
        const parsedAmount = parseFloat(amount);
        const walletCurrency = (currency || "USD").toUpperCase();

        await prisma.$transaction(async (tx) => {
          // Update or create wallet
          const existing = await tx.wallet.findFirst({
            where: { userId, currency: walletCurrency },
          });

          if (existing) {
            await tx.wallet.update({
              where: { id: existing.id },
              data: { balance: { increment: parsedAmount } },
            });
          } else {
            await tx.wallet.create({
              data: { userId, currency: walletCurrency, balance: parsedAmount },
            });
          }

          // Update payment status
          if (session.id) {
            await tx.payment.updateMany({
              where: { stripeSessionId: session.id },
              data: { status: "COMPLETED" },
            });
          }

          // Create transaction record
          await tx.transaction.create({
            data: {
              userId,
              type: "DEPOSIT",
              amount: parsedAmount,
              currency: walletCurrency,
              description: `Stripe deposit - ${session.id}`,
            },
          });
        });

        logAudit("PAYMENT_COMPLETED", {
          userId,
          amount: parsedAmount,
          currency: walletCurrency,
          sessionId: session.id,
        });
      } catch (err) {
        console.error("[webhook] Failed to process payment:", err);
      }
    }
  }

  res.json({ received: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/create-withdrawal — Initiate withdrawal
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/payments/create-withdrawal", authMiddleware, async (req, res) => {
  try {
    const { amount, currency = "USD", bankDetails } = req.body;
    if (!amount || amount < 10) {
      return res.status(400).json({ error: "Minimum withdrawal is $10" });
    }

    if (USE_DB) {
      // Check wallet balance
      const wallet = await prisma.wallet.findFirst({
        where: { userId: req.user.id, currency: currency.toUpperCase() },
      });

      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Check KYC status
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user.kycStatus !== "VERIFIED") {
        return res.status(403).json({
          error: "KYC verification required for withdrawals",
          kycStatus: user.kycStatus,
        });
      }

      // Create pending withdrawal
      await prisma.$transaction(async (tx) => {
        // Hold the funds
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } },
        });

        await tx.payment.create({
          data: {
            userId: req.user.id,
            type: "WITHDRAWAL",
            amount,
            currency: currency.toUpperCase(),
            status: "PENDING",
          },
        });

        await tx.transaction.create({
          data: {
            userId: req.user.id,
            type: "WITHDRAWAL",
            amount: -amount,
            currency: currency.toUpperCase(),
            description: "Withdrawal request (pending)",
          },
        });
      });

      logAudit(AuditAction.WALLET_WITHDRAWAL || "WITHDRAWAL_REQUEST", {
        userId: req.user.id,
        amount,
        currency,
        ip: req.ip,
      });

      return res.json({ message: "Withdrawal request submitted. Processing takes 1-3 business days." });
    }

    res.status(503).json({ error: "Withdrawals require database mode" });
  } catch (err) {
    console.error("[payments/withdrawal] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/payments/history — Payment history
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
    console.error("[payments/history] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/subscribe — Subscribe to a plan via Stripe
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/payments/subscribe", authMiddleware, async (req, res) => {
  try {
    const s = getStripe();
    if (!s) {
      return res.status(503).json({
        error: "Payment processing not configured",
        message: "Stripe is not set up. Subscription can be activated manually for now.",
      });
    }

    const { plan } = req.body;
    const prices = {
      BASIC: process.env.STRIPE_PRICE_BASIC,
      PRO: process.env.STRIPE_PRICE_PRO,
      ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
    };

    const priceId = prices[plan];
    if (!priceId) {
      return res.status(400).json({ error: "Invalid plan or price not configured" });
    }

    const session = await s.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.APP_URL || "http://localhost:3000"}?subscription=success`,
      cancel_url: `${process.env.APP_URL || "http://localhost:3000"}?subscription=cancelled`,
      metadata: { userId: req.user.id, plan },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[payments/subscribe] Error:", err);
    res.status(500).json({ error: "Failed to create subscription checkout" });
  }
});

module.exports = router;
