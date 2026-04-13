'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { organizerApi } from '@/lib/api';
import { formatCurrency, getCategoryLabel, getModeLabel } from '@/lib/utils';

type Item = {
  id: string;
  slug: string;
  publicTitle: string;
  category: string;
  mode: string;
  status: string;
  listPrice?: number;
  currency: string;
  quantityTotal?: number;
  quantitySold: number;
  isExclusive: boolean;
  featured: boolean;
  visibleToPublic: boolean;
  depositEnabled?: boolean;
  depositPercentage?: number;
  finalPaymentDays?: number | null;
  _count?: { bids: number; orderLines: number };
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  review_required: 'bg-yellow-500/20 text-yellow-400',
  published: 'bg-green-500/20 text-green-400',
  sold_out: 'bg-red-500/20 text-red-400',
  archived: 'bg-gray-700/20 text-gray-600',
};

export default function ItemsPage() {
  const { tenantSlug, eventId } = useParams() as { tenantSlug: string; eventId: string };
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    try {
      const res = await organizerApi.getItems(eventId, token, tenantSlug);
      setItems(res.data as Item[]);
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [eventId, tenantSlug, router]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function togglePublish(item: Item) {
    const token = localStorage.getItem('moongate_token');
    if (!token) return;
    setPublishing(item.id);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      await fetch(`${API_URL}/api/organizer/events/${eventId}/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': tenantSlug,
        },
        body: JSON.stringify({
          status: item.status === 'published' ? 'draft' : 'published',
          visibleToPublic: item.status !== 'published',
        }),
      });
      await loadItems();
    } finally {
      setPublishing(null);
    }
  }

  async function configureDeposit(item: Item) {
    const token = localStorage.getItem('moongate_token');
    if (!token) return;
    const enabled = window.confirm(`Enable deposit for "${item.publicTitle}"?\n\nChoose "Cancel" to disable deposit for this package.`);
    const body: Record<string, unknown> = { depositEnabled: enabled };
    if (enabled) {
      const pctInput = window.prompt('Deposit percentage (1-100)', String(item.depositPercentage ?? 30));
      const daysInput = window.prompt('Final payment reminder in how many days?', String(item.finalPaymentDays ?? 14));
      const pct = Number(pctInput ?? '30');
      const days = Number(daysInput ?? '14');
      body.depositPercentage = Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : 30;
      body.finalPaymentDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 14;
    } else {
      body.finalPaymentDays = null;
    }
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    await fetch(`${API_URL}/api/organizer/events/${eventId}/items/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
      },
      body: JSON.stringify(body),
    });
    await loadItems();
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <nav className="text-sm text-gray-500 mb-2">
              <Link href={`/admin/${tenantSlug}/events`} className="hover:text-white">Events</Link>
              <span className="mx-2">›</span>
              <Link href={`/admin/${tenantSlug}/events/${eventId}`} className="hover:text-white">Dashboard</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Items</span>
            </nav>
            <h1 className="text-3xl font-bold text-white">Sponsorship Items</h1>
            <p className="text-gray-400 mt-1">{items.length} items</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/admin/${tenantSlug}/events/${eventId}/decks`}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-gray-700"
            >
              📄 Upload Deck
            </Link>
            <button className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm">
              + New Item
            </button>
          </div>
        </div>

        {/* Items table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-5 py-4">Item</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-4">Category</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-4">Mode</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-4">Price</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-4">Deposit</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-4">Inventory</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-4">Status</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-4">Bids</th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-widest px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {item.featured && <span className="text-accent-400 text-xs">★</span>}
                      <div>
                        <div className="font-semibold text-white text-sm">{item.publicTitle}</div>
                        {item.isExclusive && <span className="text-xs text-purple-400">Exclusive</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-sm">{getCategoryLabel(item.category)}</td>
                  <td className="px-4 py-4 text-gray-400 text-sm">{getModeLabel(item.mode)}</td>
                  <td className="px-4 py-4 text-white font-medium text-sm">
                    {item.listPrice ? formatCurrency(item.listPrice, item.currency) : '—'}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-300">
                    {item.depositEnabled
                      ? `${item.depositPercentage ?? 30}%${item.finalPaymentDays ? ` · ${item.finalPaymentDays}d reminder` : ''}`
                      : 'Disabled'}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {item.quantityTotal ? (
                      <div>
                        <span className="text-white font-medium">{item.quantitySold}</span>
                        <span className="text-gray-500"> / {item.quantityTotal}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[item.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-sm">
                    {item._count?.bids ?? 0}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => togglePublish(item)}
                        disabled={publishing === item.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          item.status === 'published'
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                      >
                        {publishing === item.id ? '...' : item.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-colors">
                        Edit
                      </button>
                      <button
                        onClick={() => configureDeposit(item)}
                        className="px-3 py-1.5 bg-indigo-700/70 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Deposit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center text-gray-400">
                    No items yet. Create your first item or upload a sponsorship deck.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
