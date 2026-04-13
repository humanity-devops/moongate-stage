'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Campaign = {
  id: string;
  entityName: string;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
  deadline: string;
  status: string;
  item: { publicTitle: string; category: string; currency: string };
  event: { name: string; slug: string; startDate: string | null; city: string | null; country: string | null };
  tenant: { slug: string; name: string };
  _count: { contributions: number };
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}` };
}

function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const pct = Math.min(100, goal > 0 ? (raised / goal) * 100 : 0);
  return (
    <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CampaignCard({ c }: { c: Campaign }) {
  const pct = c.goalAmount > 0 ? Math.min(100, (Number(c.raisedAmount) / Number(c.goalAmount)) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <Link href={`/portal/campaigns/${c.id}`} className="block group">
      <div className="glass rounded-xl border border-white/[0.06] p-5 hover:border-indigo-500/30 transition-all duration-200 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3 flex-1">
          <div>
            <p className="text-white font-medium text-sm leading-snug group-hover:text-indigo-300 transition-colors">
              {c.entityName}
            </p>
            <p className="text-white/40 text-xs mt-0.5">{c.item.publicTitle}</p>
          </div>
          <span className="text-xs text-white/30 shrink-0">{daysLeft}d left</span>
        </div>

        <ProgressBar raised={Number(c.raisedAmount)} goal={Number(c.goalAmount)} />

        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-white font-semibold text-sm">
              {c.currency} {Number(c.raisedAmount).toLocaleString()}
            </span>
            <span className="text-white/30 text-xs ml-1">
              of {Number(c.goalAmount).toLocaleString()}
            </span>
          </div>
          <span className="text-white/30 text-xs">{pct.toFixed(0)}%</span>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-white/40 text-xs">{c.event.name}</span>
          <span className="text-white/30 text-xs">{c._count.contributions} backers</span>
        </div>
      </div>
    </Link>
  );
}

export default function PortalCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '24' });
      const res = await fetch(`${API_URL}/api/sponsor/campaigns?${params}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Campaigns</h1>
          <p className="text-white/40 text-sm">
            {total > 0 ? `${total} active campaigns` : 'Crowdfunding campaigns for live event sponsorships'}
          </p>
        </div>
        <Link
          href="/portal/campaigns/my"
          className="text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          My contributions
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass rounded-xl border border-white/[0.06] h-44 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass rounded-xl border border-white/[0.06] p-12 text-center max-w-lg">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <p className="text-white/50 text-sm mb-2">No campaigns available</p>
          <p className="text-white/30 text-xs mb-4">Check back soon — organizers are setting up campaigns for upcoming events.</p>
          <Link href="/portal/discover" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Discover events instead
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {campaigns.map(c => <CampaignCard key={c.id} c={c} />)}
        </div>
      )}

      {total > 24 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-white/30 text-sm">Page {page}</span>
          <button
            disabled={page * 24 >= total}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
