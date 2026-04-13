'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type OrderData = {
  id: string;
  status: string;
  total: number | string;
  currency: string;
  paymentStage?: string;
  fullAmount?: number | string | null;
  depositAmount?: number | string | null;
  balanceDueAmount?: number | string | null;
  finalPaymentDueAt?: string | null;
  invoiceNumber?: string;
  lines: { label?: string | null; total: number | string }[];
};

function fmt(n: number | string | null | undefined, currency: string) {
  if (n == null) return '';
  const num = Number(n);
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function CheckoutSuccessPage() {
  const params = useParams() as { tenantSlug: string; eventSlug: string };
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }

    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    async function poll() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const res = await fetch(`${API_URL}/api/sponsor/orders/${orderId}`, { headers });
        if (res.ok) {
          const json = await res.json();
          const o = json.data;
          const isDone = o.status === 'paid' || o.status === 'partially_paid';
          if (isDone || attempts >= MAX_ATTEMPTS - 1) {
            setOrder(o);
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }

      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(poll, 2000);
      } else {
        setLoading(false);
      }
    }

    poll();
  }, [orderId]);

  const isDeposit = order?.status === 'partially_paid' || order?.paymentStage === 'balance';
  const currency = order?.currency ?? 'USD';

  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
            <p className="text-white/50 text-sm">Confirming your payment...</p>
          </div>
        ) : (
          <div className="p-10" style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.07)' }}>
            {isDeposit ? (
              <>
                <CheckCircle2 className="w-14 h-14 text-blue-400 mx-auto mb-6" />
                <h1 className="font-display text-3xl font-bold text-white mb-3">
                  Sponsorship Secured!
                </h1>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your deposit has been received and your sponsorship package is confirmed. A deposit confirmation has been sent to your email.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-6" />
                <h1 className="font-display text-3xl font-bold text-white mb-3">
                  Payment Confirmed!
                </h1>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Thank you for your purchase. Your invoice and receipt have been sent to your email.
                </p>
              </>
            )}

            {order && (
              <div
                className="mb-6 p-4 text-left space-y-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {order.invoiceNumber && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Invoice</span>
                    <span className="font-mono text-white">{order.invoiceNumber}</span>
                  </div>
                )}

                {isDeposit && order.depositAmount != null && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Deposit paid</span>
                    <span className="font-mono text-green-400">{fmt(order.depositAmount, currency)}</span>
                  </div>
                )}

                {isDeposit && order.balanceDueAmount != null && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Balance remaining</span>
                    <span className="font-mono text-white">{fmt(order.balanceDueAmount, currency)}</span>
                  </div>
                )}

                {!isDeposit && order.lines?.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{l.label ?? 'Package'}</span>
                    <span className="font-mono text-white">{fmt(l.total, currency)}</span>
                  </div>
                ))}

                <div
                  className="flex justify-between text-sm pt-2 font-semibold"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}
                >
                  <span className="text-white">{isDeposit ? 'Full package price' : 'Total paid'}</span>
                  <span className={`font-mono ${isDeposit ? 'text-white' : 'text-green-400'}`}>
                    {isDeposit ? fmt(order.fullAmount ?? order.total, currency) : fmt(order.total, currency)}
                  </span>
                </div>
              </div>
            )}

            {/* Final payment reminder */}
            {isDeposit && order?.finalPaymentDueAt && (
              <div
                className="mb-6 p-4 flex items-start gap-3 text-left"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-300 mb-0.5">Final payment due</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Your balance of <strong className="text-white">{fmt(order.balanceDueAmount, currency)}</strong> is due by{' '}
                    <strong className="text-amber-300">{fmtDate(order.finalPaymentDueAt)}</strong>.
                    You can pay it any time from your portal.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Link
                href="/portal/payments"
                className="block w-full py-3 text-sm font-semibold text-white rounded-xl transition-colors"
                style={{ background: '#4361ee' }}
              >
                {isDeposit ? 'Complete Final Payment →' : 'View My Payments'}
              </Link>
              <Link
                href={`/${params.tenantSlug}/${params.eventSlug}`}
                className="block w-full py-3 text-sm font-semibold rounded-xl transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                Browse More Packages
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
