import { useEffect, useRef, useState, useCallback } from 'react';
import type { Stock } from '@/types';

interface UseSSEOptions {
  enabled?: boolean;
  onUpdate?: (stocks: Stock[]) => void;
}

export function useSSE({ enabled = true, onUpdate }: UseSSEOptions = {}) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/stream/prices');
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const updatedStocks: Stock[] = data.stocks || data;
        setStocks(updatedStocks);
        onUpdate?.(updatedStocks);
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) connect();
      }, 3000);
    };
  }, [enabled, onUpdate]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect]);

  return { stocks, isConnected };
}
