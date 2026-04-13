'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Proposal = {
  id: string;
  contactName: string;
  contactEmail: string;
  companyName: string;
  totalBudget: string;
  currency: string;
  status: string;
  notes?: string;
  createdAt: string;
  event: { name: string; slug: string };
  items: { id: string; label: string; quantity: number; unitPrice: string }[];
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'text-white/40 bg-white/[0.05] border-white/10',
  submitted: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  under_review: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  accepted: 'text-green-300 bg-green-500/10 border-green-500/20',
  rejected: 'text-red-300 bg-red-500/10 border-red-500/20',
};

const STATUS_TABS = ['', 'submitted', 'under_review', 'accepted', 'rejected'];

export default function ProposalsPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('submitted');
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;

  const loadProposals = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab) params.set('status', activeTab);
      params.set('pageSize', '50');

      const res = await fetch(`${API_URL}/api/organizer/proposals?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
      });
      if (!res.ok) { if (res.status === 401) router.push('/auth/login'); return; }
      const json = await res.json();
      setProposals(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug, activeTab, router]);

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    loadProposals();
  }, [loadProposals, token, router]);

  async function review(status: 'accepted' | 'rejected' | 'under_review') {
    if (!token || !selected) return;
    setReviewing(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/proposals/${selected.id}/review`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectedReason: rejectionReason || undefined }),
      });
      if (res.ok) {
        setSelected(null);
        setRejectionReason('');
        loadProposals();
      }
    } finally {
      setReviewing(false);
    }
  }

  const fmtUSD = (v: string | number) =>
    parseFloat(String(v)).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen" style={{ background: '#06060a', color: 'white' }}>
      <nav className="border-b px-6 py-3 flex items-center gap-4" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0d0d14' }}>
        <Link href={`/admin/${tenantSlug}/events`} className="text-sm text-white/40 hover:text-white transition-colors">← Dashboard</Link>
        <span className="text-white/10">|</span>
        <h1 className="text-sm font-semibold text-white">Sponsorship Proposals</h1>
        <span className="text-xs text-white/30 ml-auto">{total} total</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Status tabs */}
        <div className="flex gap-1 mb-6">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize border transition-all ${
                activeTab === s
                  ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                  : 'border-white/10 text-white/40 hover:text-white/70'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="glass rounded-xl h-20 animate-pulse" />)}
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/30 text-sm">No proposals with status &quot;{activeTab || 'any'}&quot;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="glass rounded-xl p-5 w-full text-left hover:border-indigo-500/20 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{p.companyName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[p.status] ?? ''}`}>{p.status}</span>
                    </div>
                    <p className="text-sm text-white/50">{p.contactName} · {p.contactEmail}</p>
                    <p className="text-xs text-white/30 mt-1">{p.event.name} · {p.items.length} items</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-indigo-300 font-mono">{fmtUSD(p.totalBudget)}</div>
                    <div className="text-xs text-white/30 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glass rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">{selected.companyName}</h2>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white text-xl">×</button>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-white/60">{selected.contactName} · {selected.contactEmail}</p>
              <p className="text-white/40 text-xs">{selected.event.name}</p>
              {selected.notes && <p className="text-white/50 italic text-xs mt-2">{selected.notes}</p>}
            </div>

            {/* Items */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Package ({selected.items.length} items)</p>
              <div className="space-y-2">
                {selected.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-white/70">{item.label} {item.quantity > 1 && <span className="text-white/30">×{item.quantity}</span>}</span>
                    <span className="font-mono text-white">{fmtUSD(parseFloat(String(item.unitPrice)) * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/[0.06]">
                  <span className="text-white">Total</span>
                  <span className="text-indigo-300 font-mono">{fmtUSD(selected.totalBudget)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {(selected.status === 'submitted' || selected.status === 'under_review') && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wide">Rejection reason (if rejecting)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    rows={2}
                    placeholder="Optional: explain why the proposal doesn't fit..."
                    className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/40 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  {selected.status === 'submitted' && (
                    <button
                      onClick={() => review('under_review')}
                      disabled={reviewing}
                      className="flex-1 py-2 rounded-lg text-sm border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-40"
                    >
                      Mark under review
                    </button>
                  )}
                  <button
                    onClick={() => review('rejected')}
                    disabled={reviewing}
                    className="flex-1 py-2 rounded-lg text-sm border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => review('accepted')}
                    disabled={reviewing}
                    className="flex-1 py-2 rounded-lg text-sm border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-all disabled:opacity-40"
                  >
                    Accept
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
