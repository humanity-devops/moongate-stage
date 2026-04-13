'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type PayoutOrder = {
  id: string; status: string; total: number; merchantNetAmount: number | null;
  paidAt: string | null; currency: string;
  bid: { companyName: string } | null;
  event: { name: string } | null;
};
type PayoutItem = { id: string; amount: number; orderId: string; order: PayoutOrder };
type Payout = {
  id: string; status: string; currency: string;
  grossAmount: number; feeAmount: number; netAmount: number;
  periodStart: string | null; periodEnd: string | null;
  paidAt: string | null; reference: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
  items: PayoutItem[];
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    processing: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
    cancelled: 'bg-red-500/15 text-red-400 border-red-500/25',
    failed: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  const cls = map[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25';
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

export default function PayoutDetailPage() {
  const { tenantSlug, payoutId } = useParams() as { tenantSlug: string; payoutId: string };
  const router = useRouter();

  const [payout, setPayout] = useState<Payout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('moongate_token');
    return { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug };
  }, [tenantSlug]);

  const fetchPayout = useCallback(async () => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/payouts/${payoutId}`, {
        headers: authHeaders(),
      });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (res.status === 404) { setError('Payout not found'); return; }
      const j = await res.json();
      setPayout(j.data);
      setReference(j.data.reference ?? '');
      setNewStatus(j.data.status);
    } catch {
      setError('Failed to load payout');
    } finally {
      setLoading(false);
    }
  }, [payoutId, router, authHeaders]);

  useEffect(() => { fetchPayout(); }, [fetchPayout]);

  const handleUpdate = async () => {
    if (!payout) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(newStatus !== payout.status ? { status: newStatus } : {}),
          ...(reference !== (payout.reference ?? '') ? { reference } : {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Update failed');
      }
      await fetchPayout();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white/[0.03] animate-pulse rounded-xl" />)}
    </div>
  );
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>;
  if (!payout) return null;

  const hasChanges = newStatus !== payout.status || reference !== (payout.reference ?? '');
  const validNextStatuses = ['pending', 'processing', 'paid', 'failed', 'cancelled'];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href={`/admin/${tenantSlug}/finance`} className="hover:text-gray-300 transition-colors">
          Finance
        </Link>
        <span>/</span>
        <span className="text-gray-300">Payout {payout.id.slice(0, 8)}…</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Payout</h1>
            <StatusBadge status={payout.status} />
          </div>
          <p className="text-xs text-gray-400 mt-1 font-mono">{payout.id}</p>
        </div>
        {payout.paidAt && (
          <div className="text-right">
            <div className="text-xs text-gray-500">Paid at</div>
            <div className="text-sm text-emerald-400">{new Date(payout.paidAt).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 mb-1.5">Gross Amount</div>
          <div className="text-xl font-bold text-gray-300 font-mono">
            {payout.currency} {Number(payout.grossAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 mb-1.5">Fee</div>
          <div className="text-xl font-bold text-red-400 font-mono">
            {payout.currency} {Number(payout.feeAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-400 mb-1.5">Net Amount</div>
          <div className="text-xl font-bold text-white font-mono">
            {payout.currency} {Number(payout.netAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders table */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-3">Included Orders ({payout.items.length})</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Company</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Event</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Amount</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payout.items.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No orders</td></tr>
                ) : payout.items.map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-300">
                      {item.order.bid?.companyName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {item.order.event?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      {item.order.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {item.order.paidAt ? new Date(item.order.paidAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Update panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white">Update Payout</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Status</label>
              <select
                value={newStatus} onChange={e => setNewStatus(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {validNextStatuses.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Reference / Transfer ID</label>
              <input
                type="text" value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. BANK-REF-12345"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleUpdate}
              disabled={saving || !hasChanges}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {/* Meta */}
            <div className="pt-2 border-t border-gray-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-400">{new Date(payout.createdAt).toLocaleDateString()}</span>
              </div>
              {payout.periodStart && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Period</span>
                  <span className="text-gray-400">
                    {new Date(payout.periodStart).toLocaleDateString()}
                    {payout.periodEnd && ` – ${new Date(payout.periodEnd).toLocaleDateString()}`}
                  </span>
                </div>
              )}
              {payout.notes && (
                <div className="text-xs text-gray-500 pt-1">{payout.notes}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
