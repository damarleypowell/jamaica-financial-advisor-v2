import { create } from 'zustand';
import type { Stock } from '../types';

function normalizeStock(s: Stock): Stock {
  return {
    ...s,
    price: s.price ?? 0,
    pctChange: s.pctChange ?? 0,
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
          // Full snapshot
          set({ stocks: data.map(normalizeStock) });
        } else {
          // Single stock update — merge into existing list
          const normalized = normalizeStock(data);
          const idx = stocks.findIndex((s) => s.symbol === normalized.symbol);
          if (idx >= 0) {
            const next = [...stocks];
            next[idx] = normalized;
            set({ stocks: next });
          } else {
            set({ stocks: [...stocks, normalized] });
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
