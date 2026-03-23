import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { chat } from '@/api/ai';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallModal from '@/components/common/PaywallModal';
import type { ChatMessage } from '@/types';

const SUGGESTED_PROMPTS = [
  'What are the top performing JSE stocks this week?',
  'Analyze NCBFG — should I buy?',
  'Explain dividend investing for beginners',
  'What is the Sharpe ratio and why does it matter?',
  'How does USD/JMD exchange rate affect my portfolio?',
  'Create a conservative investment plan for J$500,000',
];

export default function AIChat() {
  const { isAuthenticated } = useAuth();
  const { hasTier, showPaywall, requiredTier, closePaywall, requireTier } = useSubscription();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { requireTier('PRO'); }, [requireTier]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const chatMut = useMutation({
    mutationFn: (msgs: ChatMessage[]) => chat(msgs),
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    },
  });

  const isPro = hasTier('PRO');
  if (showPaywall) return <PaywallModal requiredTier={requiredTier} onClose={closePaywall} />;
  if (!isPro) return null;

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg || chatMut.isPending) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    chatMut.mutate(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gf-green/20 to-gf-blue/20 flex items-center justify-center mb-4">
              <i className="fas fa-robot text-2xl text-gf-green" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-1">Gotham Financial AI</h2>
            <p className="text-xs text-text-secondary mb-6 max-w-md">
              Your AI-powered financial assistant. Ask about stocks, market analysis, investment strategies, or financial planning.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="glass-card px-4 py-3 text-xs text-text-secondary hover:text-text-primary hover:border-gf-green/20 transition-all text-left"
                >
                  <i className="fas fa-arrow-right text-gf-green mr-2 text-[10px]" />{prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-gf-green/20 text-text-primary rounded-br-sm'
                : 'glass-card text-text-secondary rounded-bl-sm'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-gf-green/20 flex items-center justify-center">
                    <i className="fas fa-robot text-[8px] text-gf-green" />
                  </div>
                  <span className="text-[10px] text-text-muted font-semibold">Gotham AI</span>
                </div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {chatMut.isPending && (
          <div className="flex justify-start">
            <div className="glass-card rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-gf-green/20 flex items-center justify-center">
                  <i className="fas fa-robot text-[8px] text-gf-green" />
                </div>
                <span className="text-[10px] text-text-muted font-semibold">Gotham AI</span>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gf-green/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gf-green/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gf-green/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-card p-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about stocks, markets, or financial planning..."
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-text-primary placeholder:text-text-muted focus:border-gf-green/50 focus:outline-none resize-none max-h-32"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || chatMut.isPending}
            className="px-5 py-3 rounded-xl bg-gf-green text-bg font-semibold text-sm hover:bg-gf-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <i className="fas fa-paper-plane" />
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-2 text-center">
          AI responses are for informational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
