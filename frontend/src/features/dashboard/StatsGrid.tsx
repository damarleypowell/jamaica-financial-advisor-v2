import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { useMarketStore } from '../../stores/market';

interface Overview {
  jseIndex?: number; jseIndexChange?: number;
  totalVolume?: number; advancers?: number; decliners?: number;
  unchanged?: number; totalStocks?: number;
}

function N(n?: number, dp = 2) { return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
function fmtVol(n?: number) {
  const v = n ?? 0;
  if (v >= 1e9) return (v/1e9).toFixed(2)+'B';
  if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
  if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
  return v.toLocaleString();
}

function BreadthBar({ a, d, u }: { a: number; d: number; u: number }) {
  const total = a + d + u || 1;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 4, borderRadius: 99, display: 'flex', gap: 2, overflow: 'hidden', background: 'rgba(var(--fg),.04)' }}>
        <div style={{ height: '100%', borderRadius: 99, background: '#00e676', transition: 'width .5s', width: `${(a/total)*100}%` }} />
        <div style={{ height: '100%', borderRadius: 99, background: '#ff5252', transition: 'width .5s', width: `${(d/total)*100}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#00e676', fontFamily: 'var(--font-mono)' }}>{a} up</span>
        <span style={{ fontSize: 9, color: 'var(--color-muted)' }}>{u} flat</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#ff5252', fontFamily: 'var(--font-mono)' }}>{d} down</span>
      </div>
    </div>
  );
}

interface CardCfg {
  icon: string; color: string; bg: string; grad: string;
  label: string; value: string; sub?: string;
  change?: number; extra?: React.ReactNode;
}

function StatCard({ icon, color, bg, grad, label, value, sub, change, extra }: CardCfg) {
  const pos = (change ?? 0) > 0, neg = (change ?? 0) < 0;
  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden', transition: 'border-color 200ms, transform 200ms', minHeight: 130 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border2)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = ''; }}>
      {/* Accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: grad }} />
      {/* Glow */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: color, opacity: .08, filter: 'blur(30px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, flexShrink: 0 }}>
            <i className={icon} style={{ fontSize: 14, color }} />
          </div>
          {change !== undefined && Math.abs(change) > 0.001 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, border: '1px solid', color: pos ? '#00e676' : neg ? '#ff5252' : 'var(--color-muted)', background: pos ? 'rgba(0,230,118,.08)' : neg ? 'rgba(255,82,82,.08)' : 'rgba(var(--fg),.04)', borderColor: pos ? 'rgba(0,230,118,.22)' : neg ? 'rgba(255,82,82,.22)' : 'rgba(var(--fg),.08)' }}>
              <i className={`fa-solid ${pos ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} style={{ fontSize: 7 }} />
              {pos ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', lineHeight: 1, letterSpacing: '-.02em' }}>{value}</p>
        <p style={{ margin: '5px 0 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>{label}</p>
        {sub && <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--color-muted)', opacity: .65 }}>{sub}</p>}
        {extra}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 20px', minHeight: 130 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 99 }} />
      </div>
      <div className="skeleton" style={{ width: 120, height: 26, borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 6 }} />
    </div>
  );
}

export default function StatsGrid() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ['market-overview'],
    queryFn: () => apiGet<Overview>('/api/market-overview'),
    refetchInterval: 30_000,
    retry: 1,
  });

  const stocks = useMarketStore(s => s.stocks);
  const liveA  = stocks.filter(s => (s.pctChange ?? 0) > 0).length;
  const liveD  = stocks.filter(s => (s.pctChange ?? 0) < 0).length;
  const liveU  = stocks.length - liveA - liveD;

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
        {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const jse  = data?.jseIndex ?? 0;
  const jseΔ = data?.jseIndexChange ?? 0;
  const vol  = data?.totalVolume ?? 0;
  const adv  = data?.advancers ?? liveA;
  const dec  = data?.decliners ?? liveD;
  const unch = data?.unchanged ?? liveU;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
      <StatCard
        icon="fa-solid fa-chart-line" color="#00e676"
        bg="rgba(0,230,118,.1)" grad="linear-gradient(90deg,#00e676,transparent)"
        label="JSE Index" change={jseΔ !== 0 ? jseΔ : undefined}
        value={jse > 0 ? N(jse, 0) : '—'} sub={jse > 0 ? 'Composite Index' : 'Live feed pending'}
      />
      <StatCard
        icon="fa-solid fa-chart-column" color="#ffd740"
        bg="rgba(255,215,64,.1)" grad="linear-gradient(90deg,#ffd740,transparent)"
        label="Volume" value={vol > 0 ? fmtVol(vol) : '—'} sub="Shares traded today"
      />
      <StatCard
        icon="fa-solid fa-scale-balanced" color="#40c4ff"
        bg="rgba(64,196,255,.1)" grad="linear-gradient(90deg,#40c4ff,transparent)"
        label="Market Breadth" value={`${adv} / ${dec}`}
        extra={<BreadthBar a={adv} d={dec} u={unch} />}
      />
      <StatCard
        icon="fa-solid fa-building-columns" color="#ce93d8"
        bg="rgba(206,147,216,.1)" grad="linear-gradient(90deg,#ce93d8,transparent)"
        label="Securities" value={stocks.length > 0 ? stocks.length.toLocaleString() : '—'}
        sub={stocks.length > 0 ? `${adv} gaining · ${dec} falling` : 'Loading...'}
      />
    </div>
  );
}
