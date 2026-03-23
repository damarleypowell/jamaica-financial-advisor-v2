const { Router } = require("express");
const { authMiddleware } = require("../middleware/auth");
const marketService = require("../services/market.service");

// ── Prisma / DB toggle ───────────────────────────────────────────────────────
let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const router = Router();

// ── In-memory store (fallback when no DB) ─────────────────────────────────────
const memWatchlists = new Map(); // userId -> [{ id, name, symbols[] }]

// ══════════════════════════════════════════════════════════════════════════════
// ── Get all watchlists for current user ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/watchlists", authMiddleware, async (req, res) => {
  try {
    let watchlists;

    if (USE_DB) {
      watchlists = await prisma.watchlist.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      });
    } else {
      watchlists = memWatchlists.get(req.user.id) || [];
    }

    // Enrich with live price data
    const enriched = watchlists.map((wl) => ({
      ...wl,
      stocks: (wl.symbols || []).map((sym) => {
        const stock = marketService.livePrices.find(
          (s) => s.symbol === sym.toUpperCase()
        );
        return stock
          ? {
              symbol: stock.symbol,
              name: stock.name,
              price: stock.livePrice,
              change: stock.liveChange,
              volume: stock.volume,
              sector: stock.sector,
            }
          : { symbol: sym, name: sym, price: null, change: null };
      }),
    }));

    res.json({ watchlists: enriched });
  } catch (err) {
    console.error("[watchlist] Error fetching watchlists:", err);
    res.status(500).json({ error: "Failed to load watchlists" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Create a new watchlist ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/watchlists", authMiddleware, async (req, res) => {
  try {
    const { name, symbols } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Watchlist name is required" });
    }

    const cleanSymbols = Array.isArray(symbols)
      ? [...new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))]
      : [];

    let watchlist;

    if (USE_DB) {
      watchlist = await prisma.watchlist.create({
        data: {
          userId: req.user.id,
          name: name.trim(),
          symbols: cleanSymbols,
        },
      });
    } else {
      const crypto = require("crypto");
      watchlist = {
        id: crypto.randomUUID(),
        userId: req.user.id,
        name: name.trim(),
        symbols: cleanSymbols,
        createdAt: new Date(),
      };
      const userLists = memWatchlists.get(req.user.id) || [];
      userLists.push(watchlist);
      memWatchlists.set(req.user.id, userLists);
    }

    res.status(201).json({ watchlist });
  } catch (err) {
    console.error("[watchlist] Error creating watchlist:", err);
    res.status(500).json({ error: "Failed to create watchlist" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Update watchlist (rename or change symbols) ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.put("/api/watchlists/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, symbols } = req.body;

    if (USE_DB) {
      const existing = await prisma.watchlist.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!existing) return res.status(404).json({ error: "Watchlist not found" });

      const data = {};
      if (name && typeof name === "string") data.name = name.trim();
      if (Array.isArray(symbols)) {
        data.symbols = [...new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
      }

      const updated = await prisma.watchlist.update({ where: { id }, data });
      res.json({ watchlist: updated });
    } else {
      const userLists = memWatchlists.get(req.user.id) || [];
      const idx = userLists.findIndex((w) => w.id === id);
      if (idx === -1) return res.status(404).json({ error: "Watchlist not found" });

      if (name) userLists[idx].name = name.trim();
      if (Array.isArray(symbols)) {
        userLists[idx].symbols = [...new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
      }
      res.json({ watchlist: userLists[idx] });
    }
  } catch (err) {
    console.error("[watchlist] Error updating watchlist:", err);
    res.status(500).json({ error: "Failed to update watchlist" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Add symbol to watchlist ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/watchlists/:id/symbols", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });
    const sym = String(symbol).trim().toUpperCase();

    if (USE_DB) {
      const existing = await prisma.watchlist.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!existing) return res.status(404).json({ error: "Watchlist not found" });

      if (existing.symbols.includes(sym)) {
        return res.json({ watchlist: existing, message: "Symbol already in watchlist" });
      }

      const updated = await prisma.watchlist.update({
        where: { id },
        data: { symbols: [...existing.symbols, sym] },
      });
      res.json({ watchlist: updated });
    } else {
      const userLists = memWatchlists.get(req.user.id) || [];
      const wl = userLists.find((w) => w.id === id);
      if (!wl) return res.status(404).json({ error: "Watchlist not found" });

      if (!wl.symbols.includes(sym)) wl.symbols.push(sym);
      res.json({ watchlist: wl });
    }
  } catch (err) {
    console.error("[watchlist] Error adding symbol:", err);
    res.status(500).json({ error: "Failed to add symbol" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Remove symbol from watchlist ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.delete("/api/watchlists/:id/symbols/:symbol", authMiddleware, async (req, res) => {
  try {
    const { id, symbol } = req.params;
    const sym = symbol.toUpperCase();

    if (USE_DB) {
      const existing = await prisma.watchlist.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!existing) return res.status(404).json({ error: "Watchlist not found" });

      const updated = await prisma.watchlist.update({
        where: { id },
        data: { symbols: existing.symbols.filter((s) => s !== sym) },
      });
      res.json({ watchlist: updated });
    } else {
      const userLists = memWatchlists.get(req.user.id) || [];
      const wl = userLists.find((w) => w.id === id);
      if (!wl) return res.status(404).json({ error: "Watchlist not found" });

      wl.symbols = wl.symbols.filter((s) => s !== sym);
      res.json({ watchlist: wl });
    }
  } catch (err) {
    console.error("[watchlist] Error removing symbol:", err);
    res.status(500).json({ error: "Failed to remove symbol" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Delete watchlist ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.delete("/api/watchlists/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (USE_DB) {
      const existing = await prisma.watchlist.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!existing) return res.status(404).json({ error: "Watchlist not found" });

      await prisma.watchlist.delete({ where: { id } });
      res.json({ success: true });
    } else {
      const userLists = memWatchlists.get(req.user.id) || [];
      const idx = userLists.findIndex((w) => w.id === id);
      if (idx === -1) return res.status(404).json({ error: "Watchlist not found" });

      userLists.splice(idx, 1);
      res.json({ success: true });
    }
  } catch (err) {
    console.error("[watchlist] Error deleting watchlist:", err);
    res.status(500).json({ error: "Failed to delete watchlist" });
  }
});

module.exports = router;
