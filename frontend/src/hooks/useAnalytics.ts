import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const PV_KEY = 'gotham_pv';
const CLICK_KEY = 'gotham_clicks';
const SESSION_KEY = 'gotham_sessions';

function getStore<T>(key: string): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? {} as T; }
  catch { return {} as T; }
}
function setStore(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

function trackPageView(path: string, duration: number) {
  const pv = getStore<Record<string, { count: number; duration: number }>>(PV_KEY);
  if (!pv[path]) pv[path] = { count: 0, duration: 0 };
  pv[path].count++;
  pv[path].duration += duration;
  setStore(PV_KEY, pv);
}

function trackClick(element: string) {
  const clicks = getStore<Record<string, number>>(CLICK_KEY);
  clicks[element] = (clicks[element] ?? 0) + 1;
  setStore(CLICK_KEY, clicks);
}

function incrementSession() {
  const s = parseInt(localStorage.getItem(SESSION_KEY) ?? '0');
  try { localStorage.setItem(SESSION_KEY, String(s + 1)); } catch { /* ignore */ }
}

let sessionStarted = false;

export function useAnalytics() {
  const location = useLocation();
  // eslint-disable-next-line react-hooks/purity -- Date.now() in useRef initial value is only evaluated once on mount
  const enteredAt = useRef(Date.now());
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (!sessionStarted) { sessionStarted = true; incrementSession(); }
  }, []);

  useEffect(() => {
    enteredAt.current = Date.now();
    prevPath.current = location.pathname;
    return () => {
      const duration = Math.round((Date.now() - enteredAt.current) / 1000);
      trackPageView(prevPath.current, duration);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('button, a, [data-track]');
      if (!btn) return;

      const label = (btn as HTMLElement).dataset.track
        ?? (btn as HTMLButtonElement).textContent?.trim().slice(0, 40)
        ?? btn.tagName.toLowerCase();

      if (label) trackClick(label);
    };

    window.addEventListener('click', handleClick, { capture: true, passive: true });
    return () => window.removeEventListener('click', handleClick, { capture: true });
  }, []);
}
