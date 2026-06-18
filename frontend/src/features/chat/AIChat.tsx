import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';
import type { ChatMessage } from '../../types';

const SUGGESTED_PROMPTS = [
  { icon: 'fa-chart-line',       text: 'What are the top performing JSE stocks right now?'        },
  { icon: 'fa-money-bill-trend-up', text: 'Explain dividend investing for beginners'               },
  { icon: 'fa-dollar-sign',      text: 'How does USD/JMD exchange rate affect my portfolio?'       },
  { icon: 'fa-magnifying-glass-chart', text: 'What is the P/E ratio and how do I use it?'         },
  { icon: 'fa-bullseye',         text: 'Create a conservative investment plan for J$500,000'        },
  { icon: 'fa-building-columns', text: 'Analyse NCBFG — key metrics to watch?'                     },
];

function Avatar({ role }: { role: 'user' | 'assistant' }) {
  const isUser = role === 'user';
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isUser ? 'rgba(0,230,118,.12)' : 'rgba(64,196,255,.1)',
      border: `1px solid ${isUser ? 'rgba(0,230,118,.22)' : 'rgba(64,196,255,.18)'}`,
    }}>
      <i
        className={`fa-solid ${isUser ? 'fa-user' : 'fa-robot'}`}
        style={{ fontSize: 11, color: isUser ? 'var(--color-green)' : 'var(--color-blue)' }}
      />
    </div>
  );
}

function MessageBubble({ msg, isLast }: { msg: ChatMessage; isLast?: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar role={msg.role} />
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!isUser && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', marginLeft: 2, letterSpacing: '.06em' }}>
            GOTHAM AI
          </span>
        )}
        <div style={{
          borderRadius: 16,
          ...(isUser
            ? { borderBottomRightRadius: 4, background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.2)', padding: '10px 14px' }
            : { borderBottomLeftRadius: 4, background: 'var(--color-bg3)', border: '1px solid var(--color-border)', padding: '14px 18px' }
          ),
        }}>
          {isUser ? (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </p>
          ) : (
            <MarkdownRenderer content={msg.content} style={{ fontSize: 13.5 }} />
          )}
        </div>
        {isUser && isLast && (
          <span style={{ fontSize: 10, color: 'var(--color-muted)', textAlign: 'right', marginRight: 2 }}>Just now</span>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <Avatar role="assistant" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-muted)', marginLeft: 2, letterSpacing: '.06em' }}>
          GOTHAM AI
        </span>
        <div style={{
          background: 'var(--color-bg3)', border: '1px solid var(--color-border)',
          borderRadius: 16, borderBottomLeftRadius: 4, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {[0, 150, 300].map(d => (
            <span key={d} className="animate-pulse-dot" style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: 'var(--color-blue)', animationDelay: `${d}ms`, opacity: .7,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIChat() {
  const { isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [charCount, setCharCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const [usage, setUsage] = useState<{ used: number; limit: number | 'Unlimited' } | null>(null);

  const chatMut = useMutation({
    mutationFn: (msgs: ChatMessage[]) =>
      apiPost<{ response: string; disclaimer?: string; usage?: { used: number; limit: number } | null }>('/api/chat', { messages: msgs }),
    onSuccess: (data) => {
      const resp = data.response ?? (data as unknown as string);
      if (data.usage) setUsage(data.usage);
      setMessages(prev => [...prev, { role: 'assistant', content: typeof resp === 'string' ? resp : JSON.stringify(resp) }]);
    },
    onError: (err: unknown) => {
      const e = err as { status?: number; message?: string };
      // 403 = daily AI-chat cap reached (free/core tiers). Show the friendly,
      // ChatGPT-style limit message the server returns and nudge to upgrade.
      const content = e?.status === 403
        ? (e.message || "You've reached your daily AI chat limit. It resets tomorrow — or upgrade for more.")
        : 'I encountered an issue connecting to the AI service. Please check your connection and try again.';
      setMessages(prev => [...prev, { role: 'assistant', content }]);
    },
  });

  const send = useCallback((text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || chatMut.isPending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setInput('');
    setCharCount(0);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    chatMut.mutate(next);
  }, [input, messages, chatMut]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setInput(v);
    setCharCount(v.length);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  const clearChat = () => { setMessages([]); chatMut.reset(); };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(64,196,255,.1)', border: '1px solid rgba(64,196,255,.2)' }}>
          <i className="fa-solid fa-robot" style={{ fontSize: 26, color: 'var(--color-blue)' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--color-text)' }}>Sign in to use AI Chat</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Get AI-powered financial insights for the JSE</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', maxWidth: 860, margin: '0 auto', gap: 0 }}>

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0', marginBottom: 8,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(64,196,255,.1)', border: '1px solid rgba(64,196,255,.2)' }}>
            <i className="fa-solid fa-robot" style={{ fontSize: 15, color: 'var(--color-blue)' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>Gotham AI</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--color-muted)' }}>JSE financial assistant · Claude powered · Educational use only</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {usage && usage.limit !== 'Unlimited' && (
          <span title="Daily AI chat usage" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99,
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: (usage.used / (usage.limit as number)) >= 0.8 ? '#ffd740' : 'var(--color-text2)',
            background: 'rgba(var(--fg),.04)', border: '1px solid var(--color-border)',
          }}>
            <i className="fa-solid fa-bolt" style={{ fontSize: 9, color: 'var(--color-green)' }} />
            {Math.max(0, (usage.limit as number) - usage.used)} left today
          </span>
        )}
        {messages.length > 0 && (
          <button onClick={clearChat} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
            fontSize: 11, fontWeight: 600, color: 'var(--color-muted)',
            background: 'rgba(var(--fg),.04)', border: '1px solid var(--color-border)', cursor: 'pointer',
            transition: 'all 150ms',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; }}>
            <i className="fa-solid fa-rotate-left" style={{ fontSize: 9 }} />
            New chat
          </button>
        )}
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 16 }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, paddingTop: 40 }}>
              {/* Hero */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, rgba(0,230,118,.15), rgba(64,196,255,.1))',
                  border: '1px solid rgba(0,230,118,.2)',
                  boxShadow: '0 0 40px rgba(0,230,118,.08)',
                }}>
                  <i className="fa-solid fa-robot" style={{ fontSize: 30, color: 'var(--color-green)' }} />
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Gotham Financial AI</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', maxWidth: 380 }}>
                  Ask me about JSE stocks, investment strategies, portfolio construction, or financial planning.
                </p>
              </div>

              {/* Prompt grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, width: '100%', maxWidth: 680 }}>
                {SUGGESTED_PROMPTS.map(p => (
                  <button key={p.text} onClick={() => send(p.text)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px',
                    borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 180ms',
                    background: 'var(--color-bg2)', border: '1px solid var(--color-border)',
                  }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(0,230,118,.3)'; el.style.background = 'rgba(0,230,118,.05)'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border)'; el.style.background = 'var(--color-bg2)'; }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.1)', flexShrink: 0, marginTop: 1 }}>
                      <i className={`fa-solid ${p.icon}`} style={{ fontSize: 11, color: 'var(--color-green)' }} />
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--color-text2)', lineHeight: 1.5 }}>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} isLast={i === messages.length - 1 && msg.role === 'user'} />
            ))
          )}

          {chatMut.isPending && <ThinkingBubble />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div style={{ paddingTop: 12 }}>
        <div style={{
          background: 'var(--color-bg2)', border: '1px solid var(--color-border)',
          borderRadius: 18, overflow: 'hidden', transition: 'border-color 200ms',
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,230,118,.3)'; }}
          onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKey}
            placeholder="Ask about stocks, markets, or financial planning... (Enter to send, Shift+Enter for new line)"
            rows={1}
            style={{
              width: '100%', padding: '14px 16px', background: 'transparent',
              border: 'none', outline: 'none', resize: 'none',
              fontSize: 14, color: 'var(--color-text)', fontFamily: 'var(--font-sans)',
              lineHeight: 1.6, minHeight: 52, maxHeight: 140, boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid rgba(var(--fg),.04)' }}>
            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
              {charCount > 0 ? `${charCount} chars` : 'Educational purposes only — not financial advice'}
            </span>
            <button
              onClick={() => send()}
              disabled={!input.trim() || chatMut.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 180ms',
                background: input.trim() ? 'var(--color-green)' : 'rgba(var(--fg),.06)',
                color: input.trim() ? 'var(--color-bg)' : 'var(--color-muted)',
                boxShadow: input.trim() ? '0 2px 12px rgba(0,230,118,.3)' : 'none',
                opacity: chatMut.isPending ? .6 : 1,
              }}>
              <i className="fa-solid fa-paper-plane" style={{ fontSize: 10 }} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
