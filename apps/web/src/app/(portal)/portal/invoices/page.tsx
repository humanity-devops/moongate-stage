'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Invoice = {
  id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  issuedAt: string;
  order: {
    id: string;
    event: { name: string; slug: string };
    tenant: { slug: string; name: string };
  };
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}` };
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/orders/invoices`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setInvoices(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Invoices</h1>
      <p className="text-white/40 text-sm mb-8">Download and manage your invoices</p>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}</div>
      ) : invoices.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center border border-white/[0.06]">
          <p className="text-white/40 text-sm">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <Link
              key={inv.id}
              href={`/portal/invoices/${inv.id}`}
              className="glass rounded-xl px-5 py-4 flex items-center justify-between group hover:bg-white/[0.04] transition-colors border border-white/[0.04]"
            >
              <div>
                <div className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                  {inv.invoiceNumber}
                </div>
                <div className="text-xs text-white/40 mt-0.5">{inv.order.event.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-white">{inv.currency} {Number(inv.total).toLocaleString()}</div>
                <div className="text-xs text-white/30 mt-0.5">
                  {new Date(inv.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
