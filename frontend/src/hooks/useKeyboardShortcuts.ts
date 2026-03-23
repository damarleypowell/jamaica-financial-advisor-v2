import { useEffect } from 'react';

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

/**
 * Register global keyboard shortcuts.
 *
 * Keys in the map can be:
 *   - A single key like `"/"`, `"Escape"`
 *   - A combo like `"Ctrl+K"`, `"Ctrl+Shift+P"`
 *
 * Handlers are suppressed when the active element is an input, textarea,
 * or contentEditable element so that normal typing is not interrupted.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't fire shortcuts while the user is typing in a form field
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        // Still allow Escape to propagate — it's used to close modals / blur
        if (e.key !== 'Escape') return;
      }

      // Build a normalised key string so callers can use "Ctrl+K" etc.
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      parts.push(e.key);
      const combo = parts.join('+');

      // Try the full combo first, then the bare key
      const fn = shortcuts[combo] ?? shortcuts[e.key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
