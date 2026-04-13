'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { organizerApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { BidStatusBadge } from '@/components/admin/BidStatusBadge';
import { BidKanban } from '@/components/admin/BidKanban';

type Bid = {
  id: string;
  status: string;
  companyName: string;
  contactName: string;
  email: string;
  proposedBudget: number;
  currency: string;
  notes?: string;
  internalNotes?: string;
  createdAt: string;
  item: { publicTitle: string; slug: string; category: string; listPrice?: number };
  assignedTo?: { name: string; email: string };
  _count?: { attachments: number; messages: number };
};

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'New' },
  { key: 'under_review', label: 'Reviewing' },
  { key: 'countered', label: 'Countered' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

export default function BidsPage() {
  const { tenantSlug, eventId } = useParams() as { tenantSlug: string; eventId: string };
  const router = useRouter();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMsg, setCounterMsg] = useState('');
  const [showCounterModal, setShowCounterModal] = useState(false);

  const loadBids = useCallback(async () => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    try {
      const res = await organizerApi.getBids(eventId, token, tenantSlug, activeStatus || undefined);
      setBids(res.data as Bid[]);
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [eventId, tenantSlug, activeStatus, router]);

  useEffect(() => { loadBids(); }, [loadBids]);

  async function handleAction(bidId: string, action: 'accept' | 'reject') {
    const token = localStorage.getItem('moongate_token');
    if (!token) return;
    setActionLoading(bidId + action);
    try {
      if (action === 'accept') {
        await organizerApi.acceptBid(eventId, bidId, token, tenantSlug);
      } else {
        await organizerApi.rejectBid(eventId, bidId, token, tenantSlug);
      }
      await loadBids();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCounter() {
    const token = localStorage.getItem('moongate_token');
    if (!token || !selectedBid) return;
    setActionLoading(selectedBid.id + 'counter');
    try {
      await organizerApi.counterBid(
        eventId,
        selectedBid.id,
        { offeredPrice: parseFloat(counterAmount), currency: selectedBid.currency, message: counterMsg },
        token,
        tenantSlug,
      );
      setShowCounterModal(false);
      setCounterAmount('');
      setCounterMsg('');
      setSelectedBid(null);
      await loadBids();
    } finally {
      setActionLoading(null);
    }
  }

  const pipelineValue = bids
    .filter(b => ['submitted', 'under_review', 'countered'].includes(b.status))
    .reduce((sum, b) => sum + Number(b.proposedBudget), 0);

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading bids...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <nav className="text-sm text-gray-500 mb-2">
              <Link href={`/admin/${tenantSlug}/events`} className="hover:text-white">Events</Link>
              <span className="mx-2">›</span>
              <Link href={`/admin/${tenantSlug}/events/${eventId}`} className="hover:text-white">Dashboard</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Bids</span>
            </nav>
            <h1 className="text-3xl font-bold text-white">Private Bids</h1>
            <p className="text-gray-400 mt-1">
              {bids.length} bid{bids.length !== 1 ? 's' : ''} · Pipeline: {formatCurrency(pipelineValue)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'kanban' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              Kanban
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 mb-6 w-fit">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeStatus === tab.key ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {tab.label}
              {tab.key === 'submitted' && (
                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {bids.filter(b => b.status === 'submitted').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {viewMode === 'kanban' ? (
          <BidKanban bids={bids} onAction={handleAction} />
        ) : (
          <div className="space-y-3">
            {bids.length === 0 ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
                <div className="text-4xl mb-4">💼</div>
                <h3 className="text-white font-semibold mb-2">No bids yet</h3>
                <p className="text-gray-400 text-sm">Private offers from sponsors will appear here.</p>
              </div>
            ) : (
              bids.map(bid => (
                <div key={bid.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex items-start gap-4">
                  {/* Status */}
                  <BidStatusBadge status={bid.status} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-white">{bid.companyName}</h3>
                      <span className="text-gray-500 text-sm">·</span>
                      <span className="text-gray-400 text-sm">{bid.contactName}</span>
                      <span className="text-gray-500 text-sm">·</span>
                      <span className="text-gray-500 text-xs">{bid.email}</span>
                    </div>
                    <p className="text-brand-400 text-sm font-medium">{bid.item?.publicTitle}</p>
                    {bid.notes && (
                      <p className="text-gray-400 text-sm mt-2 line-clamp-2">{bid.notes}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{new Date(bid.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {bid._count && bid._count.attachments > 0 && <span>📎 {bid._count.attachments}</span>}
                      {bid._count && bid._count.messages > 0 && <span>💬 {bid._count.messages}</span>}
                      {bid.assignedTo && <span>Assigned: {bid.assignedTo.name}</span>}
                    </div>
                  </div>

                  {/* Offer amount */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(Number(bid.proposedBudget), bid.currency)}
                    </div>
                    {bid.item?.listPrice && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Listed: {formatCurrency(Number(bid.item.listPrice), bid.currency)}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {['submitted', 'under_review', 'countered'].includes(bid.status) && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAction(bid.id, 'accept')}
                        disabled={!!actionLoading}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => { setSelectedBid(bid); setShowCounterModal(true); }}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Counter
                      </button>
                      <button
                        onClick={() => handleAction(bid.id, 'reject')}
                        disabled={!!actionLoading}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Counter offer modal */}
      {showCounterModal && selectedBid && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Counter Offer</h3>
            <p className="text-gray-400 text-sm mb-4">
              Responding to {selectedBid.companyName}&apos;s offer of {formatCurrency(Number(selectedBid.proposedBudget), selectedBid.currency)}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Offer ({selectedBid.currency})</label>
                <input
                  value={counterAmount}
                  onChange={e => setCounterAmount(e.target.value)}
                  type="number"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500"
                  placeholder="Enter counter amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Message (optional)</label>
                <textarea
                  value={counterMsg}
                  onChange={e => setCounterMsg(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 resize-none"
                  placeholder="Add a message to your counter offer..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCounterModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCounter}
                disabled={!counterAmount || !!actionLoading}
                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Send Counter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
