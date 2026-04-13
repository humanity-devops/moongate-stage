'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Campaign = {
  id: string;
  entityName: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
  deadline?: string;
  createdAt: string;
  approvalStatus: string;
  event?: { id: string; title: string };
  item?: { id: string; label: string };
};

type Tab = 'pending' | 'approved' | 'rejected';
type Decision = 'approved' | 'rejected' | 'needs_changes';

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function ApprovalsPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('pending');
  const [counts, setCounts] = useState<Record<Tab, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Campaign | null>(null);

  // Drawer action state
  const [action, setAction] = useState<Decision | null>(null);
  const [reason, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchTab = useCallback(async (t: Tab) => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/approvals?approvalStatus=${t}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
      });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const items: Campaign[] = json.data ?? [];
      setCampaigns(items);
      setCounts(prev => ({ ...prev, [t]: items.length }));
    } catch {
      setError('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, router]);

  useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  function openDrawer(c: Campaign) {
    setSelected(c);
    setAction(null);
    setReasonText('');
    setReasonError('');
    setConfirming(false);
  }

  function closeDrawer() {
    setSelected(null);
    setAction(null);
    setReasonText('');
    setReasonError('');
    setConfirming(false);
  }

  function handleActionClick(d: Decision) {
    setAction(d);
    setReasonText('');
    setReasonError('');
    setConfirming(false);
  }

  function handleConfirmStep() {
    if ((action === 'rejected' || action === 'needs_changes') && !reason.trim()) {
      setReasonError('A reason is required.');
      return;
    }
    setReasonError('');
    setConfirming(true);
  }

  async function handleSubmit() {
    if (!selected || !action) return;
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    setSubmitting(true);
    try {
      const body: Record<string, string> = { decision: action };
      if (reason.trim()) body.reason = reason.trim();
      const res = await fetch(`${API_URL}/api/organizer/approvals/${selected.id}/decide`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': tenantSlug,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      closeDrawer();
      fetchTab(tab);
    } catch {
      setError('Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-800" style={{ background: '#0a0a12' }}>
          <h1 className="text-xl font-bold text-white mb-1">Community Funding Approvals</h1>
          <p className="text-xs text-gray-400">Review and approve community funding campaigns</p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {TAB_LABELS.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelected(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tab === t.key
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {t.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-indigo-500/30 text-indigo-200' : 'bg-white/[0.06] text-gray-500'
                }`}>{counts[t.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-white/[0.03] animate-pulse rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <div className="text-4xl mb-3">🗳</div>
              <div className="text-sm">No {tab} campaigns</div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500">
                    <th className="text-left px-4 py-3">Entity Name</th>
                    <th className="text-left px-3 py-3">Event</th>
                    <th className="text-left px-3 py-3">Item</th>
                    <th className="text-right px-3 py-3">Goal</th>
                    <th className="text-right px-3 py-3">Raised</th>
                    <th className="text-left px-3 py-3">Deadline</th>
                    <th className="text-left px-3 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {campaigns.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => openDrawer(c)}
                      className={`cursor-pointer transition-colors ${
                        selected?.id === c.id ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-white">{c.entityName}</td>
                      <td className="px-3 py-3 text-gray-400">{c.event?.title ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-400">{c.item?.label ?? '—'}</td>
                      <td className="px-3 py-3 text-right text-white font-mono">
                        {c.currency} {Number(c.goalAmount).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        <span className={c.raisedAmount >= c.goalAmount ? 'text-green-400' : 'text-gray-300'}>
                          {c.currency} {Number(c.raisedAmount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400">
                        {c.deadline ? new Date(c.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Drawer */}
      {selected ? (
        <div className="w-80 border-l border-gray-800 flex flex-col overflow-hidden" style={{ background: '#0d0d14' }}>
          <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-white text-sm">{selected.entityName}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{selected.event?.title ?? 'No event'}</p>
            </div>
            <button onClick={closeDrawer} className="text-gray-600 hover:text-white text-xl leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {selected.description && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Description</div>
                <p className="text-xs text-gray-300 leading-relaxed">{selected.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Goal</div>
                <div className="text-sm font-bold text-white font-mono">
                  {selected.currency} {Number(selected.goalAmount).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Raised</div>
                <div className={`text-sm font-bold font-mono ${selected.raisedAmount >= selected.goalAmount ? 'text-green-400' : 'text-white'}`}>
                  {selected.currency} {Number(selected.raisedAmount).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (selected.raisedAmount / selected.goalAmount) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                {Math.round((selected.raisedAmount / selected.goalAmount) * 100)}% funded
              </div>
            </div>

            {selected.deadline && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Deadline</div>
                <div className="text-xs text-gray-300">{new Date(selected.deadline).toLocaleDateString()}</div>
              </div>
            )}

            {selected.item && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Item Being Funded</div>
                <div className="text-xs text-gray-300">{selected.item.label}</div>
              </div>
            )}

            {(selected.contactName || selected.contactEmail) && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Contact</div>
                {selected.contactName && <div className="text-xs text-gray-300">{selected.contactName}</div>}
                {selected.contactEmail && <div className="text-xs text-gray-400">{selected.contactEmail}</div>}
              </div>
            )}

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Created</div>
              <div className="text-xs text-gray-400">{new Date(selected.createdAt).toLocaleDateString()}</div>
            </div>

            {/* Actions (only for pending) */}
            {tab === 'pending' && !confirming && (
              <div className="space-y-2 pt-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Action</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleActionClick('approved')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      action === 'approved'
                        ? 'bg-green-500/20 text-green-300 border-green-500/40'
                        : 'border-green-500/20 text-green-400/60 hover:bg-green-500/10 hover:text-green-300'
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleActionClick('rejected')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      action === 'rejected'
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'border-red-500/20 text-red-400/60 hover:bg-red-500/10 hover:text-red-300'
                    }`}
                  >
                    Reject
                  </button>
                </div>
                <button
                  onClick={() => handleActionClick('needs_changes')}
                  className={`w-full py-2 rounded-lg text-xs font-medium border transition-all ${
                    action === 'needs_changes'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'border-amber-500/20 text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-300'
                  }`}
                >
                  Request Changes
                </button>

                {action && (
                  <div className="pt-2 space-y-2">
                    {(action === 'rejected' || action === 'needs_changes') && (
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                          Reason {action === 'rejected' ? '(required)' : '(required)'}
                        </label>
                        <textarea
                          value={reason}
                          onChange={e => { setReasonText(e.target.value); setReasonError(''); }}
                          rows={3}
                          placeholder="Explain your decision..."
                          className={`w-full bg-white/[0.04] border rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none ${
                            reasonError ? 'border-red-500/50' : 'border-gray-700'
                          }`}
                        />
                        {reasonError && <p className="text-red-400 text-[10px] mt-1">{reasonError}</p>}
                      </div>
                    )}
                    <button
                      onClick={handleConfirmStep}
                      className="w-full py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Confirmation step */}
            {tab === 'pending' && confirming && (
              <div className="pt-2 space-y-3 border-t border-gray-800">
                <div className="text-xs text-gray-300">
                  Are you sure you want to{' '}
                  <span className={
                    action === 'approved' ? 'text-green-400 font-semibold' :
                    action === 'rejected' ? 'text-red-400 font-semibold' :
                    'text-amber-400 font-semibold'
                  }>
                    {action === 'approved' ? 'approve' : action === 'rejected' ? 'reject' : 'request changes for'}
                  </span>{' '}
                  this campaign?
                </div>
                {reason && (
                  <div className="bg-gray-800 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500 mb-1">Reason</div>
                    <div className="text-xs text-gray-300">{reason}</div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 py-2 rounded-lg text-xs border border-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                      action === 'approved' ? 'bg-green-600 hover:bg-green-500' :
                      action === 'rejected' ? 'bg-red-600 hover:bg-red-500' :
                      'bg-amber-600 hover:bg-amber-500'
                    }`}
                  >
                    {submitting ? 'Submitting...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-80 border-l border-gray-800 flex items-center justify-center" style={{ background: '#0d0d14' }}>
          <p className="text-xs text-gray-600">Select a campaign to review</p>
        </div>
      )}
    </div>
  );
}
