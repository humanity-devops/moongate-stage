'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { track } from '@/lib/track';
import { EventCarousel } from '@/components/site/EventCarousel';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Event = {
  id: string;
  name: string;
  tagline?: string;
  city?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  slug: string;
  tenant: { name: string; slug: string };
  branding?: { primaryColor?: string; logoUrl?: string };
  _count: { sponsorItems: number };
};

const SORT_OPTIONS = [
  { value: 'startDate', label: 'Upcoming first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'createdAt', label: 'Recently added' },
];

const COUNTRIES = [
  { value: '', label: 'All locations' },
  { value: 'United States', label: 'United States' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'United Kingdom', label: 'United Kingdom' },
];

function BrowsePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'startDate');
  const [country, setCountry] = useState(searchParams.get('country') ?? '');
  const [isAuthed, setIsAuthed] = useState(false);
  const [authModalReturn, setAuthModalReturn] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setApiError(false);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (sort) params.set('sort', sort);
      if (country) params.set('location', country);
      params.set('pageSize', '48');

      const res = await fetch(`${API_URL}/api/public/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, [search, sort, country]);

  useEffect(() => {
    const timer = setTimeout(() => { loadEvents(); }, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadEvents, search]);

  // Fetch featured events for carousel (once on mount)
  useEffect(() => {
    fetch(`${API_URL}/api/public/events?sort=startDate&pageSize=4`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setFeaturedEvents(d.data?.slice(0, 4) ?? []))
      .catch(() => {});
  }, []);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    setIsAuthed(!!token);
  }, []);

  function handleAuthRequired(returnPath: string) {
    setAuthModalReturn(returnPath);
    track({ eventType: 'browse_auth_modal_shown', metadata: { returnPath } });
  }

  function closeAuthModal() {
    setAuthModalReturn(null);
  }

  function syncUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.replace(`/browse?${params}`, { scroll: false });
  }

  function updateSearch(value: string) {
    setSearch(value);
    syncUrl({ search: value.trim() });
  }

  function updateSort(value: string) {
    setSort(value);
    syncUrl({ sort: value });
  }

  function updateCountry(value: string) {
    setCountry(value);
    syncUrl({ country: value });
  }

  return (
    <div className="min-h-screen mesh-bg">
      {/* Featured events carousel */}
      {featuredEvents.length > 0 && <EventCarousel events={featuredEvents} />}

      {/* Page header */}
      <div className="border-b border-white/[0.06] bg-void/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <h1 className="font-display text-4xl font-bold text-white mb-2">Browse Events</h1>
          <p className="text-white/40 text-sm mb-6">
            Sponsorship opportunities at leading live conferences worldwide
          </p>

          {/* Search + filters row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => updateSearch(e.target.value)}
                placeholder="Search by name, city..."
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* Location */}
            <select
              value={country}
              onChange={e => updateCountry(e.target.value)}
              className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
            >
              {COUNTRIES.map(c => (
                <option key={c.value} value={c.value} className="bg-[#0d0d14]">{c.label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => updateSort(e.target.value)}
              className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all ml-auto"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-[#0d0d14]">{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Count */}
        <p className="text-xs text-white/30 mb-6 font-mono uppercase tracking-wider">
          {loading ? 'Loading...' : `${total} event${total !== 1 ? 's' : ''}`}
        </p>

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-6 animate-pulse glass"
                style={{ height: '196px' }}
              >
                <div className="h-1 w-10 rounded-full bg-white/10 mb-5" />
                <div className="h-4 w-2/3 rounded bg-white/10 mb-2" />
                <div className="h-3 w-full rounded bg-white/[0.06] mb-1" />
                <div className="h-3 w-4/5 rounded bg-white/[0.06]" />
              </div>
            ))}
          </div>
        )}

        {/* API offline */}
        {!loading && apiError && (
          <div className="text-center py-28">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400/70">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">Could not connect to API</h3>
            <p className="text-sm text-white/40 mb-2">Make sure the API server is running on port 3001.</p>
            <p className="text-xs text-white/25 mb-6 font-mono">cd apps/api &amp;&amp; pnpm dev</p>
            <button
              onClick={loadEvents}
              className="btn-ghost text-sm px-4 py-2 border border-white/10"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !apiError && events.length === 0 && (
          <div className="text-center py-28">
            <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">No events found</h3>
            <p className="text-sm text-white/40 mb-6">
              Try different search terms or clear the location filter.
            </p>
            <button
              onClick={() => { updateSearch(''); updateCountry(''); }}
              className="btn-ghost text-sm px-4 py-2 border border-white/10"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <EventCard key={event.id} event={event} isAuthed={isAuthed} onAuthRequired={handleAuthRequired} />
            ))}
          </div>
        )}
      </div>

      {/* Auth modal */}
      {authModalReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeAuthModal}
          />
          {/* Modal */}
          <div className="relative z-10 w-full max-w-sm mx-4 bg-[#13131f] border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Sign in to view sponsorship packages</h2>
            <p className="text-sm text-white/40 mb-6 leading-relaxed">
              Discover and bid on exclusive sponsorship packages from the world's best conferences.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href={`/login?return=${encodeURIComponent(authModalReturn)}`}
                onClick={() => track({ eventType: 'browse_auth_modal_cta_clicked', metadata: { action: 'signin' } })}
                className="w-full text-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Sign In
              </a>
              <button
                onClick={() => {
                  track({ eventType: 'browse_auth_modal_cta_clicked', metadata: { action: 'guest' } });
                  closeAuthModal();
                  router.push(authModalReturn);
                }}
                className="w-full px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.10] text-white/70 hover:text-white text-sm rounded-lg transition-colors border border-white/[0.08]"
              >
                Browse as guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen mesh-bg" />}>
      <BrowsePageInner />
    </Suspense>
  );
}

function EventCard({ event, isAuthed, onAuthRequired }: { event: Event; isAuthed: boolean; onAuthRequired: (returnPath: string) => void }) {
  const accent = event.branding?.primaryColor ?? '#4361ee';
  const dateStr = event.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const returnPath = `/${event.tenant.slug}/${event.slug}`;

  function handleClick() {
    track({ eventType: 'package_viewed', metadata: { eventSlug: event.slug, tenantSlug: event.tenant.slug, source: 'browse' } });
  }

  const cardContent = (
    <>
      {/* Accent bar */}
      <div className="h-0.5 w-10 rounded-full mb-5 transition-all group-hover:w-16" style={{ background: accent }} />

      <h3 className="font-bold text-white text-lg mb-1.5 line-clamp-1 group-hover:text-indigo-300 transition-colors">
        {event.name}
      </h3>
      {event.tagline && (
        <p className="text-sm text-white/40 line-clamp-2 mb-4 leading-relaxed">{event.tagline}</p>
      )}

      <div className="flex items-end justify-between mt-auto pt-3 border-t border-white/[0.06]">
        <div className="space-y-0.5">
          {(event.city || event.country) && (
            <p className="text-xs text-white/35 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 9C5 9 1.5 6.5 1.5 4A3.5 3.5 0 018.5 4C8.5 6.5 5 9 5 9Z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              {[event.city, event.country].filter(Boolean).join(', ')}
            </p>
          )}
          {dateStr && (
            <p className="text-xs text-white/30">{dateStr}</p>
          )}
        </div>
        <div
          className="text-xs font-mono px-2 py-1 rounded-md"
          style={{ color: accent, backgroundColor: `${accent}18`, border: `1px solid ${accent}28` }}
        >
          {event._count.sponsorItems} pkg{event._count.sponsorItems !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="mt-2 text-xs text-white/20 font-mono">{event.tenant.name}</div>
    </>
  );

  if (isAuthed) {
    return (
      <Link
        href={returnPath}
        onClick={handleClick}
        className="item-card glass rounded-xl p-6 block group"
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAuthRequired(returnPath)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onAuthRequired(returnPath); }}
      className="item-card glass rounded-xl p-6 block group cursor-pointer"
    >
      {cardContent}
    </div>
  );
}
