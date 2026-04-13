'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type InvoiceLine = { label: string; quantity: number; unitPrice: number; total: number };

type Invoice = {
  id: string;
  invoiceNumber: string;
  billedToEmail: string;
  billedToName?: string;
  billedToCompany?: string;
  subtotal: number;
  platformFee: number;
  total: number;
  currency: string;
  issuedAt: string;
  lines: InvoiceLine[];
  order: {
    id: string;
    event: { name: string; slug: string };
    tenant: { name: string; slug: string };
  };
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}` };
}

export default function InvoiceDetailPage() {
  const { id } = useParams() as { id: string };
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/orders/invoices/${id}`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setInvoice(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-8 space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}</div>
  );

  if (!invoice) return <div className="p-8 text-red-400 text-sm">Invoice not found</div>;

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/portal/invoices" className="text-xs text-white/30 hover:text-white/60 mb-6 inline-block transition-colors">← Back to Invoices</Link>

      <div className="glass rounded-xl p-8 border border-white/[0.06] space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-white/30 uppercase tracking-widest font-mono mb-1">Invoice</div>
            <div className="text-2xl font-bold text-white">{invoice.invoiceNumber}</div>
          </div>
          <div className="text-right text-xs text-white/40">
            <div>Issued {new Date(invoice.issuedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            <div className="mt-1">{invoice.order.tenant.name}</div>
          </div>
        </div>

        {/* Billed to */}
        <div className="pt-4 border-t border-white/[0.06]">
          <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Billed To</div>
          {invoice.billedToCompany && <div className="text-sm text-white">{invoice.billedToCompany}</div>}
          {invoice.billedToName && <div className="text-sm text-white">{invoice.billedToName}</div>}
          <div className="text-xs text-white/50">{invoice.billedToEmail}</div>
        </div>

        {/* Event */}
        <div className="pt-4 border-t border-white/[0.06]">
          <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Event</div>
          <div className="text-sm text-white">{invoice.order.event.name}</div>
        </div>

        {/* Line items */}
        <div className="pt-4 border-t border-white/[0.06]">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30">
                <th className="text-left pb-2">Item</th>
                <th className="text-right pb-2">Qty</th>
                <th className="text-right pb-2">Unit</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              {(Array.isArray(invoice.lines) ? invoice.lines : []).map((line, i) => (
                <tr key={i}>
                  <td className="py-1.5">{line.label}</td>
                  <td className="text-right">{line.quantity}</td>
                  <td className="text-right">{invoice.currency} {Number(line.unitPrice).toLocaleString()}</td>
                  <td className="text-right">{invoice.currency} {Number(line.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs">
          <div className="flex justify-between text-white/50">
            <span>Subtotal</span>
            <span>{invoice.currency} {Number(invoice.subtotal).toLocaleString()}</span>
          </div>
          {Number(invoice.platformFee) > 0 && (
            <div className="flex justify-between text-white/50">
              <span>Platform fee</span>
              <span>{invoice.currency} {Number(invoice.platformFee).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-white/[0.06]">
            <span>Total</span>
            <span>{invoice.currency} {Number(invoice.total).toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="w-full py-2.5 border border-white/10 text-white/60 text-sm rounded-lg hover:bg-white/[0.04] transition-colors"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
