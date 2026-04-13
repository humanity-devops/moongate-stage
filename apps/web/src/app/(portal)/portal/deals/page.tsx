'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Bid = {
  id: string;
  status: string;
  proposedBudget: number;
  currency: string;
  event: { name: string; slug: string; startDate?: string };
  item: { publicTitle: string; category: string };
  tenant: { slug: string; name: string };
  counterOffers: { offeredPrice: number; currency: string; status: string }[];
  order: { id: string; status: string } | null;
  createdAt: string;
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}` };
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

const FILTERS = ['all', 'active', 'countered', 'accepted', 'closed'];

export default function PortalDealsPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/bids`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setBids(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = bids.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['submitted', 'under_review'].includes(b.status);
    if (filter === 'countered') return b.status === 'countered';
    if (filter === 'accepted') return b.status === 'accepted';
    if (filter === 'closed') return ['rejected', 'withdrawn', 'expired'].includes(b.status);
    return true;
  });

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">Deals</h1>
      <p className="text-white/40 text-sm mb-6">Track your sponsorship bids and negotiations</p>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors capitalize ${
              filter === f
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                : 'text-white/40 hover:text-white/60 border border-white/[0.06]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center border border-white/[0.06]">
          <p className="text-white/40 text-sm mb-4">No deals found</p>
          <Link href="/portal/discover" className="text-indigo-400 hover:text-indigo-300 text-sm">Find opportunities →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(bid => {
            const style = STATUS_STYLES[bid.status] ?? 'text-gray-400 bg-gray-800 border-gray-700';
            const latestCounter = bid.counterOffers[0];
            return (
              <Link
                key={bid.id}
                href={`/portal/deals/${bid.id}`}
                className="glass rounded-xl px-5 py-4 flex items-center gap-4 group hover:bg-white/[0.04] transition-colors border border-white/[0.04]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm text-white font-medium group-hover:text-indigo-300 transition-colors truncate">
                      {bid.item.publicTitle}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${style}`}>
                      {bid.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-white/40">{bid.event.name} · {bid.tenant.name}</div>
                </div>
                <div className="text-right shrink-0">
                  {latestCounter && latestCounter.status === 'pending' ? (
                    <div>
                      <div className="text-xs text-purple-400">Counter: {bid.currency} {Number(latestCounter.offeredPrice).toLocaleString()}</div>
                      <div className="text-[10px] text-white/30">Action required</div>
                    </div>
                  ) : (
                    <div className="text-xs text-white/40">
                      {bid.currency} {Number(bid.proposedBudget).toLocaleString()}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
