import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useMarketStore } from '../../stores/market';
import { apiPost, ApiError } from '../../lib/api';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';

type Level = 'beginner' | 'intermediate' | 'advanced';

const LEVELS: { key: Level; label: string; icon: string; desc: string; color: string }[] = [
  { key: 'beginner',     label: 'Beginner',     icon: 'fa-solid fa-seedling',   desc: 'Plain language, simple takeaways',   color: '#00e676' },
  { key: 'intermediate', label: 'Intermediate', icon: 'fa-solid fa-chart-line',  desc: 'Fundamentals, P/E, dividends',       color: '#40c4ff' },
  { key: 'advanced',     label: 'Advanced',     icon: 'fa-solid fa-flask',       desc: 'DCF, EV/EBITDA, risk scoring',       color: '#ce93d8' },
];

const QUICK_CHIPS = ['NCB', 'JMMBGL', 'WISYNCO', 'AAPL', 'TSLA', 'NVDA'];

const PROMPTS: Record<Level, (q: string) => string> = {
  beginner: q => `You are a friendly financial educator. Analyse "${q}" — which may be listed on the JSE, TTSE, ECSE, BSE, or US markets — in simple, plain English. Avoid jargon. Cover: what the company does, is the stock going up or down lately, is it a good buy for a beginner, and one key risk. Keep it concise and easy to understand.`,
  intermediate: q => `Analyse "${q}" (could be a Caribbean or US listed stock). Cover: P/E ratio vs sector average, dividend yield and history, revenue trend, debt-to-equity, and a buy/hold/sell recommendation with reasoning. Note which exchange it's on and any currency considerations. Use financial terminology but explain each metric briefly.`,
  advanced: q => `Provide a deep-dive analysis of "${q}" (Caribbean or US market). Include: DCF valuation assumptions, EV/EBITDA comparison, free cash flow trend, risk-adjusted return (Sharpe-like), insider ownership, exchange-specific liquidity risks, and a specific price target with upside/downside case. Be data-driven and direct.`,
};

export default function AIAnalysis() {
  const stocks = useMarketStore(s => s.stocks);
  const [level, setLevel] = useState<Level>('beginner');
  // Seed from the ?q= deep-link param on first render (no effect needed).
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');

  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: (q: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      return apiPost<{ response: string }>('/api/chat', {
        messages: [{ role: 'user', content: PROMPTS[level](q) }],
      }, { signal: controller.signal });
    },
  });

  const handleAnalyze = () => {
    const q = query.trim();
    if (!q || mutation.isPending) return;
    mutation.mutate(q);
  };

  // Stop = abort the in-flight request and clear back to the input state.
  const handleStop = () => {
    abortRef.current?.abort();
    mutation.reset();
  };

  const handleChip = (sym: string) => {
    setQuery(`Analyse ${sym} for ${level}-level investors`);
  };

  const activeLevel = LEVELS.find(l => l.key === level)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)' }}>
            <i className="fa-solid fa-robot" style={{ fontSize: 17, color: '#00e676' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--color-text)' }}>AI Stock Analyst</h1>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>Powered by Claude AI · JSE-focused analysis · Not financial advice</p>
          </div>
        </div>
      </div>

      {/* Level selector */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Analysis depth</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {LEVELS.map(l => (
            <button key={l.key} onClick={() => setLevel(l.key)} disabled={mutation.isPending} style={{
              padding: '16px 14px', borderRadius: 14, cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              border: `1px solid ${level === l.key ? l.color + '55' : 'var(--color-border)'}`,
              background: level === l.key ? l.color + '0e' : 'var(--color-bg2)',
              transition: 'all 180ms', textAlign: 'center',
              opacity: mutation.isPending && level !== l.key ? .45 : 1,
            }}>
              <i className={l.icon} style={{ fontSize: 20, color: level === l.key ? l.color : 'var(--color-muted)', display: 'block', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: level === l.key ? l.color : 'var(--color-text)' }}>{l.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--color-muted)', lineHeight: 1.3 }}>{l.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Input card */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Quick chips */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0 }}>Quick pick:</span>
          {QUICK_CHIPS.map(sym => {
            const s = stocks.find(st => st.symbol === sym);
            const pos = (s?.pctChange ?? 0) >= 0;
            return (
              <button key={sym} onClick={() => handleChip(sym)} disabled={mutation.isPending} style={{
                padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                fontFamily: 'var(--font-mono)', cursor: mutation.isPending ? 'not-allowed' : 'pointer', transition: 'all 140ms',
                background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)',
                color: 'var(--color-text2)', opacity: mutation.isPending ? .5 : 1,
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = activeLevel.color + '55'; el.style.color = activeLevel.color; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border)'; el.style.color = 'var(--color-text2)'; }}
              >
                {sym}
                {s && <span style={{ marginLeft: 5, fontSize: 9, color: pos ? '#00e676' : '#ff5252' }}>{pos ? '+' : ''}{(s.pctChange ?? 0).toFixed(2)}%</span>}
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <div style={{ padding: 16 }}>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAnalyze(); }}
            disabled={mutation.isPending}
            placeholder={`Type a stock symbol or question (e.g. "Analyse GraceKennedy for long-term growth") or paste a news article about a JSE company...`}
            rows={4}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 13,
              lineHeight: 1.6, resize: 'none', outline: 'none',
              background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontFamily: 'var(--font-sans)',
              transition: 'border-color 180ms', boxSizing: 'border-box',
              opacity: mutation.isPending ? .55 : 1, cursor: mutation.isPending ? 'not-allowed' : 'text',
            }}
            onFocus={e => (e.target.style.borderColor = activeLevel.color + '55')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          />
          <button onClick={handleAnalyze} disabled={!query.trim() || mutation.isPending} style={{
            width: '100%', marginTop: 10, height: 48, borderRadius: 12, border: 'none', cursor: query.trim() ? 'pointer' : 'not-allowed',
            background: query.trim() ? `linear-gradient(135deg, ${activeLevel.color}, ${activeLevel.color}bb)` : 'rgba(255,255,255,.05)',
            color: query.trim() ? '#04060d' : 'var(--color-muted)', fontSize: 14, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: query.trim() ? `0 4px 20px ${activeLevel.color}33` : 'none',
            transition: 'all 200ms', opacity: mutation.isPending ? .7 : 1,
          }}>
            {mutation.isPending ? (
              <>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                Analysing...
              </>
            ) : (
              <>
                <i className="fa-solid fa-brain" style={{ fontSize: 14 }} />
                Analyse with Claude AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysing — circular graphic + Stop */}
      {mutation.isPending && (
        <div style={{ background: 'var(--color-bg2)', border: `1px solid ${activeLevel.color}30`, borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 74, height: 74, margin: '0 auto 16px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${activeLevel.color}22`, borderTopColor: activeLevel.color, animation: 'spin 1s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: `3px solid ${activeLevel.color}14`, borderBottomColor: activeLevel.color + '88', animation: 'spin 1.5s linear infinite reverse' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-brain" style={{ fontSize: 22, color: activeLevel.color }} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--color-text)' }}>Analysing…</p>
          <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'var(--color-muted)' }}>{activeLevel.label} analysis · Claude is reading live market data</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, margin: '14px 0 18px' }}>
            {[0, 1, 2].map(i => (
              <span key={i} className="animate-pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: activeLevel.color, animationDelay: `${i * 220}ms` }} />
            ))}
          </div>
          <button onClick={handleStop} style={{
            padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(255,82,82,.1)', border: '1px solid rgba(255,82,82,.4)', color: '#ff5252',
            display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 160ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,82,82,.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,82,82,.1)')}
          >
            <i className="fa-solid fa-stop" style={{ fontSize: 10 }} /> Stop
          </button>
        </div>
      )}

      {/* Error — make failures visible instead of silently showing nothing */}
      {mutation.isError && (mutation.error as Error)?.name !== 'AbortError' && (
        <div style={{ background: 'rgba(255,82,82,.06)', border: '1px solid rgba(255,82,82,.3)', borderRadius: 16, padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 16, color: '#ff5252', marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#ff5252' }}>Analysis failed</p>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--color-text2)', lineHeight: 1.5 }}>
              {(mutation.error as ApiError)?.status === 429
                ? "You've reached your AI usage limit. Try again shortly or upgrade your plan."
                : (mutation.error as ApiError)?.message || 'Something went wrong reaching the AI. Please try again.'}
            </p>
            <button onClick={handleAnalyze} style={{ marginTop: 12, padding: '7px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              <i className="fa-solid fa-rotate-right" style={{ marginRight: 6, fontSize: 11 }} /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {mutation.data && !mutation.isPending && (
        <div style={{ background: 'var(--color-bg2)', border: `1px solid ${activeLevel.color}25`, borderRadius: 16, overflow: 'hidden' }}>
          {/* Result header */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${activeLevel.color}18`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeLevel.color + '15', border: `1px solid ${activeLevel.color}30`, flexShrink: 0 }}>
              <i className="fa-solid fa-robot" style={{ fontSize: 13, color: activeLevel.color }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: activeLevel.color }}>Gotham AI — {activeLevel.label} Analysis</p>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>For educational purposes only · Not financial advice</p>
            </div>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 99, background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.28)', color: '#00e676', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 11 }} /> Complete
            </span>
            <button onClick={() => mutation.reset()} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', cursor: 'pointer', flexShrink: 0 }}>
              New query
            </button>
          </div>
          {/* Result body */}
          <div style={{ padding: '20px 24px' }}>
            <MarkdownRenderer content={(mutation.data as { response?: string })?.response ?? String(mutation.data)} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!mutation.data && !mutation.isPending && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: 11, color: 'var(--color-muted)', opacity: .6 }}>
            <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }} />
            AI responses are generated for educational purposes. Always consult a licensed financial advisor before investing.
          </p>
        </div>
      )}

    </div>
  );
}
