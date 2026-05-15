import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

interface LeaderEntry {
  rank: number;
  userId: string;
  name: string;
  returnPct: number;
  portfolioValue: number;
  trades: number;
  winRate: number;
  tier: string;
}

const fmt2 = (n?: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tierColor = (t?: string) => {
  if (t === 'ENTERPRISE') return 'var(--color-purple)';
  if (t === 'PRO')        return 'var(--color-gold)';
  if (t === 'BASIC')      return 'var(--color-blue)';
  return 'var(--color-green)';
};

const MOCK_LEADERS: LeaderEntry[] = [
  { rank: 1, userId: '1', name: 'Marcus W.',    returnPct: 47.3,  portfolioValue: 2340000, trades: 128, winRate: 71, tier: 'PRO' },
  { rank: 2, userId: '2', name: 'Kezia N.',     returnPct: 38.9,  portfolioValue: 1890000, trades: 94,  winRate: 68, tier: 'PRO' },
  { rank: 3, userId: '3', name: 'Andre T.',     returnPct: 31.2,  portfolioValue: 1560000, trades: 72,  winRate: 62, tier: 'BASIC' },
  { rank: 4, userId: '4', name: 'Simone B.',    returnPct: 28.7,  portfolioValue: 1340000, trades: 61,  winRate: 65, tier: 'BASIC' },
  { rank: 5, userId: '5', name: 'Kyle F.',      returnPct: 24.1,  portfolioValue: 1120000, trades: 45,  winRate: 58, tier: 'BASIC' },
  { rank: 6, userId: '6', name: 'Renee M.',     returnPct: 19.8,  portfolioValue: 980000,  trades: 88,  winRate: 55, tier: 'FREE'  },
  { rank: 7, userId: '7', name: 'Devon C.',     returnPct: 16.4,  portfolioValue: 870000,  trades: 33,  winRate: 60, tier: 'FREE'  },
  { rank: 8, userId: '8', name: 'Natasha R.',   returnPct: 14.2,  portfolioValue: 760000,  trades: 41,  winRate: 54, tier: 'BASIC' },
  { rank: 9, userId: '9', name: 'Omar P.',      returnPct: 11.9,  portfolioValue: 650000,  trades: 27,  winRate: 52, tier: 'FREE'  },
  { rank: 10,userId: '10',name: 'Crystal J.',   returnPct: 9.7,   portfolioValue: 540000,  trades: 19,  winRate: 57, tier: 'FREE'  },
];

const MEDAL = ['🥇','🥈','🥉'];

function PodiumCard({ entry }: { entry: LeaderEntry }) {
  const c = tierColor(entry.tier);
  const isFirst = entry.rank === 1;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: isFirst ? '24px 16px' : '18px 16px', background: `linear-gradient(160deg, ${c}14, ${c}06)`, border: `1px solid ${c}33`, borderRadius: 18, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: `${c}12`, filter: 'blur(20px)' }} />
      <span style={{ fontSize: isFirst ? 32 : 26 }}>{MEDAL[entry.rank - 1] ?? `#${entry.rank}`}</span>
      <div style={{ width: isFirst ? 52 : 44, height: isFirst ? 52 : 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c}22`, border: `2px solid ${c}55` }}>
        <span style={{ fontSize: isFirst ? 18 : 15, fontWeight: 900, color: c }}>{entry.name.charAt(0)}</span>
      </div>
      <p style={{ margin: 0, fontSize: isFirst ? 15 : 13, fontWeight: 800, color: 'var(--color-text)' }}>{entry.name}</p>
      <p style={{ margin: 0, fontSize: isFirst ? 22 : 18, fontWeight: 900, color: c, fontFamily: 'var(--font-mono)' }}>+{entry.returnPct.toFixed(1)}%</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${c}18`, color: c, border: `1px solid ${c}33` }}>{entry.tier}</span>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{entry.trades} trades</span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuthStore();

  const { data: leaders = MOCK_LEADERS } = useQuery<LeaderEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: () => apiGet('/api/leaderboard'),
    retry: 0,
    initialData: MOCK_LEADERS,
  });

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,215,64,.12)', border: '1px solid rgba(255,215,64,.2)', flexShrink: 0 }}>
          <i className="fa-solid fa-trophy" style={{ fontSize: 18, color: 'var(--color-gold)' }} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--color-text)' }}>Paper Trading Leaderboard</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Top performers ranked by total return · Paper accounts only · Resets monthly</p>
        </div>
      </div>

      {/* Podium */}
      {top3.length >= 3 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <PodiumCard entry={top3[1]} />
          <PodiumCard entry={top3[0]} />
          <PodiumCard entry={top3[2]} />
        </div>
      )}

      {/* Rest */}
      <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                {['Rank', 'Trader', 'Return', 'Portfolio Value', 'Win Rate', 'Trades', 'Tier'].map((h, i) => (
                  <th key={h} style={{ padding: '11px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i <= 1 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map(e => {
                const c = tierColor(e.tier);
                const isMe = user && user.name.split(' ')[0] === e.name.split(' ')[0];
                return (
                  <tr key={e.rank} style={{ borderBottom: '1px solid rgba(255,255,255,.025)', background: isMe ? 'rgba(0,230,118,.04)' : '' }}
                    onMouseEnter={el => (el.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                    onMouseLeave={el => (el.currentTarget.style.background = isMe ? 'rgba(0,230,118,.04)' : '')}>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>#{e.rank}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c}18`, border: `1px solid ${c}33`, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: c }}>{e.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{e.name}{isMe && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: 'var(--color-green)', background: 'rgba(0,230,118,.12)', padding: '1px 6px', borderRadius: 999 }}>YOU</span>}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-green)' }}>+{e.returnPct.toFixed(1)}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text2)' }}>J${fmt2(e.portfolioValue)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: e.winRate >= 60 ? 'var(--color-green)' : 'var(--color-text2)' }}>{e.winRate}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>{e.trades}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${c}18`, color: c, border: `1px solid ${c}33` }}>{e.tier}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-muted)', margin: 0 }}>
        <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
        Leaderboard shows paper trading results only. Past performance is not indicative of future results.
      </p>
    </div>
  );
}
