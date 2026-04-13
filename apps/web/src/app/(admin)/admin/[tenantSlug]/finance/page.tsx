'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// --- Types ---
type Order = {
  id: string; status: string; total: number; merchantNetAmount: number | null;
  paidAt: string | null; currency: string; createdAt: string;
  paymentStage?: string;
  fullAmount?: number | null;
  balanceDueAmount?: number | null;
  finalPaymentDueAt?: string | null;
  finalReminderSentAt?: string | null;
  event: { id: string; name: string; slug: string } | null;
  sponsorCompany: { id: string; name: string } | null;
  invoice: { id: string; invoiceNumber: string; issuedAt: string } | null;
};
type CustomInvoice = {
  id: string; invoiceNumber: string; status: string;
  recipientEmail: string; recipientName: string | null; recipientCompany: string | null;
  currency: string; total: number; subtotal: number; taxRate: number; taxAmount: number;
  discountAmount: number; dueDate: string | null; notes: string | null; legalText: string | null;
  lines: InvoiceLine[]; issuedAt: string | null; paidAt: string | null; createdAt: string;
};
type InvoiceLine = { label: string; quantity: number; unitPrice: number; total: number };
type Payout = {
  id: string; status: string; currency: string;
  grossAmount: number; feeAmount: number; netAmount: number;
  periodStart: string | null; periodEnd: string | null;
  paidAt: string | null; reference: string | null; notes: string | null;
  createdAt: string;
  _count: { items: number };
};
type Summary = { incomeToDate: number; payoutToDate: number; yetToPayout: number };

type Tab = 'orders' | 'custom-invoices' | 'payouts';

// --- Status badge ---
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    partially_paid: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    sent: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    draft: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    processing: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
    cancelled: 'bg-red-500/15 text-red-400 border-red-500/25',
    failed: 'bg-red-500/15 text-red-400 border-red-500/25',
    payment_pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  };
  const cls = map[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// --- Summary card ---
function SummaryCard({ label, value, currency = 'USD', sub }: { label: string; value: number; currency?: string; sub?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="text-xs text-gray-400 mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-white font-mono">
        {currency} {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// --- Inline Create Invoice Form ---
type InvoiceFormData = {
  recipientEmail: string; recipientName: string; recipientCompany: string;
  currency: string; taxRate: string; discountAmount: string;
  dueDate: string; notes: string; legalText: string;
  lines: { label: string; quantity: string; unitPrice: string }[];
};

const emptyForm = (): InvoiceFormData => ({
  recipientEmail: '', recipientName: '', recipientCompany: '',
  currency: 'USD', taxRate: '0', discountAmount: '0',
  dueDate: '', notes: '', legalText: '',
  lines: [{ label: '', quantity: '1', unitPrice: '0' }],
});

function CreateInvoiceForm({
  onSave, onCancel, saving,
}: {
  onSave: (data: InvoiceFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<InvoiceFormData>(emptyForm());

  const setField = (field: keyof InvoiceFormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const setLine = (idx: number, field: keyof InvoiceFormData['lines'][0], value: string) =>
    setForm(f => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...f, lines };
    });

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { label: '', quantity: '1', unitPrice: '0' }] }));
  const removeLine = (idx: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const subtotal = form.lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);
  const taxAmount = subtotal * (parseFloat(form.taxRate) || 0) / 100;
  const discount = parseFloat(form.discountAmount) || 0;
  const total = subtotal + taxAmount - discount;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
      <h3 className="text-sm font-semibold text-white">New Custom Invoice</h3>

      {/* Recipient */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Recipient Email *</label>
          <input
            type="email" value={form.recipientEmail}
            onChange={e => setField('recipientEmail', e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            placeholder="billing@example.com"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Recipient Name</label>
          <input
            type="text" value={form.recipientName}
            onChange={e => setField('recipientName', e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Company</label>
          <input
            type="text" value={form.recipientCompany}
            onChange={e => setField('recipientCompany', e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            placeholder="Acme Corp"
          />
        </div>
      </div>

      {/* Currency + due date */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Currency</label>
          <select
            value={form.currency} onChange={e => setField('currency', e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {['USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Due Date</label>
          <input
            type="date" value={form.dueDate}
            onChange={e => setField('dueDate', e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400">Line Items</label>
          <button
            type="button" onClick={addLine}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            + Add line
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_100px_80px] gap-2 text-[10px] text-gray-500 px-1">
            <span>Description</span><span>Qty</span><span>Unit Price</span><span></span>
          </div>
          {form.lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-center">
              <input
                type="text" value={line.label}
                onChange={e => setLine(idx, 'label', e.target.value)}
                placeholder="Sponsorship package"
                className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number" value={line.quantity} min="0.01" step="0.01"
                onChange={e => setLine(idx, 'quantity', e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number" value={line.unitPrice} min="0" step="0.01"
                onChange={e => setLine(idx, 'unitPrice', e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button" onClick={() => removeLine(idx)}
                disabled={form.lines.length === 1}
                className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tax / discount */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Tax Rate (%)</label>
          <input
            type="number" value={form.taxRate} min="0" max="100" step="0.01"
            onChange={e => setField('taxRate', e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Discount</label>
          <input
            type="number" value={form.discountAmount} min="0" step="0.01"
            onChange={e => setField('discountAmount', e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Total preview */}
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-1.5">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Subtotal</span>
          <span className="font-mono">{form.currency} {subtotal.toFixed(2)}</span>
        </div>
        {taxAmount !== 0 && (
          <div className="flex justify-between text-xs text-gray-400">
            <span>Tax ({form.taxRate}%)</span>
            <span className="font-mono">{form.currency} {taxAmount.toFixed(2)}</span>
          </div>
        )}
        {discount !== 0 && (
          <div className="flex justify-between text-xs text-gray-400">
            <span>Discount</span>
            <span className="font-mono text-red-400">- {form.currency} {discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-gray-800">
          <span>Total</span>
          <span className="font-mono">{form.currency} {total.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Notes</label>
        <textarea
          value={form.notes} onChange={e => setField('notes', e.target.value)}
          rows={2} placeholder="Payment terms, instructions..."
          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.recipientEmail}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- Main Finance Page ---
export default function FinancePage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customInvoices, setCustomInvoices] = useState<CustomInvoice[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<Summary>({ incomeToDate: 0, payoutToDate: 0, yetToPayout: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('moongate_token');
    return { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug };
  }, [tenantSlug]);

  const fetchAll = useCallback(async () => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }

    setLoading(true);
    try {
      const [ordersRes, invRes, payoutsRes] = await Promise.all([
        fetch(`${API_URL}/api/organizer/orders?pageSize=100`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/organizer/custom-invoices?pageSize=100`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/organizer/payouts?pageSize=100`, { headers: authHeaders() }),
      ]);

      if (ordersRes.status === 401 || ordersRes.status === 403) { router.push('/auth/login'); return; }

      const [ordersJson, invJson, payoutsJson] = await Promise.all([
        ordersRes.ok ? ordersRes.json() : { data: [] },
        invRes.ok ? invRes.json() : { data: [] },
        payoutsRes.ok ? payoutsRes.json() : { data: [], summary: { incomeToDate: 0, payoutToDate: 0, yetToPayout: 0 } },
      ]);

      setOrders(ordersJson.data ?? []);
      setCustomInvoices(invJson.data ?? []);
      setPayouts(payoutsJson.data ?? []);
      if (payoutsJson.summary) setSummary(payoutsJson.summary);
    } catch {
      setError('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, [router, authHeaders]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreateInvoice = async (form: InvoiceFormData) => {
    setSavingInvoice(true);
    try {
      const lines = form.lines.map(l => ({
        label: l.label,
        quantity: parseFloat(l.quantity) || 1,
        unitPrice: parseFloat(l.unitPrice) || 0,
        total: (parseFloat(l.quantity) || 1) * (parseFloat(l.unitPrice) || 0),
      }));
      const res = await fetch(`${API_URL}/api/organizer/custom-invoices`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: form.recipientEmail,
          recipientName: form.recipientName || undefined,
          recipientCompany: form.recipientCompany || undefined,
          currency: form.currency,
          lines,
          taxRate: (parseFloat(form.taxRate) || 0) / 100,
          discountAmount: parseFloat(form.discountAmount) || 0,
          dueDate: form.dueDate || undefined,
          notes: form.notes || undefined,
          legalText: form.legalText || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? 'Failed to create invoice');
      }
      setShowCreateInvoice(false);
      await fetchAll();
      setTab('custom-invoices');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleSendInvoice = async (invId: string) => {
    if (!confirm('Mark this invoice as sent?')) return;
    await fetch(`${API_URL}/api/organizer/custom-invoices/${invId}/send`, {
      method: 'POST', headers: authHeaders(),
    });
    await fetchAll();
  };

  const handleInvoiceStatus = async (invId: string, status: 'paid' | 'cancelled') => {
    if (!confirm(`Mark this invoice as ${status}?`)) return;
    await fetch(`${API_URL}/api/organizer/custom-invoices/${invId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await fetchAll();
  };

  const handleDeleteInvoice = async (invId: string) => {
    if (!confirm('Delete this draft invoice?')) return;
    await fetch(`${API_URL}/api/organizer/custom-invoices/${invId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    await fetchAll();
  };

  const handleSendReminder = async (orderId: string) => {
    if (!confirm('Send final payment reminder to sponsor now?')) return;
    const res = await fetch(`${API_URL}/api/organizer/orders/${orderId}/send-final-reminder`, {
      method: 'POST', headers: authHeaders(),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      alert('Reminder sent successfully.');
      await fetchAll();
    } else {
      alert(j.message ?? 'Failed to send reminder');
    }
  };

  const handleCreatePayout = async () => {
    if (!confirm('Create a payout for all eligible unpaid orders?')) return;
    const res = await fetch(`${API_URL}/api/organizer/payouts`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? 'Failed to create payout');
      return;
    }
    await fetchAll();
    setTab('payouts');
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/[0.03] animate-pulse rounded-xl" />)}
    </div>
  );
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders', label: 'Orders & Invoices' },
    { id: 'custom-invoices', label: 'Custom Invoices' },
    { id: 'payouts', label: 'Payouts' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Finance</h1>
        <p className="text-xs text-gray-400 mt-0.5">Orders, invoices, and payouts</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Income to Date" value={summary.incomeToDate} sub="Total from paid orders" />
        <SummaryCard label="Paid Out" value={summary.payoutToDate} sub="Net amount transferred" />
        <SummaryCard label="Yet to Pay Out" value={summary.yetToPayout} sub="Eligible for next payout" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders & Invoices Tab */}
      {tab === 'orders' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Company</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Event</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Deposit</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Invoice</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No orders yet</td></tr>
              ) : orders.map(o => {
                const isDepositOrder = o.paymentStage === 'balance' && o.status === 'partially_paid';
                const balanceAmt = o.balanceDueAmount != null ? Number(o.balanceDueAmount) : null;
                const dueDate = o.finalPaymentDueAt ? new Date(o.finalPaymentDueAt).toLocaleDateString() : null;
                const reminderSent = o.finalReminderSentAt != null;
                return (
                  <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {o.sponsorCompany?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {o.event?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      {o.currency} {Number(o.fullAmount ?? o.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3">
                      {isDepositOrder && balanceAmt != null ? (
                        <div>
                          <div className="text-blue-400 font-mono">{o.currency} {balanceAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} due</div>
                          {dueDate && <div className="text-gray-500 text-[10px] mt-0.5">by {dueDate}</div>}
                        </div>
                      ) : o.paymentStage === 'full' || o.status === 'paid' ? (
                        <span className="text-gray-600">—</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.invoice ? (
                        <span className="text-indigo-400 font-mono text-[10px]">{o.invoice.invoiceNumber}</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isDepositOrder && (
                        <button
                          onClick={() => handleSendReminder(o.id)}
                          className={`text-[10px] px-2 py-1 rounded transition-colors ${
                            reminderSent
                              ? 'text-gray-500 hover:text-amber-400'
                              : 'text-amber-400 hover:text-amber-300'
                          }`}
                          title={reminderSent ? `Reminder sent ${new Date(o.finalReminderSentAt!).toLocaleDateString()}` : 'Send payment reminder'}
                        >
                          {reminderSent ? 'Resend' : 'Remind'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Custom Invoices Tab */}
      {tab === 'custom-invoices' && (
        <div className="space-y-4">
          {showCreateInvoice ? (
            <CreateInvoiceForm
              onSave={handleCreateInvoice}
              onCancel={() => setShowCreateInvoice(false)}
              saving={savingInvoice}
            />
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateInvoice(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Create Invoice
              </button>
            </div>
          )}

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Recipient</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Total</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {customInvoices.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No custom invoices yet</td></tr>
                ) : customInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-indigo-400 font-mono">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{inv.recipientName ?? inv.recipientEmail}</div>
                      {inv.recipientCompany && (
                        <div className="text-gray-500 text-[10px]">{inv.recipientCompany}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      {inv.currency} {Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleSendInvoice(inv.id)}
                              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              Send
                            </button>
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {inv.status === 'sent' && (
                          <>
                            <button
                              onClick={() => handleInvoiceStatus(inv.id, 'paid')}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              Mark Paid
                            </button>
                            <button
                              onClick={() => handleInvoiceStatus(inv.id, 'cancelled')}
                              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {(inv.status === 'paid' || inv.status === 'cancelled') && (
                          <span className="text-[10px] text-gray-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payouts Tab */}
      {tab === 'payouts' && (
        <div className="space-y-4">
          {summary.yetToPayout > 0 && (
            <div className="flex items-center justify-between bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-5 py-4">
              <div>
                <div className="text-sm text-white font-medium">
                  USD {summary.yetToPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })} ready to pay out
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  From orders not yet included in a payout
                </div>
              </div>
              <button
                onClick={handleCreatePayout}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
              >
                Create Payout
              </button>
            </div>
          )}

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Gross</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Net</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Orders</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Reference</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payouts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No payouts yet</td></tr>
                ) : payouts.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {p.currency} {Number(p.grossAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      {p.currency} {Number(p.netAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">
                      {p._count.items}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-[10px]">
                      {p.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/${tenantSlug}/finance/payout/${p.id}`}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
