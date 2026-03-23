import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminDashboard, getUsers, updateUser, getKycSubmissions, approveKyc, rejectKyc } from '@/api/admin';
import { useAuth } from '@/context/AuthContext';
import { fmtInt, fmtJMD, fmtDate, fmtDateTime } from '@/utils/formatters';
import { SkeletonCard, SkeletonTable } from '@/components/common/LoadingSpinner';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'users' | 'kyc';

export default function Admin() {
  const { isAdmin, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    enabled: isAuthenticated && isAdmin,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: isAuthenticated && isAdmin && tab === 'users',
  });

  const { data: kycSubmissions = [], isLoading: kycLoading } = useQuery({
    queryKey: ['admin-kyc'],
    queryFn: getKycSubmissions,
    enabled: isAuthenticated && isAdmin && tab === 'kyc',
  });

  const toggleUserMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUser(id, { isActive }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated'); },
    onError: () => toast.error('Failed to update user'),
  });

  const approveMut = useMutation({
    mutationFn: approveKyc,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-kyc'] }); toast.success('KYC approved'); },
    onError: () => toast.error('Approval failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectKyc(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-kyc'] }); setRejectingId(null); setRejectReason(''); toast.success('KYC rejected'); },
    onError: () => toast.error('Rejection failed'),
  });

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <i className="fas fa-shield-alt text-4xl text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Admin Panel</h2>
        <p className="text-sm text-text-secondary">You don't have admin access.</p>
      </div>
    );
  }

  const filteredUsers = userSearch
    ? users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1">
        {(['overview', 'users', 'kyc'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'bg-gf-green/20 text-gf-green' : 'bg-white/5 text-text-muted hover:text-text-secondary'
            }`}
          >
            {t === 'kyc' ? 'KYC Review' : t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {dashLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Users" value={fmtInt(dashboard.totalUsers)} icon="fa-users" color="text-gf-blue" />
                <StatCard label="Active Users" value={fmtInt(dashboard.activeUsers)} icon="fa-user-check" color="text-gf-green" />
                <StatCard label="Total Orders" value={fmtInt(dashboard.totalOrders)} icon="fa-receipt" color="text-gf-gold" />
                <StatCard label="Pending KYC" value={fmtInt(dashboard.pendingKyc)} icon="fa-id-card" color="text-gf-purple" />
              </div>

              {/* Recent Signups */}
              {dashboard.recentSignups && dashboard.recentSignups.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Recent Signups</h3>
                  <div className="space-y-2">
                    {dashboard.recentSignups.slice(0, 5).map(u => (
                      <div key={u.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gf-green/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-gf-green">{u.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-text-primary">{u.name}</p>
                            <p className="text-[10px] text-text-muted">{u.email}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-text-muted">{fmtDate(u.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-12 text-center text-text-muted text-xs">No dashboard data</div>
          )}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Users ({filteredUsers.length})</h3>
            <div className="relative">
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
              <input
                type="text" placeholder="Search..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:border-gf-green/50 focus:outline-none w-48"
              />
            </div>
          </div>
          {usersLoading ? <SkeletonTable rows={5} /> : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-white/5">
                    <th className="py-2 px-3 text-left">Name</th>
                    <th className="py-2 px-3 text-left">Email</th>
                    <th className="py-2 px-3 text-center">KYC</th>
                    <th className="py-2 px-3 text-center">2FA</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-left hidden md:table-cell">Joined</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-white/[0.02] hover:bg-white/[0.03]">
                      <td className="py-2.5 px-3 font-semibold text-text-primary">{u.name}</td>
                      <td className="py-2.5 px-3 text-text-secondary">{u.email}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          u.kycStatus === 'VERIFIED' ? 'bg-gf-green/10 text-gf-green' :
                          u.kycStatus === 'PENDING' ? 'bg-gf-gold/10 text-gf-gold' :
                          'bg-white/5 text-text-muted'
                        }`}>{u.kycStatus}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {u.twoFactorEnabled ? <i className="fas fa-check text-gf-green text-[10px]" /> : <i className="fas fa-times text-text-muted text-[10px]" />}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${u.isActive ? 'bg-gf-green/10 text-gf-green' : 'bg-red-500/10 text-red-400'}`}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-text-muted hidden md:table-cell">{fmtDate(u.createdAt)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => toggleUserMut.mutate({ id: u.id, isActive: !u.isActive })}
                          className={`px-2 py-1 rounded text-[10px] font-semibold ${u.isActive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-gf-green/10 text-gf-green hover:bg-gf-green/20'}`}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* KYC */}
      {tab === 'kyc' && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">KYC Submissions</h3>
          {kycLoading ? <SkeletonTable rows={5} /> : kycSubmissions.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs">
              <i className="fas fa-id-card text-2xl mb-3 block" />No pending KYC submissions
            </div>
          ) : (
            <div className="space-y-3">
              {kycSubmissions.map(kyc => (
                <div key={kyc.id} className="bg-white/[0.03] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-text-primary">{kyc.user?.name || 'Unknown User'}</p>
                      <p className="text-[10px] text-text-muted">{kyc.user?.email} — Submitted {fmtDateTime(kyc.submittedAt)}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      kyc.status === 'VERIFIED' ? 'bg-gf-green/10 text-gf-green' :
                      kyc.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                      'bg-gf-gold/10 text-gf-gold'
                    }`}>{kyc.status}</span>
                  </div>
                  {kyc.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => approveMut.mutate(kyc.userId)} disabled={approveMut.isPending} className="px-4 py-2 rounded-lg bg-gf-green text-bg text-xs font-semibold hover:bg-gf-green/90 disabled:opacity-50">
                        Approve
                      </button>
                      {rejectingId === kyc.userId ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text" placeholder="Rejection reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-text-primary focus:outline-none"
                          />
                          <button
                            onClick={() => rejectMut.mutate({ id: kyc.userId, reason: rejectReason })}
                            disabled={!rejectReason.trim()}
                            className="px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold disabled:opacity-50"
                          >Reject</button>
                          <button onClick={() => setRejectingId(null)} className="px-3 py-2 rounded-lg bg-white/5 text-text-muted text-xs">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setRejectingId(kyc.userId)} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20">
                          Reject
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-current/10 flex items-center justify-center`}>
          <i className={`fas ${icon} ${color} text-sm`} />
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-text-primary font-num">{value}</p>
        </div>
      </div>
    </div>
  );
}
