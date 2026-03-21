/**
 * Alpaca Markets Service
 * Handles US stock trading (paper + live) via Alpaca API
 *
 * Supports: market data, order placement, positions, account info
 * Paper trading uses paper-api.alpaca.markets
 * Live trading uses api.alpaca.markets
 */

"use strict";

const Alpaca = require("@alpacahq/alpaca-trade-api");

// ─── Configuration ───────────────────────────────────────

const ALPACA_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || "";
const ALPACA_PAPER = process.env.ALPACA_PAPER !== "false"; // default to paper

let alpaca = null;

function getClient() {
  if (!alpaca && ALPACA_KEY && ALPACA_SECRET) {
    alpaca = new Alpaca({
      keyId: ALPACA_KEY,
      secretKey: ALPACA_SECRET,
      paper: ALPACA_PAPER,
    });
  }
  return alpaca;
}

function isConfigured() {
  return !!(ALPACA_KEY && ALPACA_SECRET);
}

// ─── Account ─────────────────────────────────────────────

async function getAccount() {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");
  const account = await client.getAccount();
  return {
    id: account.id,
    status: account.status,
    currency: account.currency,
    buyingPower: parseFloat(account.buying_power),
    cash: parseFloat(account.cash),
    portfolioValue: parseFloat(account.portfolio_value),
    equity: parseFloat(account.equity),
    lastEquity: parseFloat(account.last_equity),
    dayTradeCount: account.daytrade_count,
    patternDayTrader: account.pattern_day_trader,
    tradingBlocked: account.trading_blocked,
    accountBlocked: account.account_blocked,
    paper: ALPACA_PAPER,
  };
}

// ─── Market Data ─────────────────────────────────────────

async function getUSStockQuote(symbol) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const snapshot = await client.getSnapshot(symbol.toUpperCase());
  return {
    symbol: symbol.toUpperCase(),
    market: "US",
    latestTrade: {
      price: parseFloat(snapshot.LatestTrade?.Price || 0),
      size: snapshot.LatestTrade?.Size || 0,
      timestamp: snapshot.LatestTrade?.Timestamp,
    },
    latestQuote: {
      bid: parseFloat(snapshot.LatestQuote?.BidPrice || 0),
      ask: parseFloat(snapshot.LatestQuote?.AskPrice || 0),
      bidSize: snapshot.LatestQuote?.BidSize || 0,
      askSize: snapshot.LatestQuote?.AskSize || 0,
    },
    dailyBar: {
      open: parseFloat(snapshot.DailyBar?.OpenPrice || 0),
      high: parseFloat(snapshot.DailyBar?.HighPrice || 0),
      low: parseFloat(snapshot.DailyBar?.LowPrice || 0),
      close: parseFloat(snapshot.DailyBar?.ClosePrice || 0),
      volume: snapshot.DailyBar?.Volume || 0,
    },
    prevDailyBar: {
      close: parseFloat(snapshot.PrevDailyBar?.ClosePrice || 0),
      volume: snapshot.PrevDailyBar?.Volume || 0,
    },
  };
}

async function getUSStockBars(symbol, timeframe = "1Day", limit = 100) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const bars = await client.getBarsV2(symbol.toUpperCase(), {
    timeframe,
    limit,
  });

  const result = [];
  for await (const bar of bars) {
    result.push({
      timestamp: bar.Timestamp,
      open: parseFloat(bar.OpenPrice),
      high: parseFloat(bar.HighPrice),
      low: parseFloat(bar.LowPrice),
      close: parseFloat(bar.ClosePrice),
      volume: bar.Volume,
      vwap: parseFloat(bar.VWAP || 0),
    });
  }
  return result;
}

async function getMultipleQuotes(symbols) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const snapshots = await client.getSnapshots(symbols.map(s => s.toUpperCase()));
  const results = {};
  for (const [sym, snap] of Object.entries(snapshots)) {
    results[sym] = {
      price: parseFloat(snap.LatestTrade?.Price || 0),
      bid: parseFloat(snap.LatestQuote?.BidPrice || 0),
      ask: parseFloat(snap.LatestQuote?.AskPrice || 0),
      volume: snap.DailyBar?.Volume || 0,
      change: snap.DailyBar && snap.PrevDailyBar
        ? ((parseFloat(snap.DailyBar.ClosePrice) - parseFloat(snap.PrevDailyBar.ClosePrice)) / parseFloat(snap.PrevDailyBar.ClosePrice) * 100).toFixed(2)
        : 0,
    };
  }
  return results;
}

// ─── Orders ──────────────────────────────────────────────

async function placeOrder({ symbol, qty, side, type = "market", timeInForce = "day", limitPrice, stopPrice }) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const orderParams = {
    symbol: symbol.toUpperCase(),
    qty: String(qty),
    side, // "buy" or "sell"
    type, // "market", "limit", "stop", "stop_limit"
    time_in_force: timeInForce, // "day", "gtc", "ioc", "fok"
  };

  if (type === "limit" || type === "stop_limit") {
    orderParams.limit_price = String(limitPrice);
  }
  if (type === "stop" || type === "stop_limit") {
    orderParams.stop_price = String(stopPrice);
  }

  const order = await client.createOrder(orderParams);
  return formatOrder(order);
}

async function getOrders(status = "open") {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const orders = await client.getOrders({ status });
  return orders.map(formatOrder);
}

async function getOrder(orderId) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const order = await client.getOrder(orderId);
  return formatOrder(order);
}

async function cancelOrder(orderId) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  await client.cancelOrder(orderId);
  return { success: true, orderId };
}

async function cancelAllOrders() {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const result = await client.cancelAllOrders();
  return result;
}

function formatOrder(order) {
  return {
    id: order.id,
    symbol: order.symbol,
    qty: parseFloat(order.qty),
    filledQty: parseFloat(order.filled_qty || 0),
    side: order.side,
    type: order.type,
    timeInForce: order.time_in_force,
    limitPrice: order.limit_price ? parseFloat(order.limit_price) : null,
    stopPrice: order.stop_price ? parseFloat(order.stop_price) : null,
    filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    submittedAt: order.submitted_at,
    filledAt: order.filled_at,
    market: "US",
  };
}

// ─── Positions ───────────────────────────────────────────

async function getPositions() {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const positions = await client.getPositions();
  return positions.map(p => ({
    symbol: p.symbol,
    qty: parseFloat(p.qty),
    side: p.side,
    marketValue: parseFloat(p.market_value),
    costBasis: parseFloat(p.cost_basis),
    avgEntryPrice: parseFloat(p.avg_entry_price),
    currentPrice: parseFloat(p.current_price),
    unrealizedPL: parseFloat(p.unrealized_pl),
    unrealizedPLPct: parseFloat(p.unrealized_plpc) * 100,
    changeToday: parseFloat(p.change_today) * 100,
    market: "US",
  }));
}

async function closePosition(symbol) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const result = await client.closePosition(symbol.toUpperCase());
  return formatOrder(result);
}

// ─── Assets ──────────────────────────────────────────────

async function searchAssets(query) {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const assets = await client.getAssets({ status: "active" });
  const q = query.toUpperCase();
  return assets
    .filter(a => a.tradable && (a.symbol.includes(q) || a.name.toUpperCase().includes(q)))
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol,
      name: a.name,
      exchange: a.exchange,
      tradable: a.tradable,
      shortable: a.shortable,
      fractionable: a.fractionable,
      market: "US",
    }));
}

// ─── Clock & Calendar ────────────────────────────────────

async function getMarketClock() {
  const client = getClient();
  if (!client) throw new Error("Alpaca not configured");

  const clock = await client.getClock();
  return {
    isOpen: clock.is_open,
    nextOpen: clock.next_open,
    nextClose: clock.next_close,
    timestamp: clock.timestamp,
  };
}

module.exports = {
  isConfigured,
  getAccount,
  getUSStockQuote,
  getUSStockBars,
  getMultipleQuotes,
  placeOrder,
  getOrders,
  getOrder,
  cancelOrder,
  cancelAllOrders,
  getPositions,
  closePosition,
  searchAssets,
  getMarketClock,
};
