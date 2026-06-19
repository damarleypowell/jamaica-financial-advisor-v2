import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { useMarketStore } from '../../stores/market';

// ── Types ────────────────────────────────────────────────────────────────────

interface DashStats {
  totalUsers?: number; newUsersToday?: number; newUsersMonth?: number; newUsersLastMonth?: number;
  totalOrders?: number; ordersToday?: number; ordersMonth?: number;
  activeSubscriptions?: number; totalAlerts?: number;
  recentUsers?: UserRow[]; recentOrders?: OrderRow[];
  subscriptionBreakdown?: Array<{ plan: string; _count: { plan: number } }>;
  growth?: Array<{ date: string; count: number }>;
  error?: string;
}

interface UserRow {
  id: string; name?: string; email: string; createdAt: string;
  kycStatus?: string; isActive?: boolean; subscriptionTier?: string;
  emailVerified?: boolean; onboardingCompleted?: boolean;
  twoFactorEnabled?: boolean; riskProfile?: string;
  _count?: { orders?: number; transactions?: number; chatHistory?: number };
}

interface OrderRow {
  id: string; symbol: string; side: string; orderType?: string;
  quantity?: number; limitPrice?: number; status: string; createdAt: string;
  userId?: string; user?: { name?: string; email: string };
}

interface SecurityEvent {
  id: string | number; type: string; detail: string; severity: string; ts: string;
}

interface SystemHealth {
  uptime?: number; memUsedMb?: number; memTotalMb?: number; memPct?: number;
  cpuLoad?: number[]; dbLatencyMs?: number; dbStatus?: string;
  services?: Record<string, boolean | string>; nodeVersion?: string;
}

interface AuditEntry {
  id: string; action: string; details?: Record<string, unknown>;
  ipAddress?: string; createdAt: string; user?: { name?: string; email: string };
}

interface Broadcast { id: string | number; title?: string; subject?: string; message?: string; body?: string; type?: string; sentAt: string; sentBy?: string; recipientCount?: number; }
interface GrowthPoint { date: string; count: number; }

type AdminTab = 'overview' | 'users' | 'orders' | 'security' | 'health' | 'broadcast' | 'audit';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SYNE = "'Syne', 'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const fmt = (n?: number) => (n ?? 0).toLocaleString();
function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}
function fmtUptime(s?: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const TIER_COLORS: Record<string, string> = {
  FREE: '#78909c', CORE: '#40c4ff', PRO: '#ffd740', ENTERPRISE: '#ce93d8',
};
const SEV_COLORS: Record<string, string> = {
  low: '#00e676', medium: '#ffd740', high: '#ff8a65', critical: '#ff5252',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, color, label, value, sub, grad }: {
  icon: string; color: string; label: string; value: string; sub?: string; grad: string;
}) {
  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: grad }} />
      <div style={{ position: 'absolute', top: -16, right: -16, width: 70, height: 70, borderRadius: '50%', background: color, opacity: .07, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '18', marginBottom: 10 }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 13, color }} />
      </div>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: MONO, color: 'var(--color-text)', lineHeight: 1 }}>{value}</p>
      <p style={{ margin: '5px 0 0', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--color-muted)' }}>{label}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 9.5, color: 'var(--color-muted)', opacity: .65 }}>{sub}</p>}
    </div>
  );
}

function Badge({ label, color }: { label?: string; color?: string }) {
  const c = color || (label?.toLowerCase() === 'active' || label?.toLowerCase() === 'filled' || label?.toLowerCase() === 'verified' ? '#00e676'
    : label?.toLowerCase() === 'pending' ? '#ffd740'
    : label?.toLowerCase() === 'cancelled' || label?.toLowerCase() === 'rejected' || label?.toLowerCase() === 'inactive' ? '#ff5252'
    : 'var(--color-muted)');
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: c, background: c + '18', border: `1px solid ${c}30` }}>{label || '—'}</span>;
}

function TierBadge({ tier }: { tier?: string }) {
  const t = tier || 'FREE';
  const c = TIER_COLORS[t] || '#78909c';
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: c, background: c + '18', border: `1px solid ${c}30` }}>{t}</span>;
}

function SectionCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, fontFamily: SYNE, color: 'var(--color-text)' }}>{title}</h3>
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--color-muted)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ label, color, icon, onClick, small }: { label: string; color: string; icon?: string; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: small ? '3px 8px' : '5px 10px', borderRadius: 7, fontSize: small ? 9.5 : 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}40`, background: color + '12', color, transition: 'all 120ms' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = color + '22'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = color + '12'; }}
    >
      {icon && <i className={`fa-solid ${icon}`} style={{ fontSize: small ? 8 : 10 }} />}{label}
    </button>
  );
}

function GrowthChart({ data }: { data: GrowthPoint[] }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const last7 = data.slice(-7);
  return (
    <div style={{ padding: '16px 20px 20px' }}>
      <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Daily Signups — Last 30 Days</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {data.map((d, i) => {
          const h = max === 0 ? 4 : Math.max(4, (d.count / max) * 80);
          const isLast7 = i >= data.length - 7;
          return (
            <div key={d.date} title={`${d.date}: ${d.count} users`} style={{ flex: 1, height: h, borderRadius: '3px 3px 0 0', background: isLast7 ? '#00e676' : 'rgba(0,230,118,.25)', cursor: 'default', transition: 'background 200ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#00e676'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isLast7 ? '#00e676' : 'rgba(0,230,118,.25)'; }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 9, fontFamily: MONO, color: 'var(--color-muted)' }}>{data[0]?.date}</span>
        <span style={{ fontSize: 9, fontFamily: MONO, color: '#00e676' }}>+{last7.reduce((a, d) => a + d.count, 0)} last 7d</span>
        <span style={{ fontSize: 9, fontFamily: MONO, color: 'var(--color-muted)' }}>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function MemDonut({ pct }: { pct: number }) {
  const r = 28, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const color = pct > 85 ? '#ff5252' : pct > 65 ? '#ffd740' : '#00e676';
  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(var(--fg),.06)" strokeWidth={8} />
      <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" style={{ transition: 'stroke-dasharray 600ms ease' }} />
      <text x={36} y={40} textAnchor="middle" fill={color} fontSize={13} fontWeight={700} fontFamily={MONO}>{Math.round(pct)}%</text>
    </svg>
  );
}

// ── User Slide-over Panel ─────────────────────────────────────────────────────

function UserPanel({ user, onClose, onUpdate }: {
  user: UserRow | null; onClose: () => void;
  onUpdate: (id: string, data: Partial<{ isActive: boolean; kycStatus: string; subscriptionTier: string }>) => void;
}) {
  // Hooks must run unconditionally — keep them above the early return.
  // The `key={user.id}` at the call site remounts this panel per user, so
  // these initializers always reflect the currently selected user.
  const [tier, setTier] = useState(user?.subscriptionTier || 'FREE');
  const [kyc, setKyc] = useState(user?.kycStatus || 'NONE');
  if (!user) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 400, background: 'var(--color-bg)', borderLeft: '1px solid var(--color-border)', overflow: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, fontFamily: SYNE, color: 'var(--color-text)' }}>{user.name || 'User'}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>{user.email}</p>
            <p style={{ margin: '2px 0 0', fontSize: 9, fontFamily: MONO, color: 'var(--color-muted)', opacity: .5 }}>{user.id}</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'rgba(var(--fg),.07)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: 'var(--color-muted)', fontSize: 14 }}>×</button>
        </div>

        {/* Status row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={user.isActive ? 'Active' : 'Inactive'} />
          <Badge label={user.kycStatus} />
          <TierBadge tier={user.subscriptionTier} />
          {user.emailVerified && <Badge label="Email Verified" color="#00e676" />}
          {user.twoFactorEnabled && <Badge label="2FA On" color="#40c4ff" />}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Orders', value: user._count?.orders ?? 0 },
            { label: 'Txns', value: user._count?.transactions ?? 0 },
            { label: 'Chats', value: user._count?.chatHistory ?? 0 },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(var(--fg),.04)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, fontFamily: MONO, color: 'var(--color-text)' }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Joined', value: fmtDate(user.createdAt) },
            { label: 'Risk Profile', value: user.riskProfile || '—' },
            { label: 'Onboarding', value: user.onboardingCompleted ? 'Complete' : 'Incomplete' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(var(--fg),.03)' }}>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{r.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', fontFamily: MONO }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Change Tier</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['FREE', 'CORE', 'PRO', 'ENTERPRISE'] as const).map(t => (
                <button key={t} onClick={() => setTier(t)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${tier === t ? TIER_COLORS[t] : 'var(--color-border)'}`, background: tier === t ? TIER_COLORS[t] + '20' : 'transparent', color: tier === t ? TIER_COLORS[t] : 'var(--color-muted)', transition: 'all 120ms' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>KYC Status</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['NONE', 'PENDING', 'VERIFIED', 'REJECTED'] as const).map(k => (
                <button key={k} onClick={() => setKyc(k)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${kyc === k ? '#ffd740' : 'var(--color-border)'}`, background: kyc === k ? 'rgba(255,215,64,.15)' : 'transparent', color: kyc === k ? '#ffd740' : 'var(--color-muted)', transition: 'all 120ms' }}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => onUpdate(user.id, { subscriptionTier: tier, kycStatus: kyc })}
            style={{ padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#00e676', color: '#04060d', fontFamily: SYNE, transition: 'opacity 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '.85'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            Save Changes
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <ActionBtn label={user.isActive ? 'Suspend' : 'Activate'} color={user.isActive ? '#ff5252' : '#00e676'} icon={user.isActive ? 'fa-ban' : 'fa-circle-check'}
              onClick={() => onUpdate(user.id, { isActive: !user.isActive })} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Admin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  // User tab state
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTierFilter, setUserTierFilter] = useState('');
  const [userKycFilter, setUserKycFilter] = useState('');

  // Order tab state
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderPage, setOrderPage] = useState(1);

  // Security tab state
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Broadcast tab state
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  // Audit tab state
  const [auditPage, setAuditPage] = useState(1);

  const stocks = useMarketStore(s => s.stocks);
  const isConn = useMarketStore(s => s.isConnected);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: dash, isLoading: dashLoading } = useQuery<DashStats>({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiGet<DashStats>('/api/admin/dashboard'),
    staleTime: 60_000, refetchInterval: 90_000, retry: 0,
  });

  const { data: usersData } = useQuery<{ users: UserRow[]; total: number; pages: number }>({
    queryKey: ['admin-users', userPage, userSearch, userTierFilter, userKycFilter],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(userPage), limit: '20' });
      if (userSearch) p.set('search', userSearch);
      if (userTierFilter) p.set('tier', userTierFilter);
      if (userKycFilter) p.set('kycStatus', userKycFilter);
      return apiGet<{ users: UserRow[]; total: number; pages: number }>(`/api/admin/users?${p}`);
    },
    enabled: tab === 'users',
    staleTime: 30_000, retry: 0,
  });

  const { data: ordersData } = useQuery<{ orders: OrderRow[]; total: number; pages: number }>({
    queryKey: ['admin-orders', orderPage, orderStatusFilter, orderSymbol],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(orderPage), limit: '20' });
      if (orderStatusFilter) p.set('status', orderStatusFilter);
      if (orderSymbol) p.set('symbol', orderSymbol.toUpperCase());
      return apiGet<{ orders: OrderRow[]; total: number; pages: number }>(`/api/admin/orders?${p}`);
    },
    enabled: tab === 'orders',
    staleTime: 30_000, retry: 0,
  });

  const { data: secEventsData } = useQuery<{ events: SecurityEvent[]; total: number }>({
    queryKey: ['admin-security-events'],
    queryFn: () => apiGet('/api/admin/security/events?limit=100'),
    enabled: tab === 'security',
    staleTime: 15_000, refetchInterval: 30_000, retry: 0,
  });

  const { data: blockedIPsData } = useQuery<{ blockedIPs: string[] }>({
    queryKey: ['admin-blocked-ips'],
    queryFn: () => apiGet('/api/admin/security/blocked-ips'),
    enabled: tab === 'security',
    staleTime: 15_000, refetchInterval: 30_000, retry: 0,
  });

  const secEvents = { events: secEventsData?.events ?? [], blockedIPs: blockedIPsData?.blockedIPs ?? [] };

  const { data: sysHealth } = useQuery<SystemHealth>({
    queryKey: ['admin-health'],
    queryFn: () => apiGet('/api/admin/system/health'),
    enabled: tab === 'health',
    staleTime: 10_000, refetchInterval: 20_000, retry: 0,
  });

  const { data: broadcastsData } = useQuery<{ broadcasts: Broadcast[] }>({
    queryKey: ['admin-broadcasts'],
    queryFn: () => apiGet('/api/admin/broadcasts'),
    enabled: tab === 'broadcast',
    staleTime: 60_000, retry: 0,
  });

  const { data: auditData } = useQuery<{ entries: AuditEntry[]; total: number; pages: number }>({
    queryKey: ['admin-audit', auditPage],
    queryFn: () => apiGet(`/api/admin/audit?page=${auditPage}&limit=25`),
    enabled: tab === 'audit',
    staleTime: 30_000, retry: 0,
  });

  const { data: growthData } = useQuery<{ daily: GrowthPoint[] }>({
    queryKey: ['admin-growth'],
    queryFn: () => apiGet('/api/admin/analytics/growth'),
    staleTime: 300_000, retry: 0,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiPut(`/api/admin/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-dashboard'] }); setSelectedUser(null); },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const blockIP = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason?: string }) =>
      apiPost('/api/admin/security/block-ip', { ip, reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-security-events'] }); qc.invalidateQueries({ queryKey: ['admin-blocked-ips'] }); setBlockIpInput(''); setBlockReason(''); },
  });

  const unblockIP = useMutation({
    mutationFn: (ip: string) => apiDelete(`/api/admin/security/block-ip/${encodeURIComponent(ip)}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-blocked-ips'] }); },
  });

  const sendBroadcast = useMutation({
    mutationFn: () => apiPost('/api/admin/broadcast', { title: broadcastSubject, message: broadcastBody, type: 'info' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }); setBroadcastSubject(''); setBroadcastBody(''); },
  });

  const refreshMarket = useMutation({
    mutationFn: () => apiPost('/api/admin/market/refresh'),
  });

  const handleUserUpdate = useCallback((id: string, data: Partial<{ isActive: boolean; kycStatus: string; subscriptionTier: string }>) => {
    updateUser.mutate({ id, data });
  }, [updateUser]);

  // ── Tab config ───────────────────────────────────────────────────────────────

  const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
    { key: 'users', label: 'Users', icon: 'fa-users' },
    { key: 'orders', label: 'Orders', icon: 'fa-receipt' },
    { key: 'security', label: 'Security', icon: 'fa-shield-halved' },
    { key: 'health', label: 'Health', icon: 'fa-server' },
    { key: 'broadcast', label: 'Broadcast', icon: 'fa-bullhorn' },
    { key: 'audit', label: 'Audit Log', icon: 'fa-scroll' },
  ];

  const INPUT = {
    background: 'rgba(var(--fg),.05)', border: '1px solid var(--color-border)',
    borderRadius: 9, color: 'var(--color-text)', outline: 'none',
    fontSize: 12, padding: '8px 12px', width: '100%',
  } as React.CSSProperties;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* User detail slide-over */}
      {selectedUser && (
        <UserPanel key={selectedUser?.id} user={selectedUser} onClose={() => setSelectedUser(null)} onUpdate={handleUserUpdate} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(206,147,216,.12)', border: '1px solid rgba(206,147,216,.2)' }}>
              <i className="fa-solid fa-shield-halved" style={{ fontSize: 17, color: '#ce93d8' }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: SYNE, color: 'var(--color-text)' }}>Admin Panel</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>Oros — System Control</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: isConn ? '#00e676' : '#ffd740', padding: '4px 10px', borderRadius: 99, background: isConn ? 'rgba(0,230,118,.1)' : 'rgba(255,215,64,.1)', border: `1px solid ${isConn ? 'rgba(0,230,118,.2)' : 'rgba(255,215,64,.2)'}` }}>
              <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor', marginRight: 5 }} />
              {isConn ? 'SSE Live' : 'Disconnected'}
            </span>
            <ActionBtn label="Refresh Market" icon="fa-arrows-rotate" color="#00e676"
              onClick={() => refreshMarket.mutate()} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 3, padding: '4px', borderRadius: 12, background: 'rgba(var(--fg),.03)', border: '1px solid var(--color-border)', width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 150ms', fontFamily: SYNE, background: tab === t.key ? '#ce93d8' : 'transparent', color: tab === t.key ? 'var(--color-bg2)' : 'var(--color-muted)', boxShadow: tab === t.key ? '0 2px 12px rgba(206,147,216,.35)' : 'none' }}>
              <i className={`fa-solid ${t.icon}`} style={{ fontSize: 10 }} />{t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            {dashLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  <StatCard icon="fa-users" color="#40c4ff" label="Total Users" value={fmt(dash?.totalUsers)} sub={`+${fmt(dash?.newUsersToday)} today`} grad="linear-gradient(90deg,#40c4ff,transparent)" />
                  <StatCard icon="fa-user-plus" color="#00e676" label="New This Month" value={fmt(dash?.newUsersMonth)} sub={`vs ${fmt(dash?.newUsersLastMonth)} last month`} grad="linear-gradient(90deg,#00e676,transparent)" />
                  <StatCard icon="fa-receipt" color="#ffd740" label="Total Orders" value={fmt(dash?.totalOrders)} sub={`${fmt(dash?.ordersToday)} today`} grad="linear-gradient(90deg,#ffd740,transparent)" />
                  <StatCard icon="fa-crown" color="#ce93d8" label="Active Subs" value={fmt(dash?.activeSubscriptions)} grad="linear-gradient(90deg,#ce93d8,transparent)" />
                  <StatCard icon="fa-bell" color="#ff8a65" label="Active Alerts" value={fmt(dash?.totalAlerts)} grad="linear-gradient(90deg,#ff8a65,transparent)" />
                  <StatCard icon="fa-chart-line" color="#80deea" label="Live Securities" value={fmt(stocks.length)} sub="JSE stocks" grad="linear-gradient(90deg,#80deea,transparent)" />
                </div>

                {/* Growth chart */}
                {(growthData?.daily || dash?.growth) && (
                  <SectionCard title="User Growth" subtitle="Daily new signups">
                    <GrowthChart data={growthData?.daily ?? dash?.growth ?? []} />
                  </SectionCard>
                )}

                {/* Subscription breakdown */}
                {(dash?.subscriptionBreakdown ?? []).length > 0 && (
                  <SectionCard title="Subscription Breakdown">
                    <div style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {(dash?.subscriptionBreakdown ?? []).map(t => {
                        const c = TIER_COLORS[t.plan] || '#78909c';
                        return (
                          <div key={t.plan} style={{ padding: '12px 20px', borderRadius: 10, background: c + '10', border: `1px solid ${c}30`, textAlign: 'center', minWidth: 90 }}>
                            <p style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: MONO, color: c }}>{t._count.plan}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: c, opacity: .8 }}>{t.plan}</p>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                )}

                {/* Recent signups */}
                {(dash?.recentUsers ?? []).length > 0 && (
                  <SectionCard title="Recent Signups" subtitle="Last 10 registrations">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(var(--fg),.04)' }}>
                            {['Name', 'Email', 'Tier', 'KYC', 'Joined'].map((h, i) => (
                              <th key={h} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i > 0 ? 'right' : 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(dash?.recentUsers ?? []).map(u => (
                            <tr key={u.id} onClick={() => setSelectedUser(u)} style={{ borderBottom: '1px solid rgba(var(--fg),.025)', cursor: 'pointer' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),.02)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                              <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{u.name || 'Anonymous'}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--color-muted)' }}>{u.email}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}><TierBadge tier={u.subscriptionTier} /></td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}><Badge label={u.kycStatus} /></td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, fontFamily: MONO, color: 'var(--color-muted)' }}>{fmtDate(u.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}
              </>
            )}
          </>
        )}

        {/* ── USERS ─────────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <SectionCard title={`Users (${usersData?.total ?? 0})`} subtitle="Click any row to manage"
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-muted)' }} />
                  <input value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1); }} placeholder="Search..."
                    style={{ ...INPUT, width: 180, paddingLeft: 28, height: 32 }} />
                </div>
                <select value={userTierFilter} onChange={e => { setUserTierFilter(e.target.value); setUserPage(1); }}
                  style={{ ...INPUT, width: 110, height: 32, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">All Tiers</option>
                  {['FREE', 'CORE', 'PRO', 'ENTERPRISE'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={userKycFilter} onChange={e => { setUserKycFilter(e.target.value); setUserPage(1); }}
                  style={{ ...INPUT, width: 110, height: 32, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">All KYC</option>
                  {['NONE', 'PENDING', 'VERIFIED', 'REJECTED'].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(var(--fg),.04)' }}>
                    {['Name', 'Email', 'Tier', 'KYC', 'Status', 'Joined', 'Actions'].map((h, i) => (
                      <th key={h} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i === 0 || i === 6 ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!usersData?.users?.length ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>No users found</td></tr>
                  ) : usersData.users.map(u => (
                    <tr key={u.id} onClick={() => setSelectedUser(u)} style={{ borderBottom: '1px solid rgba(var(--fg),.025)', cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                      <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{u.name || 'Anonymous'}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, color: 'var(--color-muted)' }}>{u.email}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}><TierBadge tier={u.subscriptionTier} /></td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}><Badge label={u.kycStatus} /></td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}><Badge label={u.isActive ? 'Active' : 'Inactive'} /></td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontFamily: MONO, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <ActionBtn label={u.isActive ? 'Suspend' : 'Restore'} color={u.isActive ? '#ff5252' : '#00e676'} small
                            onClick={() => updateUser.mutate({ id: u.id, data: { isActive: !u.isActive } })} />
                          <ActionBtn label="Delete" color="#ff5252" icon="fa-trash" small
                            onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteUser.mutate(u.id); }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {(usersData?.pages ?? 0) > 1 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Page {userPage} of {usersData?.pages}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: userPage <= 1 ? 'not-allowed' : 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: userPage <= 1 ? 'var(--color-muted)' : 'var(--color-text)', opacity: userPage <= 1 ? .4 : 1 }}>← Prev</button>
                  <button disabled={userPage >= (usersData?.pages ?? 1)} onClick={() => setUserPage(p => p + 1)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: userPage >= (usersData?.pages ?? 1) ? 'not-allowed' : 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: userPage >= (usersData?.pages ?? 1) ? 'var(--color-muted)' : 'var(--color-text)', opacity: userPage >= (usersData?.pages ?? 1) ? .4 : 1 }}>Next →</button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── ORDERS ────────────────────────────────────────────────────────── */}
        {tab === 'orders' && (
          <SectionCard title={`Orders (${ordersData?.total ?? 0})`}
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={orderSymbol} onChange={e => { setOrderSymbol(e.target.value); setOrderPage(1); }} placeholder="Symbol..."
                  style={{ ...INPUT, width: 110, height: 32 }} />
                <select value={orderStatusFilter} onChange={e => { setOrderStatusFilter(e.target.value); setOrderPage(1); }}
                  style={{ ...INPUT, width: 130, height: 32, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">All Status</option>
                  {['PENDING', 'OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED', 'REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(var(--fg),.04)' }}>
                    {['Symbol', 'User', 'Side', 'Type', 'Qty', 'Price', 'Status', 'Time'].map((h, i) => (
                      <th key={h} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i === 0 || i === 1 ? 'left' : 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!(ordersData?.orders?.length) ? (
                    <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>No orders found</td></tr>
                  ) : ordersData.orders.map(o => {
                    const isBuy = o.side?.toLowerCase() === 'buy';
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(var(--fg),.025)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),.02)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                        <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, fontFamily: MONO, color: 'var(--color-text)' }}>{o.symbol}</td>
                        <td style={{ padding: '10px 16px', fontSize: 10, color: 'var(--color-muted)' }}>{o.user?.email || o.userId?.slice(0, 8) + '…'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isBuy ? '#00e676' : '#ff5252', background: isBuy ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)', padding: '2px 8px', borderRadius: 99 }}>{(o.side || '').toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, color: 'var(--color-text2)' }}>{o.orderType || '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontFamily: MONO }}>{o.quantity ?? '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontFamily: MONO, color: 'var(--color-muted)' }}>{o.limitPrice ? `$${Number(o.limitPrice).toFixed(2)}` : 'MKT'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}><Badge label={o.status} /></td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontFamily: MONO, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{fmtDate(o.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(ordersData?.pages ?? 0) > 1 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Page {orderPage} of {ordersData?.pages}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={orderPage <= 1} onClick={() => setOrderPage(p => p - 1)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', opacity: orderPage <= 1 ? .4 : 1 }}>← Prev</button>
                  <button disabled={orderPage >= (ordersData?.pages ?? 1)} onClick={() => setOrderPage(p => p + 1)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', opacity: orderPage >= (ordersData?.pages ?? 1) ? .4 : 1 }}>Next →</button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── SECURITY ──────────────────────────────────────────────────────── */}
        {tab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Block IP form */}
            <SectionCard title="Block IP Address" subtitle="Blocks all requests from this IP">
              <div style={{ padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>IP Address</p>
                  <input value={blockIpInput} onChange={e => setBlockIpInput(e.target.value)} placeholder="192.168.1.1"
                    style={INPUT} />
                </div>
                <div style={{ flex: 2, minWidth: 240 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Reason (optional)</p>
                  <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="e.g. Brute force, scraping..."
                    style={INPUT} />
                </div>
                <button onClick={() => blockIpInput && blockIP.mutate({ ip: blockIpInput, reason: blockReason })}
                  disabled={!blockIpInput || blockIP.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#ff5252', color: '#fff', opacity: (!blockIpInput || blockIP.isPending) ? .5 : 1, transition: 'opacity 150ms', whiteSpace: 'nowrap' }}>
                  {blockIP.isPending ? 'Blocking…' : 'Block IP'}
                </button>
              </div>
            </SectionCard>

            {/* Blocked IPs */}
            {(secEvents?.blockedIPs ?? []).length > 0 && (
              <SectionCard title={`Blocked IPs (${secEvents?.blockedIPs?.length ?? 0})`}>
                <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(secEvents?.blockedIPs ?? []).map(ip => (
                    <div key={ip} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,82,82,.08)', border: '1px solid rgba(255,82,82,.2)' }}>
                      <i className="fa-solid fa-ban" style={{ fontSize: 9, color: '#ff5252' }} />
                      <span style={{ fontSize: 11, fontFamily: MONO, color: '#ff5252' }}>{ip}</span>
                      <button onClick={() => unblockIP.mutate(ip)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#ff5252', opacity: .6, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Security events */}
            <SectionCard title="Security Event Log" subtitle={`Last ${secEvents?.events?.length ?? 0} events · auto-refreshes every 30s`}>
              {!(secEvents?.events?.length) ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>
                  <i className="fa-solid fa-shield-check" style={{ fontSize: 28, opacity: .2, display: 'block', marginBottom: 10 }} />
                  No security events logged yet
                </div>
              ) : (
                <div style={{ padding: '8px 0', maxHeight: 520, overflowY: 'auto' }}>
                  {(secEvents?.events ?? []).map(ev => {
                    const c = SEV_COLORS[ev.severity] || '#78909c';
                    return (
                      <div key={ev.id} style={{ padding: '10px 20px', borderBottom: '1px solid rgba(var(--fg),.025)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: c }}>{ev.type}</span>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: c + '15', color: c, fontWeight: 700 }}>{ev.severity}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text2)' }}>{ev.detail}</p>
                        </div>
                        <span style={{ fontSize: 9, fontFamily: MONO, color: 'var(--color-muted)', flexShrink: 0 }}>{fmtDate(ev.ts)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── HEALTH ────────────────────────────────────────────────────────── */}
        {tab === 'health' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {/* Memory card */}
              <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                {sysHealth?.memPct != null && <MemDonut pct={sysHealth.memPct} />}
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Memory</p>
                  <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, fontFamily: MONO, color: 'var(--color-text)' }}>
                    {sysHealth ? `${sysHealth.memUsedMb} / ${sysHealth.memTotalMb} MB` : '—'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--color-muted)' }}>Process heap usage</p>
                </div>
              </div>

              {/* Uptime */}
              <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(0,230,118,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <i className="fa-solid fa-clock" style={{ fontSize: 13, color: '#00e676' }} />
                </div>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: MONO, color: '#00e676' }}>{fmtUptime(sysHealth?.uptime)}</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Uptime</p>
                {sysHealth?.nodeVersion && <p style={{ margin: '4px 0 0', fontSize: 9, fontFamily: MONO, color: 'var(--color-muted)', opacity: .6 }}>Node {sysHealth.nodeVersion}</p>}
              </div>

              {/* DB latency */}
              <div style={{ background: 'var(--color-bg2)', border: `1px solid ${sysHealth?.dbStatus === 'ok' ? 'rgba(0,230,118,.15)' : 'rgba(255,82,82,.15)'}`, borderRadius: 14, padding: '20px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: sysHealth?.dbStatus === 'ok' ? 'rgba(0,230,118,.12)' : 'rgba(255,82,82,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <i className="fa-solid fa-database" style={{ fontSize: 13, color: sysHealth?.dbStatus === 'ok' ? '#00e676' : '#ff5252' }} />
                </div>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: MONO, color: sysHealth?.dbStatus === 'ok' ? '#00e676' : '#ff5252' }}>
                  {sysHealth?.dbLatencyMs != null ? `${sysHealth.dbLatencyMs}ms` : '—'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>DB Latency</p>
                <p style={{ margin: '2px 0 0', fontSize: 9, fontFamily: MONO, color: 'var(--color-muted)', opacity: .6 }}>{sysHealth?.dbStatus === 'ok' ? 'PostgreSQL connected' : 'Database unreachable'}</p>
              </div>
            </div>

            {/* Services */}
            {sysHealth?.services && (
              <SectionCard title="Service Configuration">
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(sysHealth.services).map(([name, status]) => {
                    const ok = status === true || status === 'ok' || status === 'connected';
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(var(--fg),.03)', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#00e676' : '#ff5252', display: 'block' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', textTransform: 'capitalize' }}>{name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: MONO, color: ok ? '#00e676' : '#ff5252' }}>
                          {typeof status === 'string' ? status : ok ? 'configured' : 'not set'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Live market snapshot */}
            <SectionCard title="Live Market Snapshot">
              <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px 32px' }}>
                {[
                  { label: 'Total Securities', value: stocks.length, color: 'var(--color-text)' },
                  { label: 'Gainers', value: stocks.filter(s => (s.pctChange ?? 0) > 0).length, color: '#00e676' },
                  { label: 'Losers', value: stocks.filter(s => (s.pctChange ?? 0) < 0).length, color: '#ff5252' },
                  { label: 'Unchanged', value: stocks.filter(s => (s.pctChange ?? 0) === 0).length, color: '#ffd740' },
                  { label: 'With Volume', value: stocks.filter(s => (s.volume ?? 0) > 0).length, color: '#40c4ff' },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: MONO, color: item.color }}>{item.value}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── BROADCAST ─────────────────────────────────────────────────────── */}
        {tab === 'broadcast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionCard title="Send Broadcast" subtitle="Announce to all users via in-app notification">
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Subject</p>
                  <input value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} placeholder="Announcement subject..."
                    style={INPUT} />
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>Message</p>
                  <textarea value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} placeholder="Write your message to all users..."
                    rows={5} style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <button onClick={() => { if (broadcastSubject && broadcastBody) sendBroadcast.mutate(); }}
                  disabled={!broadcastSubject || !broadcastBody || sendBroadcast.isPending}
                  style={{ alignSelf: 'flex-start', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#ce93d8', color: '#04060d', fontFamily: SYNE, opacity: (!broadcastSubject || !broadcastBody || sendBroadcast.isPending) ? .5 : 1, transition: 'opacity 150ms' }}>
                  {sendBroadcast.isPending ? 'Sending…' : sendBroadcast.isSuccess ? 'Sent ✓' : 'Send Broadcast'}
                </button>
              </div>
            </SectionCard>

            {(broadcastsData?.broadcasts ?? []).length > 0 && (
              <SectionCard title="Broadcast History">
                <div style={{ padding: '8px 0' }}>
                  {(broadcastsData?.broadcasts ?? []).map((b: Broadcast & { title?: string; message?: string }) => (
                    <div key={b.id} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(var(--fg),.025)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: SYNE }}>{b.title ?? b.subject}</span>
                        <span style={{ fontSize: 9, fontFamily: MONO, color: 'var(--color-muted)' }}>{fmtDate(b.sentAt)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.5 }}>{b.message ?? b.body}</p>
                      {b.recipientCount != null && (
                        <p style={{ margin: '6px 0 0', fontSize: 9, color: '#00e676', fontFamily: MONO }}>→ {b.recipientCount} recipients</p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── AUDIT LOG ─────────────────────────────────────────────────────── */}
        {tab === 'audit' && (
          <SectionCard title={`Audit Log (${auditData?.total ?? 0})`} subtitle="All user and admin actions">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(var(--fg),.04)' }}>
                    {['User', 'Action', 'IP', 'Details', 'Time'].map((h, i) => (
                      <th key={h} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', textAlign: i === 0 || i === 1 ? 'left' : 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!(auditData?.entries?.length) ? (
                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)' }}>No audit entries</td></tr>
                  ) : auditData.entries.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(var(--fg),.025)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(var(--fg),.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-muted)' }}>{a.user?.email || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, fontFamily: MONO, color: 'var(--color-text)' }}>{a.action}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontFamily: MONO, color: 'var(--color-muted)' }}>{a.ipAddress || '—'}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, color: 'var(--color-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.details ? JSON.stringify(a.details).slice(0, 60) + (JSON.stringify(a.details).length > 60 ? '…' : '') : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontFamily: MONO, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{fmtDate(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(auditData?.pages ?? 0) > 1 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Page {auditPage} of {auditData?.pages}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', opacity: auditPage <= 1 ? .4 : 1 }}>← Prev</button>
                  <button disabled={auditPage >= (auditData?.pages ?? 1)} onClick={() => setAuditPage(p => p + 1)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', opacity: auditPage >= (auditData?.pages ?? 1) ? .4 : 1 }}>Next →</button>
                </div>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </>
  );
}
