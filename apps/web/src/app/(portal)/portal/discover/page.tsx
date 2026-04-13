'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Event = {
  id: string;
  name: string;
  tagline?: string;
  city?: string;
  country?: string;
  startDate?: string;
  slug: string;
  tenant: { name: string; slug: string };
  branding?: { primaryColor?: string };
  _count: { sponsorItems: number };
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}` };
}

export default function PortalDiscoverPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '48' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`${API_URL}/api/public/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.data ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadEvents, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadEvents, search]);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/saved`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => {
        const ids = new Set<string>((d.data ?? []).filter((s: { entityType: string }) => s.entityType === 'event').map((s: { entityId: string }) => s.entityId));
        setSavedIds(ids);
      })
      .catch(() => {});
  }, []);

  async function toggleSave(eventId: string) {
    const token = localStorage.getItem('moongate_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (savedIds.has(eventId)) {
      await fetch(`${API_URL}/api/sponsor/saved/by-entity/event/${eventId}`, { method: 'DELETE', headers });
      setSavedIds(prev => { const n = new Set(prev); n.delete(eventId); return n; });
    } else {
      await fetch(`${API_URL}/api/sponsor/saved`, { method: 'POST', headers, body: JSON.stringify({ entityType: 'event', entityId: eventId }) });
      setSavedIds(prev => new Set(Array.from(prev).concat(eventId)));
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-1">Discover</h1>
      <p className="text-white/40 text-sm mb-6">Find sponsorship opportunities at leading events</p>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search events..."
        className="w-full max-w-md bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 mb-8"
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 glass rounded-xl animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-white/40">No events found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map(event => {
            const accent = event.branding?.primaryColor ?? '#4361ee';
            const saved = savedIds.has(event.id);
            return (
              <div key={event.id} className="glass rounded-xl p-5 border border-white/[0.06] flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-0.5 w-8 rounded-full" style={{ background: accent }} />
                  <button
                    onClick={() => toggleSave(event.id)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      saved
                        ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30'
                        : 'text-white/30 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {saved ? 'Saved' : 'Save'}
                  </button>
                </div>
                <h3 className="font-bold text-white text-base mb-1 line-clamp-1">{event.name}</h3>
                {event.tagline && <p className="text-xs text-white/40 line-clamp-2 mb-3">{event.tagline}</p>}
                <div className="mt-auto flex items-center justify-between">
                  <div className="text-xs text-white/30">
                    {[event.city, event.country].filter(Boolean).join(', ')}
                    {event.startDate && ` · ${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                  </div>
                  <Link
                    href={`/${event.tenant.slug}/${event.slug}/sponsor`}
                    className="text-xs px-3 py-1.5 rounded-lg text-white transition-colors hover:opacity-80"
                    style={{ background: accent }}
                  >
                    View {event._count.sponsorItems} pkg{event._count.sponsorItems !== 1 ? 's' : ''}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
