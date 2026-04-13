'use client';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { type SponsorOrder } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: 'text-green-300 bg-green-500/10 border-green-500/30',
  partially_paid: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  payment_pending: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  pending: 'text-gray-400 bg-gray-800 border-gray-700',
  cancelled: 'text-red-300 bg-red-500/10 border-red-500/30',
};

function fmt(n: number | string | null | undefined, currency: string) {
  if (n == null) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DepositProgressBar({ depositAmount, fullAmount }: { depositAmount: number; fullAmount: number }) {
  const pct = fullAmount > 0 ? Math.round((depositAmount / fullAmount) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-white/30 mb-1">
        <span>Deposit paid</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06]">
        <div className="h-1 rounded-full bg-blue-400/70 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PayBalanceButton({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/sponsor/orders/${orderId}/pay-balance`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to start payment');
      window.location.href = json.data.url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
      onDone();
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="mt-3 w-full text-xs font-semibold py-2.5 rounded-lg transition-colors text-white disabled:opacity-50"
        style={{ background: '#4361ee' }}
      >
        {loading ? 'Redirecting...' : 'Complete Final Payment →'}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function PaymentsInner() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<SponsorOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const successOrderId = searchParams.get('order');
  const isSuccess = searchParams.get('success') === '1';
  const isCancelled = searchParams.get('cancelled') === '1';

  const load = useCallback(() => {
    fetch(`${API_URL}/api/sponsor/orders`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setOrders(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">Payments</h1>
      <p className="text-white/40 text-sm mb-6">Your orders and payment history</p>

      {isSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6 text-sm text-green-300">
          Payment successful! Your order has been confirmed. Check your email for the invoice.
        </div>
      )}
      {isCancelled && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-sm text-amber-300">
          Payment cancelled. You can retry below.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 glass rounded-xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center border border-white/[0.06]">
          <p className="text-white/40 text-sm">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const style = ORDER_STATUS_STYLES[order.status] ?? 'text-gray-400 bg-gray-800 border-gray-700';
            const isHighlighted = order.id === successOrderId;
            const isDeposit = order.paymentStage === 'balance' && order.status === 'partially_paid';
            const fullAmt = order.fullAmount != null ? Number(order.fullAmount) : null;
            const depositAmt = order.depositAmount != null ? Number(order.depositAmount) : null;
            const balanceAmt = order.balanceDueAmount != null ? Number(order.balanceDueAmount) : null;

            return (
              <div
                key={order.id}
                className={`glass rounded-xl p-5 border ${isHighlighted ? 'border-green-500/30' : isDeposit ? 'border-blue-500/20' : 'border-white/[0.06]'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-white">{order.event.name}</div>
                    <div className="text-xs text-white/40 mt-0.5">{order.tenant.name}</div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${style}`}>
                      {order.status === 'partially_paid' ? 'deposit paid' : order.status.replace(/_/g, ' ')}
                    </span>
                    <div className="text-sm font-bold text-white mt-1">
                      {fullAmt != null ? fmt(fullAmt, order.currency) : fmt(order.total, order.currency)}
                    </div>
                    {fullAmt != null && <div className="text-[10px] text-white/30">full price</div>}
                  </div>
                </div>

                <div className="text-xs text-white/30 mb-3">
                  {fmtDate(order.createdAt)}
                </div>

                {order.lines.map(l => (
                  <div key={l.id} className="text-xs text-white/50">
                    {l.label ?? l.item.publicTitle} × {l.quantity}
                  </div>
                ))}

                {/* Deposit breakdown */}
                {isDeposit && depositAmt != null && balanceAmt != null && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Deposit paid</span>
                      <span className="text-green-400 font-mono">{fmt(depositAmt, order.currency)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Balance due</span>
                      <span className="text-white font-mono font-semibold">{fmt(balanceAmt, order.currency)}</span>
                    </div>
                    {order.finalPaymentDueAt && (
                      <div className="text-xs text-amber-400/80">
                        Due by {fmtDate(order.finalPaymentDueAt)}
                      </div>
                    )}
                    {fullAmt != null && depositAmt != null && (
                      <DepositProgressBar depositAmount={depositAmt} fullAmount={fullAmt} />
                    )}
                    <PayBalanceButton orderId={order.id} onDone={load} />
                  </div>
                )}

                {order.invoice && (
                  <div className={`pt-3 border-t border-white/[0.06] ${isDeposit ? 'mt-0' : 'mt-3'}`}>
                    <Link
                      href={`/portal/invoices/${order.invoice.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Invoice {order.invoice.invoiceNumber} →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/40">Loading...</div>}>
      <PaymentsInner />
    </Suspense>
  );
}
