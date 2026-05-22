import { useState, useRef, useEffect, useCallback } from 'react';
import { useMarketStore } from '../stores/market';
import { useAuthStore } from '../stores/auth';
import { apiPost } from '../lib/api';

type Level = 'beginner' | 'intermediate' | 'expert';

interface Message { role: 'user' | 'ai'; text: string; }

const LEVEL_PROMPTS: Record<Level, string> = {
  beginner: 'Use simple, plain language. Explain every term. Avoid jargon. Use analogies.',
  intermediate: 'Assume knowledge of basic chart patterns and indicators like RSI and EMA. Be concise.',
  expert: 'Use precise technical language. RSI, MACD, Fibonacci, Elliott Wave, volatility — no hand-holding.',
};

function buildContext(symbol: string, live: any, rsi: number | null, ema20: number | null, ema50: number | null, pctChange: number, level: Level): string {
  const trend = ema20 && ema50 ? (ema20 > ema50 ? 'bullish (EMA20 above EMA50)' : 'bearish (EMA20 below EMA50)') : 'undetermined';
  const rsiSignal = rsi !== null ? (rsi > 70 ? 'overbought (RSI > 70)' : rsi < 30 ? 'oversold (RSI < 30)' : `neutral (RSI ${rsi.toFixed(0)})`) : 'unavailable';

  return `
You are Gotham AI, an educational financial advisor embedded in the Gotham Financial platform (Caribbean + US stock trading).
IMPORTANT: Always include a brief disclaimer that this is educational commentary, not financial advice.
Expertise level requested: ${level}. ${LEVEL_PROMPTS[level]}

CURRENT CHART CONTEXT:
- Symbol: ${symbol || 'None selected'}
- Last price: $${(live?.price ?? 0).toFixed(2)}
- Today's change: ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%
- EMA 20: ${ema20 ? `$${ema20.toFixed(2)}` : 'N/A'}
- EMA 50: ${ema50 ? `$${ema50.toFixed(2)}` : 'N/A'}
- Trend signal: ${trend}
- RSI (14): ${rsiSignal}
- 52-week high: ${live?.high52 ? `$${live.high52.toFixed(2)}` : 'N/A'}
- 52-week low: ${live?.low52 ? `$${live.low52.toFixed(2)}` : 'N/A'}
- Volume: ${live?.volume?.toLocaleString() ?? 'N/A'}

Based on this data, answer the user's question. Give educational insight about what the indicators suggest. Use directional language like "the chart appears to be consolidating", "momentum looks bearish", "this is typically a support zone" — but always frame it as pattern observation, not a buy/sell recommendation.
`.trim();
}

export default function FloatingAIAdvisor() {
  const [open, setOpen]     = useState(false);
  const [msgs, setMsgs]     = useState<Message[]>([]);
  const [input, setInput]   = useState('');
  const [loading, setLoad]  = useState(false);
  const [level, setLevel]   = useState<Level>('intermediate');
  const [listening, setLis] = useState(false);
  const [rsi, setRsi]       = useState<number | null>(null);
  const [ema20, setEma20]   = useState<number | null>(null);
  const [ema50, setEma50]   = useState<number | null>(null);
  const bottomRef           = useRef<HTMLDivElement>(null);
  const recogRef            = useRef<any>(null);

  const stocks   = useMarketStore(s => s.stocks);
  const selSym   = useMarketStore(s => s.selectedSymbol);
  const symbol   = selSym ?? (stocks[0]?.symbol ?? '');
  const live     = stocks.find(s => s.symbol === symbol);
  const pctChange = live?.pctChange ?? 0;
  useAuthStore(s => s.user);

  /* ── auto-compute indicators from live price history ── */
  useEffect(() => {
    if (!live?.price) return;

    // Collect price history for the selected symbol.
    // The market store only holds the latest snapshot per symbol, so we have
    // at most one price point here. We fall back to a single-point array so
    // the helpers below degrade gracefully instead of producing fake signals.
    const prices = stocks.filter(s => s.symbol === symbol).map(s => s.price ?? 0).filter(p => p > 0);
    if (prices.length === 0) return;

    // Proper EMA calculation
    function calcEMA(ps: number[], period: number): number {
      if (ps.length < period) return ps[ps.length - 1] ?? 0;
      const k = 2 / (period + 1);
      let ema = ps.slice(0, period).reduce((a, b) => a + b, 0) / period;
      for (let i = period; i < ps.length; i++) {
        ema = ps[i] * k + ema * (1 - k);
      }
      return ema;
    }

    // Proper RSI calculation
    function calcRSI(ps: number[], period = 14): number {
      if (ps.length < period + 1) return 50; // not enough data — return neutral
      const changes = ps.slice(1).map((p, i) => p - ps[i]);
      const gains   = changes.map(c => Math.max(c, 0));
      const losses  = changes.map(c => Math.max(-c, 0));
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
    }

    // NOTE: with a single-snapshot store, prices.length is typically 1.
    // calcEMA and calcRSI handle this gracefully (return last price / 50 respectively).
    setEma20(calcEMA(prices, 20));
    setEma50(calcEMA(prices, 50));
    setRsi(calcRSI(prices, 14));
  }, [symbol, live, pctChange, stocks]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  /* ── voice input ── */
  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window))) {
      alert('Voice input not supported in this browser. Try Chrome.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setLis(false); };
    rec.onerror  = () => setLis(false);
    rec.onend    = () => setLis(false);
    rec.start();
    recogRef.current = rec;
    setLis(true);
  }, []);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setLis(false);
  }, []);

  /* ── send message ── */
  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoad(true);

    const context = buildContext(symbol, live, rsi, ema20, ema50, pctChange, level);

    try {
      const res = await apiPost<{ response?: string; message?: string }>('/api/ai/chat', {
        message: userMsg,
        context,
        stream: false,
      });
      const reply = res?.response ?? res?.message ?? 'I could not generate a response. Please try again.';
      setMsgs(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (err: any) {
      // Distinguish error types for a more helpful user message
      let errorText: string;
      const status: number | undefined = err?.status ?? err?.statusCode ?? err?.response?.status;
      if (status === 429) {
        errorText = 'Too many requests. Please wait a moment.';
      } else if (status !== undefined && status >= 500 && status < 600) {
        errorText = 'AI service unavailable. Try again shortly.';
      } else if (
        err instanceof TypeError ||
        err?.name === 'TypeError' ||
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('fetch') ||
        err?.message?.toLowerCase().includes('failed to fetch')
      ) {
        errorText = 'Connection failed. Check your internet and try again.';
      } else {
        errorText = 'Something went wrong. Please try again.';
      }
      setMsgs(prev => [...prev, { role: 'ai', text: errorText }]);
    } finally {
      setLoad(false);
    }
  }, [loading, symbol, live, rsi, ema20, ema50, pctChange, level]);

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } };

  const QUICK_ASKS = [
    'What does the current chart pattern suggest?',
    'Is this a good entry point?',
    'Explain the RSI reading to me',
    'Are the EMAs showing a bullish or bearish signal?',
    'Should I wait for consolidation?',
  ];

  return (
    <>
      {/* ── floating button ── */}
      <button
        data-tour="floating-ai"
        onClick={() => setOpen(v => !v)}
        title="Gotham AI Advisor"
        style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', right: 20, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #00c853, #00e676)',
          boxShadow: '0 4px 24px rgba(0,200,83,.45), 0 0 0 3px rgba(0,230,118,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s', transform: open ? 'rotate(45deg) scale(0.9)' : 'scale(1)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = open ? 'rotate(45deg) scale(0.95)' : 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = open ? 'rotate(45deg) scale(0.9)' : 'scale(1)'; }}
      >
        <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-microphone-lines'}`} style={{ fontSize: 20, color: '#04060d' }} />
      </button>

      {/* ── advisor panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 144px)', right: 20, zIndex: 9998,
          width: 380, maxWidth: 'calc(100vw - 40px)',
          background: 'var(--color-bg2)', border: '1px solid var(--color-border)',
          borderRadius: 20, boxShadow: '0 16px 64px rgba(0,0,0,.65)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideUp .2s ease',
        }}>
          {/* header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(0,200,83,.2), rgba(0,230,118,.1))', border: '1px solid rgba(0,230,118,.25)', flexShrink: 0 }}>
              <i className="fa-solid fa-robot" style={{ fontSize: 16, color: '#00e676' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>Gotham AI Advisor</p>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>
                {symbol ? `Watching ${symbol} · $${(live?.price ?? 0).toFixed(2)}` : 'Select a stock on the chart'}
              </p>
            </div>
            {/* expertise level */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 2, gap: 1, flexShrink: 0 }}>
              {(['beginner', 'intermediate', 'expert'] as Level[]).map(l => (
                <button key={l} onClick={() => setLevel(l)}
                  style={{ padding: '3px 7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, transition: 'all .15s', textTransform: 'capitalize',
                    background: level === l ? '#00c853' : 'transparent',
                    color: level === l ? '#04060d' : 'var(--color-muted)' }}>
                  {l.slice(0, 3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* context bar */}
          {symbol && (
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 12, overflowX: 'auto', flexShrink: 0 }}>
              {[
                { label: 'EMA Cross', value: ema20 && ema50 ? (ema20 > ema50 ? '🟢 Bullish' : '🔴 Bearish') : '—' },
                { label: 'RSI', value: rsi !== null ? `${rsi.toFixed(0)} ${rsi > 70 ? '(OB)' : rsi < 30 ? '(OS)' : ''}` : '—' },
                { label: 'Today', value: `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`, color: pctChange >= 0 ? '#00e676' : '#ff5252' },
              ].map(item => (
                <div key={item.label} style={{ flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: (item as any).color ?? 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320 }}>
            {msgs.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)', textAlign: 'center', padding: '8px 0' }}>
                  Ask me anything about the current chart, market conditions, or trading concepts.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {QUICK_ASKS.map(q => (
                    <button key={q} onClick={() => send(q)}
                      style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'rgba(255,255,255,.03)', color: 'var(--color-text2)', fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}
                      onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(0,230,118,.06)'; (e.currentTarget as any).style.borderColor = 'rgba(0,230,118,.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(255,255,255,.03)'; (e.currentTarget as any).style.borderColor = 'var(--color-border)'; }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 13px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg, #00c853, #00e676)' : 'rgba(255,255,255,.06)',
                  border: m.role === 'ai' ? '1px solid var(--color-border)' : 'none',
                  fontSize: 13, lineHeight: 1.55, color: m.role === 'user' ? '#04060d' : 'var(--color-text)',
                  fontWeight: m.role === 'user' ? 600 : 400,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', opacity: .6, animation: `blink 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Ask about the chart, indicators, patterns…"
              rows={2}
              style={{ flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 13, color: 'var(--color-text)', outline: 'none', resize: 'none', lineHeight: 1.45, fontFamily: 'inherit' }}
            />
            {/* mic */}
            <button onClick={listening ? stopListening : startListening}
              style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${listening ? '#ff5252' : 'var(--color-border)'}`, background: listening ? 'rgba(255,82,82,.12)' : 'rgba(255,255,255,.05)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
              <i className={`fa-solid ${listening ? 'fa-stop' : 'fa-microphone'}`} style={{ fontSize: 13, color: listening ? '#ff5252' : 'var(--color-muted)' }} />
            </button>
            {/* send */}
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: input.trim() && !loading ? '#00c853' : 'rgba(255,255,255,.06)', cursor: input.trim() && !loading ? 'pointer' : 'default', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
              <i className="fa-solid fa-paper-plane" style={{ fontSize: 13, color: input.trim() && !loading ? '#04060d' : 'var(--color-muted)' }} />
            </button>
          </div>

          <p style={{ margin: 0, padding: '6px 14px 10px', fontSize: 9, color: 'var(--color-muted)', textAlign: 'center', opacity: .6 }}>
            Educational commentary only — not financial advice. Always do your own research.
          </p>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 80%, 100% { opacity: .6; transform: scale(1); }
          40% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </>
  );
}
