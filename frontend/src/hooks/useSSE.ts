import { useEffect } from 'react';
import { useMarketStore } from '../stores/market';

/**
 * Hook that keeps the SSE price stream connected while the consuming
 * component is mounted.  Disconnects automatically on unmount.
 */
export function useSSE() {
  const connectSSE = useMarketStore((s) => s.connectSSE);
  const disconnectSSE = useMarketStore((s) => s.disconnectSSE);

  useEffect(() => {
    connectSSE();
    return () => disconnectSSE();
  }, [connectSSE, disconnectSSE]);
}
