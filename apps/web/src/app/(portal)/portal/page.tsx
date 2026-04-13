'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Bid = {
  id: string;
  status: string;
  event: { name: string; slug: string };
  item: { publicTitle: string };
  tenant: { slug: string };
  counterOffers: { offeredPrice: number; currency: string }[];
  order: { id: string; status: string } | null;
};

type Kpis = {
  activeBids: number;
  pendingActions: number;
  totalSpend: number;
  savedCount: number;
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const STATUS_STYLES: Record<string, string> = {
  submitted: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  under_review: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  countered: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  accepted: 'text-green-300 bg-green-500/10 border-green-500/30',
  rejected: 'text-red-300 bg-red-500/10 border-red-500/30',
  withdrawn: 'text-gray-400 bg-gray-800 border-gray-700',
  expired: 'text-gray-400 bg-gray-800 border-gray-700',
};

export default function PortalDashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [recentBids, setRecentBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/dashboard`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => {
        setKpis(d.data?.kpis ?? null);
        setRecentBids(d.data?.recentBids ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-white/40 text-sm mb-8">Your sponsorship activity at a glance</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Active Deals', value: kpis?.activeBids ?? '—' },
          { label: 'Needs Action', value: kpis?.pendingActions ?? '—' },
          { label: 'Total Spend', value: kpis ? `$${kpis.totalSpend.toLocaleString()}` : '—' },
          { label: 'Saved', value: kpis?.savedCount ?? '—' },
        ].map(k => (
          <div key={k.label} className="glass rounded-xl p-5 border border-white/[0.06]">
            <div className="text-xs text-white/30 uppercase tracking-widest mb-2 font-mono">{k.label}</div>
            <div className="text-2xl font-bold text-white">{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      {/* Recent bids */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Recent Deals</h2>
          <Link href="/portal/deals" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}
          </div>
        ) : recentBids.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center border border-white/[0.06]">
            <p className="text-white/40 text-sm mb-4">No deals yet</p>
            <Link href="/portal/discover" className="text-indigo-400 hover:text-indigo-300 text-sm">
              Browse sponsorship opportunities →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentBids.map(bid => {
              const style = STATUS_STYLES[bid.status] ?? 'text-gray-400 bg-gray-800 border-gray-700';
              return (
                <Link
                  key={bid.id}
                  href={`/portal/deals/${bid.id}`}
                  className="glass rounded-xl px-5 py-4 flex items-center justify-between group hover:bg-white/[0.04] transition-colors border border-white/[0.04]"
                >
                  <div>
                    <div className="text-sm text-white font-medium group-hover:text-indigo-300 transition-colors">
                      {bid.item.publicTitle}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{bid.event.name}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${style}`}>
                    {bid.status.replace('_', ' ')}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
