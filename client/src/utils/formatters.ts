// ═══════════════════════════════════════════════════════════════════════════════
// ── Formatters & Helpers ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** Format number with commas and decimals */
export function fmt(value: number | string | null | undefined, decimals = 2): string {
  if (value == null || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format integer (no decimals) */
export function fmtInt(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return Math.round(num).toLocaleString('en-US');
}

/** Format large numbers (1.2M, 3.5B, etc.) */
export function fmtLargeNum(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return fmt(value);
}

/** Format as JMD currency */
export function fmtJMD(value: number | null | undefined): string {
  if (value == null) return '—';
  return `J$${fmt(value)}`;
}

/** Format as USD currency */
export function fmtUSD(value: number | null | undefined): string {
  if (value == null) return '—';
  return `US$${fmt(value)}`;
}

/** Format currency by code */
export function fmtCurrency(value: number | null | undefined, currency: string = 'JMD'): string {
  if (value == null) return '—';
  return currency === 'USD' ? fmtUSD(value) : fmtJMD(value);
}

/** Format percent */
export function fmtPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${fmt(value, decimals)}%`;
}

/** Format date to locale string */
export function fmtDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format date and time */
export function fmtDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format relative time (e.g., "2 hours ago") */
export function fmtRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(date);
}

/** Escape HTML entities for safe display */
export function escHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return str.replace(/[&<>"']/g, (c) => map[c] || c);
}

/** Get CSS class for positive/negative values */
export function changeColor(value: number | null | undefined): string {
  if (value == null || value === 0) return 'text-gray-400';
  return value > 0 ? 'text-green-400' : 'text-red-400';
}

/** Get background class for positive/negative values */
export function changeBg(value: number | null | undefined): string {
  if (value == null || value === 0) return 'bg-gray-500/10';
  return value > 0 ? 'bg-green-500/10' : 'bg-red-500/10';
}

/** Truncate string with ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
