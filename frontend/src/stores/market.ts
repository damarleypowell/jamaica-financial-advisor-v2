import { create } from 'zustand';
import type { Stock } from '../types';

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

const SSE_URL = '/api/stream/prices';
const RECONNECT_DELAY = 3000;

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useMarketStore = create<MarketStore>((set, get) => ({
  /* ---- initial state ---- */
  stocks: [],
  selectedSymbol: '',
  isConnected: false,

  /* ---- actions ---- */
  setStocks: (stocks) => set({ stocks }),

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
          set({ stocks: data });
        } else {
          // Single stock update — merge into existing list
          const idx = stocks.findIndex((s) => s.symbol === data.symbol);
          if (idx >= 0) {
            const next = [...stocks];
            next[idx] = data;
            set({ stocks: next });
          } else {
            set({ stocks: [...stocks, data] });
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
