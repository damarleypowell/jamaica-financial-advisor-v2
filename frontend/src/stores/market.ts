import { create } from 'zustand';
import type { Stock } from '../types';

function normalizeStock(s: Stock): Stock {
  // The REST /api/stocks and the SSE stream both send the percentage move as
  // `change`; the app reads `pctChange`. Map it so both sources agree.
  const change = (s as unknown as { change?: number }).change;
  return {
    ...s,
    price: s.price ?? 0,
    pctChange: s.pctChange ?? change ?? 0,
    dollarChange: s.dollarChange ?? 0,
    volume: s.volume ?? 0,
  };
}

interface MarketState {
  stocks: Stock[];
  selectedSymbol: string;
  isConnected: boolean;
}

interface MarketActions {
  setStocks: (stocks: Stock[]) => void;
  loadStocks: () => Promise<void>;
  selectSymbol: (symbol: string) => void;
  connectSSE: () => void;
  disconnectSSE: () => void;
}

type MarketStore = MarketState & MarketActions;

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? '';
const SSE_URL = `${API_BASE}/api/stream/prices`;
const RECONNECT_DELAY = 3000;

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useMarketStore = create<MarketStore>((set, get) => ({
  /* ---- initial state ---- */
  stocks: [],
  selectedSymbol: '',
  isConnected: false,

  /* ---- actions ---- */
  setStocks: (stocks) => set({ stocks: stocks.map(normalizeStock) }),

  // Fetch the full named stock list over REST so the app works even when SSE
  // doesn't deliver (e.g. Render buffering long-lived connections). This is the
  // source of `name` — the SSE payload only carries symbol/price/change/volume.
  loadStocks: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stocks`);
      if (!res.ok) return;
      const data = (await res.json()) as Stock[];
      if (Array.isArray(data) && data.length) {
        const existing = new Map(get().stocks.map((s) => [s.symbol, s]));
        set({ stocks: data.map((d) => normalizeStock({ ...existing.get(d.symbol), ...d })) });
      }
    } catch { /* offline / cold start — SSE may still populate */ }
  },

  selectSymbol: (symbol) => set({ selectedSymbol: symbol }),

  connectSSE: () => {
    // Avoid duplicate connections
    if (eventSource) return;

    const token = localStorage.getItem('jse_token');
    const url = token ? `${SSE_URL}?token=${token}` : SSE_URL;

    const es = new EventSource(url);
    eventSource = es;

    es.onopen = () => {
      set({ isConnected: true });
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Stock | Stock[];
        const { stocks } = get();

        if (Array.isArray(data)) {
          // Full snapshot — merge over existing so REST-loaded fields (name,
          // sector, etc.) survive the SSE payload that omits them.
          const existing = new Map(stocks.map((s) => [s.symbol, s]));
          set({ stocks: data.map((d) => normalizeStock({ ...existing.get(d.symbol), ...d })) });
        } else {
          // Single stock update — merge into the existing record (keep name etc.)
          const idx = stocks.findIndex((s) => s.symbol === data.symbol);
          if (idx >= 0) {
            const next = [...stocks];
            next[idx] = normalizeStock({ ...stocks[idx], ...data });
            set({ stocks: next });
          } else {
            set({ stocks: [...stocks, normalizeStock(data)] });
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
      eventSource = null;
      set({ isConnected: false });

      // Auto-reconnect
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        get().connectSSE();
      }, RECONNECT_DELAY);
    };
  },

  disconnectSSE: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ isConnected: false });
  },
}));
