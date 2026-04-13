import type { Metadata } from 'next';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import { ItemCard } from '@/components/public/ItemCard';
import { ItemFilters } from '@/components/public/ItemFilters';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: { tenantSlug: string; eventSlug: string };
  searchParams: { category?: string; mode?: string; access_token?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: event } = await publicApi.getEvent(params.tenantSlug, params.eventSlug);
    return { title: `Sponsor Packages — ${event.name as string}` };
  } catch {
    return { title: 'Sponsor Packages' };
  }
}

export default async function SponsorPage({ params, searchParams }: PageProps) {
  const { tenantSlug, eventSlug } = params;

  let event: Record<string, unknown> = {};
  let items: unknown[] = [];

  const accessToken = searchParams.access_token;
  const extraParams: Record<string, string> = accessToken ? { access_token: accessToken } : {};

  try {
    const [eventRes, itemsRes] = await Promise.all([
      publicApi.getEvent(tenantSlug, eventSlug, extraParams),
      publicApi.getItems(tenantSlug, eventSlug, {
        ...(searchParams.category ? { category: searchParams.category } : {}),
        ...(searchParams.mode ? { mode: searchParams.mode } : {}),
        ...extraParams,
        pageSize: '50',
      }),
    ]);
    event = eventRes.data;
    items = itemsRes.data;
  } catch (err) {
    const apiErr = err as Error & { status?: number; code?: string };
    if (apiErr.status === 403) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#06060a' }}>
          <div className="text-center max-w-md px-6">
            <div className="text-5xl mb-6">🔒</div>
            <h1 className="text-2xl font-bold text-white mb-3">Private Event</h1>
            <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
              This sponsorship page is private. You need an invitation link to access it.
            </p>
            <p className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              If you have a link, please use it to access this page.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Event not found</p>
      </div>
    );
  }

  const categories = Array.from(new Set(items.map(i => (i as Record<string, unknown>).category as string)));
  const isFiltered = !!(searchParams.category || searchParams.mode);

  return (
    <div className="min-h-screen bg-void">
      {/* Page header */}
      <div
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}
        className="px-6 md:px-10 py-10"
      >
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-3 mb-8">
            <Link
              href={`/${tenantSlug}/${eventSlug}`}
              className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase transition-colors hover:text-white"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <ArrowLeft className="w-3 h-3" />
              {event.name as string}
            </Link>
            <span
              className="font-mono text-[11px]"
              style={{ color: 'rgba(255,255,255,0.15)' }}
            >
              /
            </span>
            <span
              className="font-mono text-[11px] tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Packages
            </span>
          </nav>

          <div className="flex items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2">
                Sponsorship Packages
              </h1>
              <p
                className="font-mono text-[11px] tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {items.length} opportunit{items.length !== 1 ? 'ies' : 'y'}
                {isFiltered ? ' — filtered' : ' available'}
              </p>
            </div>
            <Link
              href={`/${tenantSlug}/${eventSlug}/propose`}
              className="shrink-0 flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 2V12M2 7H12" strokeLinecap="round" />
              </svg>
              Custom proposal
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar */}
          <aside className="w-full lg:w-56 flex-shrink-0">
            <ItemFilters
              categories={categories}
              selectedCategory={searchParams.category}
              selectedMode={searchParams.mode}
              tenantSlug={tenantSlug}
              eventSlug={eventSlug}
            />

            {/* Compare widget */}
            <div
              className="mt-10 p-5"
              style={{
                background: '#0d0d14',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h3
                className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                Compare
              </h3>
              <p
                className="font-sans text-xs mb-4 leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                See all benefits side by side
              </p>
              <Link
                href={`/${tenantSlug}/${eventSlug}/compare`}
                className="block w-full text-center font-mono text-[10px] tracking-[0.2em] uppercase py-2.5 transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                Open Comparison →
              </Link>
            </div>
          </aside>

          {/* Items grid */}
          <main className="flex-1 min-w-0">
            {items.length === 0 ? (
              <div className="py-24 text-center">
                <p
                  className="font-sans text-base mb-4"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  No packages match the current filters.
                </p>
                <Link
                  href={`/${tenantSlug}/${eventSlug}/sponsor`}
                  className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Clear all filters →
                </Link>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                {items.map((item, i) => (
                  <ItemCard
                    key={(item as Record<string, unknown>).id as string}
                    item={item as Record<string, unknown>}
                    tenantSlug={tenantSlug}
                    eventSlug={eventSlug}
                    animationDelay={Math.min(i * 50, 400)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
