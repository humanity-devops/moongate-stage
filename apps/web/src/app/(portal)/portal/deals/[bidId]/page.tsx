'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Bid = {
  id: string;
  status: string;
  proposedBudget: number;
  currency: string;
  notes?: string;
  companyName: string;
  contactName: string;
  event: { id: string; name: string; slug: string; startDate?: string; city?: string; country?: string };
  item: {
    id: string; publicTitle: string; category: string; listPrice?: number; currency: string;
    shortDescription?: string;
    benefits: { label: string; value?: string; quantity?: number }[];
  };
  tenant: { slug: string; name: string };
  counterOffers: { id: string; offeredPrice: number; currency: string; message?: string; status: string; validUntil?: string; createdAt: string }[];
  messages: { id: string; authorType: string; authorName: string; content: string; createdAt: string }[];
  order: { id: string; status: string; total: number; currency: string } | null;
  dealMembers?: { id: string; userId: string; role: string; addedById?: string }[];
};

function getHeaders(json = false) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

const STATUS_STYLES: Record<string, string> = {
  submitted: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  under_review: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  countered: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  accepted: 'text-green-300 bg-green-500/10 border-green-500/30',
  rejected: 'text-red-300 bg-red-500/10 border-red-500/30',
  withdrawn: 'text-gray-400 bg-gray-800 border-gray-700',
};

export default function DealDetailPage() {
  const { bidId } = useParams() as { bidId: string };
  const router = useRouter();
  const [bid, setBid] = useState<Bid | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [members, setMembers] = useState<{ id: string; userId: string; role: string }[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('collaborator');
  const [addingMember, setAddingMember] = useState(false);

  function loadBid() {
    fetch(`${API_URL}/api/sponsor/bids/${bidId}`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setBid(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadMembers() {
    fetch(`${API_URL}/api/sponsor/deals/${bidId}/members`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setMembers(d.data ?? []))
      .catch(() => {});
  }

  async function addMember() {
    if (!newMemberEmail.trim()) return;
    setAddingMember(true);
    const res = await fetch(`${API_URL}/api/sponsor/deals/${bidId}/members`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ email: newMemberEmail, role: newMemberRole }),
    });
    if (res.ok) { setNewMemberEmail(''); loadMembers(); }
    setAddingMember(false);
  }

  async function removeMember(userId: string) {
    await fetch(`${API_URL}/api/sponsor/deals/${bidId}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    loadMembers();
  }

  useEffect(() => { loadBid(); loadMembers(); }, [bidId]);

  async function doAction(endpoint: string, label: string) {
    setActionMsg('');
    const res = await fetch(`${API_URL}/api/sponsor/bids/${bidId}/${endpoint}`, {
      method: 'POST',
      headers: getHeaders(true),
    });
    if (res.ok) {
      setActionMsg(`${label} successful`);
      loadBid();
    } else {
      const d = await res.json();
      setActionMsg(d.error ?? 'Failed');
    }
  }

  async function sendMessage() {
    if (!msg.trim()) return;
    setSendingMsg(true);
    const res = await fetch(`${API_URL}/api/sponsor/bids/${bidId}/messages`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ content: msg }),
    });
    if (res.ok) {
      setMsg('');
      loadBid();
    }
    setSendingMsg(false);
  }

  async function startPayment() {
    if (!bid?.order) return;
    const res = await fetch(`${API_URL}/api/sponsor/orders/${bid.order.id}/checkout`, {
      method: 'POST',
      headers: getHeaders(true),
    });
    const d = await res.json();
    if (d.data?.url) window.location.href = d.data.url;
    else setActionMsg(d.error ?? 'Checkout failed');
  }

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}
    </div>
  );

  if (!bid) return (
    <div className="p-8 text-red-400 text-sm">Bid not found</div>
  );

  const style = STATUS_STYLES[bid.status] ?? 'text-gray-400 bg-gray-800 border-gray-700';
  const pendingCounter = bid.counterOffers.find(c => c.status === 'pending');
  const canWithdraw = ['submitted', 'under_review', 'countered'].includes(bid.status);
  const needsPayment = bid.status === 'accepted' && bid.order && ['pending', 'payment_pending'].includes(bid.order.status);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <Link href="/portal/deals" className="text-xs text-white/30 hover:text-white/60 transition-colors">← Back to Deals</Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-white">{bid.item.publicTitle}</h1>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${style}`}>{bid.status.replace('_', ' ')}</span>
        </div>
        <p className="text-sm text-white/40">{bid.event.name} · {bid.tenant.name}</p>
        {(bid.event.city || bid.event.country) && (
          <p className="text-xs text-white/30 mt-0.5">{[bid.event.city, bid.event.country].filter(Boolean).join(', ')}</p>
        )}
      </div>

      {/* Payment CTA */}
      {needsPayment && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
          <div className="text-sm font-semibold text-green-300 mb-1">Deal accepted — ready to pay</div>
          <p className="text-xs text-green-300/60 mb-3">
            Total: {bid.order!.currency} {Number(bid.order!.total).toLocaleString()}
          </p>
          <button
            onClick={startPayment}
            className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Pay Now
          </button>
        </div>
      )}

      {/* Counter-offer action */}
      {pendingCounter && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
          <div className="text-sm font-semibold text-purple-300 mb-1">Counter-offer received</div>
          <p className="text-xs text-white/50 mb-1">
            Proposed: {pendingCounter.currency} {Number(pendingCounter.offeredPrice).toLocaleString()}
          </p>
          {pendingCounter.message && <p className="text-xs text-white/40 mb-3 italic">"{pendingCounter.message}"</p>}
          <div className="flex gap-3">
            <button
              onClick={() => doAction('accept-counter', 'Accept')}
              className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-300 text-xs rounded-lg hover:bg-green-500/30 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => doAction('reject-counter', 'Reject')}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="text-xs text-white/50">{actionMsg}</div>
      )}

      {/* Package details */}
      <div className="glass rounded-xl p-5 border border-white/[0.06] space-y-3">
        <h2 className="text-sm font-semibold text-white">Package Details</h2>
        {bid.item.shortDescription && <p className="text-xs text-white/50">{bid.item.shortDescription}</p>}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-white/30 uppercase tracking-wider font-mono text-[10px]">Your bid</span>
            <div className="text-white mt-0.5">{bid.currency} {Number(bid.proposedBudget).toLocaleString()}</div>
          </div>
          {bid.item.listPrice && (
            <div>
              <span className="text-white/30 uppercase tracking-wider font-mono text-[10px]">List price</span>
              <div className="text-white mt-0.5">{bid.item.currency} {Number(bid.item.listPrice).toLocaleString()}</div>
            </div>
          )}
        </div>
        {bid.item.benefits.length > 0 && (
          <ul className="space-y-1 pt-2 border-t border-white/[0.06]">
            {bid.item.benefits.map((b, i) => (
              <li key={i} className="text-xs text-white/50 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                {b.label}{b.value ? `: ${b.value}` : ''}{b.quantity ? ` (×${b.quantity})` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Message thread */}
      <div className="glass rounded-xl p-5 border border-white/[0.06]">
        <h2 className="text-sm font-semibold text-white mb-4">Messages</h2>
        {bid.messages.length === 0 ? (
          <p className="text-xs text-white/30 mb-4">No messages yet</p>
        ) : (
          <div className="space-y-3 mb-4">
            {bid.messages.map(m => (
              <div key={m.id} className={`flex ${m.authorType === 'sponsor' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-xs ${
                  m.authorType === 'sponsor'
                    ? 'bg-indigo-600/20 border border-indigo-500/20 text-white'
                    : 'bg-white/[0.06] border border-white/[0.06] text-white/70'
                }`}>
                  <div className="text-[10px] text-white/30 mb-1">{m.authorName} · {new Date(m.createdAt).toLocaleString()}</div>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type a message..."
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={sendMessage}
            disabled={sendingMsg || !msg.trim()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Deal Team */}
      <div className="glass rounded-xl p-5 border border-white/[0.06]">
        <h2 className="text-sm font-semibold text-white mb-4">Deal Team</h2>
        {members.length === 0 ? (
          <p className="text-xs text-white/30 mb-4">Only you on this deal</p>
        ) : (
          <div className="space-y-2 mb-4">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-white/70">{m.userId}</span>
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded border ${
                    m.role === 'owner' ? 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10' :
                    m.role === 'collaborator' ? 'text-blue-300 border-blue-500/30 bg-blue-500/10' :
                    'text-white/40 border-white/10 bg-white/[0.04]'
                  }`}>{m.role}</span>
                </div>
                <button
                  onClick={() => removeMember(m.userId)}
                  className="text-xs text-red-400/50 hover:text-red-400 transition-colors"
                >Remove</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-3 border-t border-white/[0.06]">
          <input
            value={newMemberEmail}
            onChange={e => setNewMemberEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
          />
          <select
            value={newMemberRole}
            onChange={e => setNewMemberRole(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
          >
            <option value="collaborator">Collaborator</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={addMember}
            disabled={addingMember || !newMemberEmail.trim()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      {canWithdraw && (
        <div className="flex justify-end">
          <button
            onClick={() => { if (confirm('Withdraw this bid?')) doAction('withdraw', 'Withdraw'); }}
            className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
          >
            Withdraw bid
          </button>
        </div>
      )}
    </div>
  );
}
