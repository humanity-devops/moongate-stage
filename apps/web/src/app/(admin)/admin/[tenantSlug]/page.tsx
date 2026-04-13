'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type DashData = {
  kpis: {
    activeEvents: number; draftEvents: number;
    pendingProposals: number; pendingApprovals: number; kycPending: number;
    weeklyAnalytics: number; weeklySignups: number;
    invitesSent: number; invitesAccepted: number;
  };
  revenue: {
    paidOrdersTotal: number;
    merchantNetTotal: number;
    pendingOrdersTotal: number;
  };
  urgentQueue: { type: string; label: string; href: string }[];
  recentBids: { id: string; companyName: string; proposedBudget: string; currency: string; createdAt: string }[];
  recentActivity: { id: string; type: string; title: string; createdAt: string }[];
  weeklyTrend: { date: string; count: number }[];
  lastUpdated: string;
};

function KPICard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="text-xs text-gray-400 mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${color ?? 'text-white'}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    fetch(`${API_URL}/api/organizer/dashboard`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => setData(j.data))
      .catch(e => { if (e === 401 || e === 403) router.push('/auth/login'); else setError('Failed to load dashboard'); })
      .finally(() => setLoading(false));
  }, [tenantSlug, router]);

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/[0.03] animate-pulse rounded-xl" />)}
    </div>
  );
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>;
  if (!data) return null;

  const { kpis, revenue, urgentQueue, recentBids, recentActivity, weeklyTrend, lastUpdated } = data;
  const maxTrend = Math.max(...weeklyTrend.map(d => d.count), 1);
  const base = `/admin/${tenantSlug}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Overview of your organization</p>
        </div>
        {lastUpdated && (
          <span className="text-[10px] text-gray-600 mt-1">
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard label="Active Events" value={kpis.activeEvents} sub={`${kpis.draftEvents} draft`} />
        <KPICard label="Pending Proposals" value={kpis.pendingProposals} color={kpis.pendingProposals > 0 ? 'text-amber-400' : 'text-white'} />
        <KPICard label="Approval Queue" value={kpis.pendingApprovals} color={kpis.pendingApprovals > 0 ? 'text-orange-400' : 'text-white'} />
        <KPICard label="KYC Pending" value={kpis.kycPending} color={kpis.kycPending > 0 ? 'text-yellow-400' : 'text-white'} />
        <KPICard label="Weekly Visitors" value={kpis.weeklyAnalytics} />
      </div>

      {/* Revenue row */}
      {revenue && (
        <div className="grid grid-cols-3 gap-3">
          <KPICard
            label="Revenue (paid)"
            value={`$${revenue.paidOrdersTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color="text-green-400"
          />
          <KPICard
            label="Merchant Net"
            value={`$${revenue.merchantNetTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color="text-emerald-400"
          />
          <KPICard
            label="Pending"
            value={`$${revenue.pendingOrdersTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color={revenue.pendingOrdersTotal > 0 ? 'text-amber-400' : 'text-white'}
          />
        </div>
      )}

      {/* Growth + Urgent row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Growth */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Growth</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-300">Invites sent</span>
              <span className="text-sm font-bold text-white">{kpis.invitesSent}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-300">Invites accepted</span>
              <span className="text-sm font-bold text-green-400">{kpis.invitesAccepted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-300">New signups (7d)</span>
              <span className="text-sm font-bold text-indigo-400">{kpis.weeklySignups}</span>
            </div>
          </div>
        </div>

        {/* Urgent queue */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Needs Attention</h2>
          {urgentQueue.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <span>✓</span> All caught up — no urgent items
            </div>
          ) : (
            <div className="space-y-2">
              {urgentQueue.map(item => (
                <Link key={item.type} href={`${base}/${item.href}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors group">
                  <span className="text-sm text-amber-300">{item.label}</span>
                  <span className="text-xs text-amber-400/60 group-hover:text-amber-400 transition-colors">Review →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trend + Activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly trend */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Visitor Activity (7d)</h2>
          {weeklyTrend.length === 0 ? (
            <div className="text-sm text-gray-500">No visitor data this week</div>
          ) : (
            <div className="flex items-end gap-1 h-20">
              {weeklyTrend.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-indigo-600 rounded-sm hover:bg-indigo-500 transition-colors"
                    style={{ height: `${Math.max(4, (d.count / maxTrend) * 64)}px` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <div className="text-[9px] text-gray-600">{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <div className="text-sm text-gray-500">No activity this week</div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map(a => (
                <div key={a.id} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-300 truncate">{a.title}</div>
                    <div className="text-[10px] text-gray-600">{new Date(a.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent bids */}
      {recentBids.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Recent Bids (7d)</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2">Company</th>
                <th className="text-right pb-2">Budget</th>
                <th className="text-right pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentBids.map(b => (
                <tr key={b.id}>
                  <td className="py-2 text-gray-300">{b.companyName}</td>
                  <td className="py-2 text-right text-white font-mono">{b.currency} {Number(b.proposedBudget).toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
