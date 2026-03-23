const { Router } = require("express");
const crypto = require("crypto");
const { authMiddleware } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const marketService = require("../services/market.service");
const { logAudit, AuditAction } = require("../services/audit.service");

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

const memOrders = new Map();
const memTransactions = new Map();
const memWallets = new Map();
const memPositions = new Map();

// ══════════════════════════════════════════════════════════════════════════════
// ── Wallet helpers ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function getAccountType(userId) {
  if (USE_DB) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
      return user?.settings?.accountType || "paper";
    } catch (_) { return "paper"; }
  }
  return "paper";
}

async function getWallet(userId, currency = "JMD") {
  if (USE_DB) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
    if (!wallet) {
      const acctType = await getAccountType(userId);
      const startBalance = (acctType === "paper" && currency === "JMD") ? 1000000 : 0;
      wallet = await prisma.wallet.create({
        data: {
          userId,
          currency,
          balance: startBalance,
          heldBalance: 0,
        },
      });
    }
    return {
      userId,
      currency,
      balance: Number(wallet.balance),
      held: Number(wallet.heldBalance),
      _dbId: wallet.id,
    };
  }

  // ── In-memory fallback ──
  const key = `${userId}:${currency}`;
  if (!memWallets.has(key)) {
    memWallets.set(key, {
      userId,
      currency,
      balance: currency === "JMD" ? 1000000 : 0,
      held: 0,
    });
  }
  return memWallets.get(key);
}

async function saveWallet(wallet) {
  if (USE_DB) {
    await prisma.wallet.update({
      where: {
        userId_currency: {
          userId: wallet.userId,
          currency: wallet.currency,
        },
      },
      data: {
        balance: wallet.balance,
        heldBalance: wallet.held,
      },
    });
  }
  // In-memory wallets are mutated in-place, no save needed
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Position helpers ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function getPosition(userId, symbol, market = "JSE") {
  if (USE_DB) {
    const pos = await prisma.portfolioPosition.findFirst({
      where: { userId, symbol, market },
    });
    if (!pos) return null;
    return {
      userId,
      symbol,
      market,
      shares: Number(pos.shares),
      avgCost: Number(pos.avgCost),
      currency: pos.currency,
      isPaper: pos.isPaper,
      openedAt: pos.openedAt.toISOString(),
      _dbId: pos.id,
    };
  }

  const key = `${userId}:${symbol}:${market}`;
  return memPositions.get(key) || null;
}

async function setPosition(userId, symbol, market, data) {
  if (USE_DB) {
    if (data.shares <= 0) {
      await prisma.portfolioPosition.deleteMany({
        where: { userId, symbol, market },
      });
    } else {
      const existing = await prisma.portfolioPosition.findFirst({
        where: { userId, symbol, market },
      });
      if (existing) {
        await prisma.portfolioPosition.update({
          where: { id: existing.id },
          data: {
            shares: data.shares,
            avgCost: data.avgCost,
          },
        });
      } else {
        await prisma.portfolioPosition.create({
          data: {
            userId,
            symbol,
            market,
            shares: data.shares,
            avgCost: data.avgCost,
            currency: data.currency || "JMD",
            isPaper: data.isPaper !== undefined ? data.isPaper : true,
          },
        });
      }
    }
    return;
  }

  // ── In-memory fallback ──
  const key = `${userId}:${symbol}:${market}`;
  if (data.shares <= 0) {
    memPositions.delete(key);
  } else {
    memPositions.set(key, { userId, symbol, market, ...data });
  }
}

async function getUserPositions(userId) {
  if (USE_DB) {
    const positions = await prisma.portfolioPosition.findMany({
      where: { userId },
    });
    return positions.map((p) => ({
      userId: p.userId,
      symbol: p.symbol,
      market: p.market,
      shares: Number(p.shares),
      avgCost: Number(p.avgCost),
      currency: p.currency,
      isPaper: p.isPaper,
      openedAt: p.openedAt.toISOString(),
    }));
  }

  const result = [];
  for (const [, pos] of memPositions) {
    if (pos.userId === userId) result.push(pos);
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Order helpers ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function saveOrder(order) {
  if (USE_DB) {
    const existing = await prisma.order.findUnique({
      where: { id: order.id },
    });
    const data = {
      userId: order.userId,
      symbol: order.symbol,
      market: order.market,
      side: order.side,
      orderType: order.orderType,
      status: order.status,
      quantity: order.quantity,
      filledQty: order.filledQty,
      limitPrice: order.limitPrice,
      stopPrice: order.stopPrice,
      avgFillPrice: order.avgFillPrice,
      isPaper: order.isPaper,
      expiresAt: order.expiresAt ? new Date(order.expiresAt) : null,
    };
    if (existing) {
      await prisma.order.update({ where: { id: order.id }, data });
    } else {
      await prisma.order.create({ data: { id: order.id, ...data } });
    }
    return;
  }

  memOrders.set(order.id, order);
}

async function getOrderById(orderId) {
  if (USE_DB) {
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    return o ? dbOrderToLocal(o) : null;
  }
  return memOrders.get(orderId) || null;
}

async function getUserOrders(userId) {
  if (USE_DB) {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(dbOrderToLocal);
  }

  const result = [];
  for (const [, order] of memOrders) {
    if (order.userId === userId) result.push(order);
  }
  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function dbOrderToLocal(o) {
  return {
    id: o.id,
    userId: o.userId,
    symbol: o.symbol,
    market: o.market,
    side: o.side,
    orderType: o.orderType,
    status: o.status,
    quantity: Number(o.quantity),
    filledQty: Number(o.filledQty),
    limitPrice: o.limitPrice ? Number(o.limitPrice) : null,
    stopPrice: o.stopPrice ? Number(o.stopPrice) : null,
    avgFillPrice: o.avgFillPrice ? Number(o.avgFillPrice) : null,
    isPaper: o.isPaper,
    currency: o.market === "JSE" ? "JMD" : "USD",
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Transaction helpers ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function saveTransaction(tx) {
  if (USE_DB) {
    await prisma.transaction.create({
      data: {
        id: tx.id,
        userId: tx.userId,
        orderId: tx.orderId || null,
        type: tx.type,
        symbol: tx.symbol || null,
        market: tx.market || null,
        shares: tx.shares || null,
        price: tx.price || null,
        totalAmount: tx.totalAmount,
        feeAmount: tx.feeAmount || 0,
        currency: tx.currency || "JMD",
        isPaper: tx.isPaper !== undefined ? tx.isPaper : true,
      },
    });
    return;
  }

  memTransactions.set(tx.id, tx);
}

async function getUserTransactions(userId) {
  if (USE_DB) {
    const txs = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return txs.map((t) => ({
      id: t.id,
      userId: t.userId,
      orderId: t.orderId,
      type: t.type,
      symbol: t.symbol,
      market: t.market,
      shares: t.shares ? Number(t.shares) : null,
      price: t.price ? Number(t.price) : null,
      totalAmount: Number(t.totalAmount),
      feeAmount: Number(t.feeAmount),
      currency: t.currency,
      isPaper: t.isPaper,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  const result = [];
  for (const [, tx] of memTransactions) {
    if (tx.userId === userId) result.push(tx);
  }
  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── Fee calculation ──────────────────────────────────────────────────────────

function calculateFee(totalAmount, market = "JSE") {
  const rate = market === "JSE" ? 0.01 : 0.005; // 1% JSE, 0.5% US service charge
  return +(totalAmount * rate).toFixed(2);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Fill Order ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function fillOrder(order, fillPrice) {
  const totalAmount = +(fillPrice * order.quantity).toFixed(2);
  const fee = calculateFee(totalAmount, order.market);
  const wallet = await getWallet(order.userId, order.currency);

  if (order.side === "BUY") {
    const totalCost = totalAmount + fee;
    wallet.held -= totalCost;
    wallet.balance -= totalCost;

    const existing = await getPosition(order.userId, order.symbol, order.market);
    if (existing) {
      const totalShares = existing.shares + order.quantity;
      const totalCostBasis =
        existing.avgCost * existing.shares + fillPrice * order.quantity;
      existing.shares = totalShares;
      existing.avgCost = +(totalCostBasis / totalShares).toFixed(4);
      await setPosition(order.userId, order.symbol, order.market, existing);
    } else {
      await setPosition(order.userId, order.symbol, order.market, {
        shares: order.quantity,
        avgCost: fillPrice,
        currency: order.currency,
        isPaper: order.isPaper,
        openedAt: new Date().toISOString(),
      });
    }
  } else {
    // SELL
    wallet.balance += totalAmount - fee;

    const existing = await getPosition(order.userId, order.symbol, order.market);
    if (existing) {
      existing.shares -= order.quantity;
      await setPosition(order.userId, order.symbol, order.market, existing);
    }
  }

  await saveWallet(wallet);

  // Update order
  order.status = "FILLED";
  order.filledQty = order.quantity;
  order.avgFillPrice = fillPrice;
  order.updatedAt = new Date().toISOString();
  await saveOrder(order);

  // Create transaction record
  const txId = crypto.randomUUID();
  const tx = {
    id: txId,
    userId: order.userId,
    orderId: order.id,
    type: order.side,
    symbol: order.symbol,
    market: order.market,
    shares: order.quantity,
    price: fillPrice,
    totalAmount,
    feeAmount: fee,
    currency: order.currency,
    isPaper: order.isPaper,
    createdAt: new Date().toISOString(),
  };
  await saveTransaction(tx);

  logAudit(AuditAction.ORDER_FILLED, {
    userId: order.userId,
    orderId: order.id,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    fillPrice,
    totalAmount,
    fee,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Check Pending Orders (runs on interval) ─────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function checkPendingOrders() {
  try {
    let pendingOrders;

    if (USE_DB) {
      const dbOrders = await prisma.order.findMany({
        where: { status: { in: ["PENDING", "OPEN"] } },
      });
      pendingOrders = dbOrders.map(dbOrderToLocal);
    } else {
      pendingOrders = [];
      for (const [, order] of memOrders) {
        if (order.status === "PENDING" || order.status === "OPEN") {
          pendingOrders.push(order);
        }
      }
    }

    for (const order of pendingOrders) {
      // Expire orders older than 30 days or past their expiresAt
      const expiresAt = order.expiresAt ? new Date(order.expiresAt) : null;
      const createdAt = new Date(order.createdAt);
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      if ((expiresAt && expiresAt < new Date()) || (Date.now() - createdAt.getTime() > maxAge)) {
        order.status = "EXPIRED";
        order.updatedAt = new Date().toISOString();
        await saveOrder(order);
        continue;
      }

      const stock = marketService.livePrices.find(
        (s) => s.symbol === order.symbol
      );
      if (!stock) continue;
      const price = stock.livePrice;

      if (order.orderType === "LIMIT") {
        if (order.side === "BUY" && price <= order.limitPrice) {
          await fillOrder(order, price);
        } else if (order.side === "SELL" && price >= order.limitPrice) {
          await fillOrder(order, price);
        } else if (order.status === "PENDING") {
          order.status = "OPEN";
          order.updatedAt = new Date().toISOString();
          await saveOrder(order);
        }
      } else if (order.orderType === "STOP") {
        if (order.side === "SELL" && price <= order.stopPrice) {
          await fillOrder(order, price);
        } else if (order.side === "BUY" && price >= order.stopPrice) {
          await fillOrder(order, price);
        }
      } else if (order.orderType === "STOP_LIMIT") {
        if (order.side === "SELL" && price <= order.stopPrice) {
          if (price >= order.limitPrice) {
            await fillOrder(order, price);
          } else if (order.status === "PENDING") {
            order.status = "OPEN";
            order.updatedAt = new Date().toISOString();
            await saveOrder(order);
          }
        }
      }
    }
  } catch (err) {
    console.error("[orders] checkPendingOrders error:", err);
  }
}

// Check pending orders every 30 seconds
setInterval(checkPendingOrders, 30000);

// ══════════════════════════════════════════════════════════════════════════════
// ── Place Order ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/api/orders",
  authMiddleware,
  rateLimit(60000, 30),
  async (req, res) => {
    try {
      const {
        symbol,
        market = "JSE",
        side,
        orderType = "MARKET",
        quantity,
        limitPrice,
        stopPrice,
        isPaper = true,
      } = req.body;

      // ── Validation ──
      if (!symbol || !side || !quantity)
        return res
          .status(400)
          .json({ error: "symbol, side, and quantity required" });
      if (!["BUY", "SELL"].includes(side))
        return res.status(400).json({ error: "side must be BUY or SELL" });
      if (!["MARKET", "LIMIT", "STOP", "STOP_LIMIT"].includes(orderType))
        return res.status(400).json({ error: "Invalid orderType" });
      if (quantity <= 0)
        return res.status(400).json({ error: "quantity must be positive" });
      if (orderType === "LIMIT" && (!limitPrice || limitPrice <= 0))
        return res
          .status(400)
          .json({ error: "limitPrice required for LIMIT orders" });
      if (orderType === "STOP" && (!stopPrice || stopPrice <= 0))
        return res
          .status(400)
          .json({ error: "stopPrice required for STOP orders" });
      if (orderType === "STOP_LIMIT" && (!limitPrice || !stopPrice))
        return res.status(400).json({
          error: "limitPrice and stopPrice required for STOP_LIMIT orders",
        });

      // ── Check stock exists ──
      const stock = marketService.livePrices.find(
        (s) => s.symbol === symbol.toUpperCase()
      );
      if (!stock)
        return res.status(404).json({ error: `Stock ${symbol} not found` });

      const currentPrice = stock.livePrice;
      const currency = stock.currency || "JMD";
      const wallet = await getWallet(req.user.id, currency);

      // ── BUY validation: check funds ──
      if (side === "BUY") {
        const estimatedTotal = (limitPrice || currentPrice) * quantity;
        const fee = calculateFee(estimatedTotal, market);
        const totalNeeded = estimatedTotal + fee;
        const available = wallet.balance - wallet.held;
        if (totalNeeded > available) {
          return res.status(400).json({
            error: `Insufficient funds. Need $${totalNeeded.toFixed(2)} ${currency}, available: $${available.toFixed(2)}`,
          });
        }
        wallet.held += totalNeeded;
        await saveWallet(wallet);
      }

      // ── SELL validation: check shares ──
      if (side === "SELL") {
        const position = await getPosition(
          req.user.id,
          symbol.toUpperCase(),
          market
        );
        if (!position || position.shares < quantity) {
          return res.status(400).json({
            error: `Insufficient shares. You hold ${position ? position.shares : 0} shares of ${symbol}`,
          });
        }
      }

      // ── Create order ──
      const orderId = crypto.randomUUID();
      const order = {
        id: orderId,
        userId: req.user.id,
        symbol: symbol.toUpperCase(),
        market,
        side,
        orderType,
        status: "PENDING",
        quantity,
        filledQty: 0,
        limitPrice: limitPrice || null,
        stopPrice: stopPrice || null,
        avgFillPrice: null,
        isPaper,
        currency,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveOrder(order);

      logAudit(AuditAction.ORDER_PLACED, {
        userId: req.user.id,
        ip: req.ip,
        orderId,
        symbol: order.symbol,
        side,
        orderType,
        quantity,
        limitPrice,
        stopPrice,
      });

      // ── For MARKET orders in paper mode, fill immediately ──
      if (orderType === "MARKET" && isPaper) {
        await fillOrder(order, currentPrice);
      }

      // Re-fetch order to get filled state
      const finalOrder = await getOrderById(orderId);

      res.json({
        order: finalOrder || order,
        message:
          orderType === "MARKET"
            ? `${side} order filled at $${currentPrice.toFixed(2)}`
            : `${side} ${orderType} order placed`,
      });
    } catch (err) {
      console.error("[orders/place] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ── List Orders ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/orders", authMiddleware, async (req, res) => {
  try {
    const { status, symbol, limit = 50 } = req.query;
    let userOrders = await getUserOrders(req.user.id);

    if (status) userOrders = userOrders.filter((o) => o.status === status);
    if (symbol)
      userOrders = userOrders.filter(
        (o) => o.symbol === symbol.toUpperCase()
      );

    res.json({ orders: userOrders.slice(0, parseInt(limit)) });
  } catch (err) {
    console.error("[orders/list] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Order Detail ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/orders/:id", authMiddleware, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order || order.userId !== req.user.id)
      return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  } catch (err) {
    console.error("[orders/detail] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Cancel Order ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.delete("/api/orders/:id", authMiddleware, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order || order.userId !== req.user.id)
      return res.status(404).json({ error: "Order not found" });

    if (order.status === "FILLED" || order.status === "CANCELLED")
      return res
        .status(400)
        .json({ error: `Cannot cancel ${order.status} order` });

    // Release held funds for buy orders
    if (order.side === "BUY") {
      const wallet = await getWallet(order.userId, order.currency);
      const estimatedTotal =
        (order.limitPrice || order.avgFillPrice || 0) * order.quantity;
      const fee = calculateFee(estimatedTotal, order.market);
      wallet.held -= estimatedTotal + fee;
      await saveWallet(wallet);
    }

    order.status = "CANCELLED";
    order.updatedAt = new Date().toISOString();
    await saveOrder(order);

    logAudit(AuditAction.ORDER_CANCELLED, {
      userId: req.user.id,
      ip: req.ip,
      orderId: order.id,
      symbol: order.symbol,
    });

    res.json({ order, message: "Order cancelled" });
  } catch (err) {
    console.error("[orders/cancel] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Portfolio Positions (trading-based) ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/portfolio/positions", authMiddleware, async (req, res) => {
  try {
    const userPositions = await getUserPositions(req.user.id);

    const enriched = userPositions.map((pos) => {
      const stock = marketService.livePrices.find(
        (s) => s.symbol === pos.symbol
      );
      const currentPrice = stock ? stock.livePrice : pos.avgCost;
      const currentValue = +(currentPrice * pos.shares).toFixed(2);
      const costBasis = +(pos.avgCost * pos.shares).toFixed(2);
      const pnl = +(currentValue - costBasis).toFixed(2);
      const pnlPct =
        costBasis > 0 ? +((pnl / costBasis) * 100).toFixed(2) : 0;

      return {
        ...pos,
        name: stock?.name || pos.symbol,
        sector: stock?.sector || "Unknown",
        currentPrice,
        currentValue,
        costBasis,
        pnl,
        pnlPct,
        change: stock?.liveChange || 0,
      };
    });

    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
    const totalCost = enriched.reduce((s, p) => s + p.costBasis, 0);

    res.json({
      positions: enriched,
      summary: {
        totalValue: +totalValue.toFixed(2),
        totalCost: +totalCost.toFixed(2),
        totalPnl: +(totalValue - totalCost).toFixed(2),
        totalPnlPct:
          totalCost > 0
            ? +(((totalValue - totalCost) / totalCost) * 100).toFixed(2)
            : 0,
        positionCount: enriched.length,
      },
    });
  } catch (err) {
    console.error("[portfolio/positions] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Transaction History ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/portfolio/history", authMiddleware, async (req, res) => {
  try {
    const { type, symbol, limit = 100 } = req.query;
    let txs = await getUserTransactions(req.user.id);

    if (type) txs = txs.filter((t) => t.type === type);
    if (symbol)
      txs = txs.filter((t) => t.symbol === symbol.toUpperCase());

    res.json({ transactions: txs.slice(0, parseInt(limit)) });
  } catch (err) {
    console.error("[portfolio/history] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Wallet Balance ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/wallet/balance", authMiddleware, async (req, res) => {
  try {
    const jmd = await getWallet(req.user.id, "JMD");
    const usd = await getWallet(req.user.id, "USD");

    res.json({
      wallets: [
        {
          currency: "JMD",
          balance: +jmd.balance.toFixed(2),
          held: +jmd.held.toFixed(2),
          available: +(jmd.balance - jmd.held).toFixed(2),
        },
        {
          currency: "USD",
          balance: +usd.balance.toFixed(2),
          held: +usd.held.toFixed(2),
          available: +(usd.balance - usd.held).toFixed(2),
        },
      ],
    });
  } catch (err) {
    console.error("[wallet/balance] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Deposit ─────────────────────────────────────────────────────────────────

router.post("/api/wallet/deposit", authMiddleware, async (req, res) => {
  try {
    const { amount, currency = "JMD" } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Valid amount required" });

    const wallet = await getWallet(req.user.id, currency);
    wallet.balance += amount;
    await saveWallet(wallet);

    const txId = crypto.randomUUID();
    await saveTransaction({
      id: txId,
      userId: req.user.id,
      orderId: null,
      type: "DEPOSIT",
      symbol: null,
      market: null,
      shares: null,
      price: null,
      totalAmount: amount,
      feeAmount: 0,
      currency,
      isPaper: true,
      createdAt: new Date().toISOString(),
    });

    logAudit(AuditAction.WALLET_DEPOSIT, {
      userId: req.user.id,
      ip: req.ip,
      amount,
      currency,
    });

    res.json({
      message: `Deposited $${amount.toFixed(2)} ${currency}`,
      wallet: {
        currency,
        balance: +wallet.balance.toFixed(2),
        available: +(wallet.balance - wallet.held).toFixed(2),
      },
    });
  } catch (err) {
    console.error("[wallet/deposit] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Withdraw ────────────────────────────────────────────────────────────────

router.post("/api/wallet/withdraw", authMiddleware, async (req, res) => {
  try {
    const { amount, currency = "JMD" } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Valid amount required" });

    const wallet = await getWallet(req.user.id, currency);
    const available = wallet.balance - wallet.held;
    if (amount > available)
      return res.status(400).json({
        error: `Insufficient funds. Available: $${available.toFixed(2)} ${currency}`,
      });

    wallet.balance -= amount;
    await saveWallet(wallet);

    const txId = crypto.randomUUID();
    await saveTransaction({
      id: txId,
      userId: req.user.id,
      orderId: null,
      type: "WITHDRAWAL",
      symbol: null,
      market: null,
      shares: null,
      price: null,
      totalAmount: amount,
      feeAmount: 0,
      currency,
      isPaper: true,
      createdAt: new Date().toISOString(),
    });

    logAudit(AuditAction.WALLET_WITHDRAWAL, {
      userId: req.user.id,
      ip: req.ip,
      amount,
      currency,
    });

    res.json({
      message: `Withdrew $${amount.toFixed(2)} ${currency}`,
      wallet: {
        currency,
        balance: +wallet.balance.toFixed(2),
        available: +(wallet.balance - wallet.held).toFixed(2),
      },
    });
  } catch (err) {
    console.error("[wallet/withdraw] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Export for server.js to call checkPendingOrders ─────────────────────────
module.exports = router;
module.exports.checkPendingOrders = checkPendingOrders;
