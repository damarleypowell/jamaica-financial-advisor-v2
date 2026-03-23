import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWatchlists, createWatchlist, deleteWatchlist, addSymbol, removeSymbol } from '@/api/watchlists';
import { getStocks } from '@/api/market';
import { useAuth } from '@/context/AuthContext';
import { useSSE } from '@/hooks/useSSE';
import { fmtJMD, fmtPercent, changeColor, changeBg } from '@/utils/formatters';
import type { Watchlist, Stock } from '@/types';
import toast from 'react-hot-toast';

export default function Watchlists() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { stocks: liveStocks } = useSSE();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  const { data: watchlists = [], isLoading } = useQuery({
    queryKey: ['watchlists'],
    queryFn: getWatchlists,
    enabled: isAuthenticated,
  });

  const { data: fetchedStocks = [] } = useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
  });

  const stocks = liveStocks.length > 0 ? liveStocks : fetchedStocks;
  const stockMap = new Map(stocks.map(s => [s.symbol, s]));

  const selected = watchlists.find(w => w.id === selectedId) || watchlists[0];

  const createMut = useMutation({
    mutationFn: createWatchlist,
    onSuccess: (wl) => { queryClient.invalidateQueries({ queryKey: ['watchlists'] }); setSelectedId(wl.id); setNewName(''); toast.success('Watchlist created'); },
    onError: () => toast.error('Failed to create watchlist'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteWatchlist,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlists'] }); setSelectedId(null); toast.success('Watchlist deleted'); },
    onError: () => toast.error('Failed to delete watchlist'),
  });

  const addMut = useMutation({
    mutationFn: ({ id, sym }: { id: string; sym: string }) => addSymbol(id, sym),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlists'] }); setAddSearch(''); setShowAddInput(false); toast.success('Symbol added'); },
    onError: () => toast.error('Failed to add symbol'),
  });

  const removeMut = useMutation({
    mutationFn: ({ id, sym }: { id: string; sym: string }) => removeSymbol(id, sym),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlists'] }); toast.success('Symbol removed'); },
    onError: () => toast.error('Failed to remove symbol'),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <i className="fas fa-eye text-4xl text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Watchlists</h2>
        <p className="text-sm text-text-secondary">Please log in to manage your watchlists.</p>
      </div>
    );
  }

  const filteredStocks = addSearch
    ? stocks.filter(s =>
        s.symbol.toLowerCase().includes(addSearch.toLowerCase()) ||
        s.name.toLowerCase().includes(addSearch.toLowerCase())
      ).filter(s => !selected?.symbols.includes(s.symbol)).slice(0, 6)
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar — Watchlist List */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">My Watchlists</h3>
          <span className="text-[10px] text-text-muted">{watchlists.length} lists</span>
        </div>

        {/* Create */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="New watchlist name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newName.trim() && createMut.mutate(newName.trim())}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary placeholder:text-text-muted focus:border-gf-green/50 focus:outline-none"
          />
          <button
            onClick={() => newName.trim() && createMut.mutate(newName.trim())}
            disabled={!newName.trim() || createMut.isPending}
            className="px-3 py-2 rounded-lg bg-gf-green text-bg text-xs font-semibold hover:bg-gf-green/90 disabled:opacity-50"
          >
            <i className="fas fa-plus" />
          </button>
        </div>

        {/* List */}
        <div className="space-y-1">
          {isLoading ? (
            <div className="py-4 text-center text-text-muted text-xs">Loading...</div>
          ) : watchlists.length === 0 ? (
            <div className="py-4 text-center text-text-muted text-xs">No watchlists yet. Create one above.</div>
          ) : (
            watchlists.map(wl => (
              <button
                key={wl.id}
                onClick={() => setSelectedId(wl.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selected?.id === wl.id ? 'bg-gf-green/10 text-gf-green' : 'hover:bg-white/5 text-text-secondary'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold">{wl.name}</span>
                  <span className="text-[10px] text-text-muted ml-2">{wl.symbols.length} stocks</span>
                </div>
                <i className="fas fa-chevron-right text-[10px] text-text-muted" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main — Selected Watchlist */}
      <div className="lg:col-span-3 glass-card p-4">
        {selected ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{selected.name}</h3>
                <p className="text-[10px] text-text-muted">{selected.symbols.length} symbols</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddInput(!showAddInput)}
                  className="px-3 py-1.5 rounded-lg bg-gf-green/20 text-gf-green text-xs font-semibold hover:bg-gf-green/30"
                >
                  <i className="fas fa-plus mr-1" />Add Symbol
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${selected.name}"?`)) deleteMut.mutate(selected.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20"
                >
                  <i className="fas fa-trash mr-1" />Delete
                </button>
              </div>
            </div>

            {/* Add Symbol Search */}
            {showAddInput && (
              <div className="mb-4 relative">
                <input
                  type="text"
                  placeholder="Search symbol to add..."
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary focus:border-gf-green/50 focus:outline-none"
                  autoFocus
                />
                {filteredStocks.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-bg3 border border-white/10 rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredStocks.map(s => (
                      <button
                        key={s.symbol}
                        onClick={() => addMut.mutate({ id: selected.id, sym: s.symbol })}
                        className="w-full px-3 py-2 flex justify-between hover:bg-white/5 text-left text-xs"
                      >
                        <span className="font-semibold text-text-primary">{s.symbol}</span>
                        <span className="text-text-muted">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Stocks */}
            {selected.symbols.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs">
                <i className="fas fa-eye-slash text-2xl mb-3 block" />
                No symbols in this watchlist. Add some above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {selected.symbols.map(sym => {
                  const s = stockMap.get(sym);
                  return (
                    <div key={sym} className="bg-white/[0.03] rounded-lg p-3 flex items-center justify-between hover:bg-white/[0.05] transition-colors">
                      <div>
                        <p className="text-xs font-semibold text-text-primary">{sym}</p>
                        {s && <p className="text-[10px] text-text-muted">{s.name}</p>}
                        {s && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold font-num text-text-primary">{fmtJMD(s.price)}</span>
                            <span className={`text-[10px] font-num px-1.5 py-0.5 rounded ${changeBg(s.changePercent)} ${changeColor(s.changePercent)}`}>
                              {fmtPercent(s.changePercent)}
                            </span>
                          </div>
                        )}
                        {!s && <p className="text-[10px] text-text-muted mt-1">Price unavailable</p>}
                      </div>
                      <button
                        onClick={() => removeMut.mutate({ id: selected.id, sym })}
                        className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                      >
                        <i className="fas fa-times text-xs" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center text-text-muted text-xs">
            <i className="fas fa-eye text-2xl mb-3 block" />
            {watchlists.length > 0 ? 'Select a watchlist' : 'Create your first watchlist'}
          </div>
        )}
      </div>
    </div>
  );
}
