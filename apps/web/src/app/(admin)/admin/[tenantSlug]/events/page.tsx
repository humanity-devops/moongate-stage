'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { organizerApi } from '@/lib/api';

export default function AdminEventsPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: '', country: '', startDate: '', endDate: '', websiteUrl: '' });

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }

    organizerApi.getEvents(token, tenantSlug)
      .then(res => setEvents(res.data as Record<string, unknown>[]))
      .catch(() => router.push('/auth/login'))
      .finally(() => setLoading(false));
  }, [tenantSlug, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('moongate_token');
    if (!token) return;
    setCreating(true);
    setCreateError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const body: Record<string, string> = { name: form.name };
      if (form.city) body.city = form.city;
      if (form.country) body.country = form.country;
      if (form.startDate) body.startDate = new Date(form.startDate).toISOString();
      if (form.endDate) body.endDate = new Date(form.endDate).toISOString();
      if (form.websiteUrl) body.websiteUrl = form.websiteUrl;
      const res = await fetch(`${API_URL}/api/organizer/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? 'Failed to create event');
      setShowModal(false);
      setForm({ name: '', city: '', country: '', startDate: '', endDate: '', websiteUrl: '' });
      router.push(`/admin/${tenantSlug}/events/${data.data.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Events</h1>
            <p className="text-gray-400 mt-1">Manage your sponsorship events</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors"
          >
            + New Event
          </button>
        </div>

        {/* Cross-event quick links */}
        <div className="flex gap-3 mb-8">
          {[
            { href: `/admin/${tenantSlug}/proposals`, icon: '📋', label: 'Proposals' },
            { href: `/admin/${tenantSlug}/outreach`, icon: '📬', label: 'Outreach' },
            { href: `/admin/${tenantSlug}/analytics`, icon: '📊', label: 'Analytics' },
          ].map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 bg-gray-900 transition-all"
            >
              <span>{icon}</span> {label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => {
            const counts = event._count as Record<string, number>;
            return (
              <Link
                key={event.id as string}
                href={`/admin/${tenantSlug}/events/${event.id}`}
                className="bg-gray-900 rounded-2xl border border-gray-800 hover:border-brand-600/50 p-6 transition-all hover:shadow-lg hover:shadow-brand-600/5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{event.name as string}</h3>
                    <p className="text-gray-400 text-sm mt-0.5">{event.city as string || ''}{event.country ? `, ${event.country}` : ''}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    event.status === 'published' ? 'bg-green-500/20 text-green-400' :
                    event.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {event.status as string}
                  </span>
                </div>
                {!!event.startDate && (
                  <p className="text-gray-500 text-sm mb-4">
                    {new Date(event.startDate as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {counts && (
                  <div className="flex gap-4 text-sm text-gray-400 border-t border-gray-800 pt-4">
                    <span><strong className="text-white">{counts.sponsorItems}</strong> items</span>
                    <span><strong className="text-white">{counts.bids}</strong> bids</span>
                    <span><strong className="text-white">{counts.orders}</strong> orders</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* New Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Create New Event</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Event Name *</label>
                <input
                  type="text" required placeholder="e.g. ETHBerlin 2026"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">City</label>
                  <input
                    type="text" placeholder="Berlin"
                    value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Country</label>
                  <input
                    type="text" placeholder="Germany"
                    value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Website URL</label>
                <input
                  type="url" placeholder="https://ethberlin.org"
                  value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500"
                />
              </div>
              {createError && <p className="text-red-400 text-sm">{createError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !form.name.trim()}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors">
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
