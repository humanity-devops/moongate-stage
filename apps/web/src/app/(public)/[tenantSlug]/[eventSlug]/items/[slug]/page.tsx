import type { Metadata } from 'next';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import { formatCurrency, getCategoryLabel, getModeLabel, getItemsRemaining } from '@/lib/utils';
import { BenefitsTable } from '@/components/public/BenefitsTable';
import { CampaignCard } from '@/components/public/CampaignCard';
import { ArrowLeft, Zap, Lock, AlertTriangle, CheckCircle2, Users, ArrowRight } from 'lucide-react';

interface PageProps {
  params: { tenantSlug: string; eventSlug: string; slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: item } = await publicApi.getItem(params.tenantSlug, params.eventSlug, params.slug);
    return {
      title: `${item.publicTitle} — Sponsorship`,
      description: item.shortDescription as string,
    };
  } catch {
    return { title: 'Sponsorship Package' };
  }
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { tenantSlug, eventSlug, slug } = params;

  let item: Record<string, unknown>;
  let event: Record<string, unknown>;
  let campaigns: import('@/lib/api').CrowdfundCampaign[] = [];

  try {
    const [itemRes, eventRes] = await Promise.all([
      publicApi.getItem(tenantSlug, eventSlug, slug),
      publicApi.getEvent(tenantSlug, eventSlug),
    ]);
    item = itemRes.data;
    event = eventRes.data;

    try {
      const campaignsRes = await publicApi.getCampaigns(tenantSlug, eventSlug, slug);
      campaigns = campaignsRes.data;
    } catch { /* non-critical — campaigns may not exist yet */ }
  } catch {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Package not found</h1>
          <Link
            href={`/${tenantSlug}/${eventSlug}/sponsor`}
            className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors"
          >
            ← Back to packages
          </Link>
        </div>
      </div>
    );
  }

  const isSoldOut = item.status === 'sold_out';
  const isExclusive = item.isExclusive as boolean;
  const isFeatured = item.featured as boolean;
  const remaining = getItemsRemaining(item as { quantityTotal?: number; quantitySold?: number });
  const benefits = (item.benefits as unknown[]) ?? [];
  const mode = item.mode as string;
  const listPrice = item.listPrice as number | null;

  return (
    <div className="min-h-screen bg-void">
      {/* Top navigation bar */}
      <div
        className="px-6 md:px-10 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link
            href={`/${tenantSlug}/${eventSlug}/sponsor`}
            className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <ArrowLeft className="w-3 h-3" />
            {event.name as string}
          </Link>
          <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <Link
            href={`/${tenantSlug}/${eventSlug}/sponsor`}
            className="font-mono text-[11px] tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Packages
          </Link>
          <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span
            className="font-mono text-[11px] tracking-widest uppercase truncate max-w-xs"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {item.publicTitle as string}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-14">
          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-10">
            {/* Header section */}
            <div>
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span
                  className="font-mono text-[11px] tracking-[0.3em] uppercase"
                  style={{ color: '#7b93f8' }}
                >
                  {getCategoryLabel(item.category as string)}
                </span>
                {isFeatured && (
                  <span
                    className="font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1"
                    style={{
                      background: 'rgba(201,162,39,0.1)',
                      border: '1px solid rgba(201,162,39,0.25)',
                      color: '#e0b83e',
                    }}
                  >
                    Featured
                  </span>
                )}
                {isExclusive && (
                  <span
                    className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1"
                    style={{
                      background: 'rgba(168,85,247,0.1)',
                      border: '1px solid rgba(168,85,247,0.2)',
                      color: 'rgba(216,180,254,0.8)',
                    }}
                  >
                    <Lock className="w-2.5 h-2.5" />
                    Exclusive
                  </span>
                )}
                {isSoldOut && (
                  <span
                    className="font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: 'rgba(252,165,165,0.75)',
                    }}
                  >
                    {item.soldBadgeText as string || 'Sold Out'}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1
                className="font-display font-bold text-white leading-tight mb-5"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
              >
                {item.publicTitle as string}
              </h1>

              {/* Short description */}
              {!!item.shortDescription && (
                <p
                  className="font-sans text-lg leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  {item.shortDescription as string}
                </p>
              )}
            </div>

            {/* Long description */}
            {!!item.longDescription && (
              <div
                className="p-8"
                style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p
                  className="font-sans text-base leading-loose whitespace-pre-line"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  {item.longDescription as string}
                </p>
              </div>
            )}

            {/* Benefits */}
            {benefits.length > 0 && (
              <div>
                <h2 className="font-display text-2xl font-bold text-white mb-6">
                  What&apos;s Included
                </h2>
                <BenefitsTable benefits={benefits as Record<string, unknown>[]} />
              </div>
            )}

            {/* Delivery notes */}
            {!!item.deliveryNotes && (
              <div
                className="p-6"
                style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <h3
                  className="font-mono text-[10px] tracking-[0.3em] uppercase mb-3"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  Delivery Notes
                </h3>
                <p
                  className="font-sans text-sm leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {item.deliveryNotes as string}
                </p>
              </div>
            )}

            {/* ── Crowdfunding campaigns ── */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="font-mono text-[11px] tracking-[0.35em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Community Funding
                  </p>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Active Campaigns
                  </h2>
                </div>
                {!isSoldOut && (
                  <Link
                    href={`/${tenantSlug}/${eventSlug}/items/${slug}/campaigns/new`}
                    className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase transition-colors hover:text-brand-400"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    Start Campaign
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {campaigns.length === 0 ? (
                <div
                  className="p-10 text-center"
                  style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Users className="w-8 h-8 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <p className="font-sans text-sm mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    No campaigns yet for this package.
                  </p>
                  {!isSoldOut && (
                    <Link
                      href={`/${tenantSlug}/${eventSlug}/items/${slug}/campaigns/new`}
                      className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      Be the first to start a campaign →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {campaigns.map(c => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      tenantSlug={tenantSlug}
                      eventSlug={eventSlug}
                      itemSlug={slug}
                    />
                  ))}
                </div>
              )}

              {campaigns.length > 0 && !isSoldOut && (
                <div className="mt-4 text-center">
                  <Link
                    href={`/${tenantSlug}/${eventSlug}/items/${slug}/campaigns/new`}
                    className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    + Start your own campaign
                  </Link>
                </div>
              )}
            </div>

            {/* Privacy note */}
            {(mode === 'sealed_bid' || mode === 'hybrid' || mode === 'request_only') && (
              <div
                className="flex items-start gap-4 p-6"
                style={{
                  background: 'rgba(67,97,238,0.05)',
                  border: '1px solid rgba(67,97,238,0.15)',
                }}
              >
                <Lock className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4
                    className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2"
                    style={{ color: 'rgba(123,147,248,0.8)' }}
                  >
                    Private & Confidential
                  </h4>
                  <p
                    className="font-sans text-sm leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    Your offer is completely private. Only the event organizers can see your bid —
                    no other sponsors will know your position or proposed amount.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div>
            <div
              className="sticky top-8"
              style={{
                background: '#0d0d14',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Featured gold bar */}
              {isFeatured && (
                <div
                  className="h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, #c9a227, transparent)' }}
                />
              )}

              <div className="p-7 space-y-6">
                {/* Availability badge */}
                {remaining !== null && !isSoldOut && (
                  <div
                    className="flex items-center gap-3 p-4"
                    style={
                      remaining <= 2
                        ? {
                            background: 'rgba(249,115,22,0.08)',
                            border: '1px solid rgba(249,115,22,0.2)',
                          }
                        : {
                            background: 'rgba(34,197,94,0.07)',
                            border: '1px solid rgba(34,197,94,0.18)',
                          }
                    }
                  >
                    {remaining <= 2 ? (
                      <AlertTriangle
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: 'rgba(253,186,116,0.8)' }}
                      />
                    ) : (
                      <CheckCircle2
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: 'rgba(134,239,172,0.7)' }}
                      />
                    )}
                    <span
                      className="font-mono text-xs tracking-wide"
                      style={
                        remaining <= 2
                          ? { color: 'rgba(253,186,116,0.8)' }
                          : { color: 'rgba(134,239,172,0.7)' }
                      }
                    >
                      {remaining <= 2
                        ? `Only ${remaining} slot${remaining !== 1 ? 's' : ''} remaining`
                        : `${remaining} slots available`}
                    </span>
                  </div>
                )}

                {/* Price block */}
                <div>
                  <div
                    className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    {mode === 'sealed_bid' ? 'Starting from' : 'Package price'}
                  </div>

                  {mode === 'request_only' || item.onRequest ? (
                    <span
                      className="font-sans font-medium text-lg"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      Price on request
                    </span>
                  ) : listPrice ? (
                    <div
                      className="font-mono text-4xl font-semibold text-white tabular-nums"
                    >
                      {formatCurrency(listPrice, item.currency as string)}
                    </div>
                  ) : (
                    <span
                      className="font-sans font-medium text-lg"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      Private offer only
                    </span>
                  )}

                  <div
                    className="font-mono text-[10px] tracking-[0.25em] uppercase mt-2"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    {getModeLabel(mode)}
                  </div>
                </div>

                {/* Inventory bar */}
                {!!item.quantityTotal && (
                  <div>
                    <div
                      className="h-px mb-1"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    />
                    <div className="flex justify-between items-center py-2.5">
                      <span
                        className="font-mono text-[10px] tracking-widest uppercase"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                      >
                        Slots
                      </span>
                      <span
                        className="font-mono text-xs"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                      >
                        {remaining !== null ? remaining : '—'} / {item.quantityTotal as number} available
                      </span>
                    </div>
                    <div
                      className="h-px"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    />
                  </div>
                )}

                {/* CTA buttons */}
                <div className="space-y-3">
                  {isSoldOut ? (
                    <button
                      disabled
                      className="w-full py-4 font-sans font-semibold cursor-not-allowed"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {item.soldBadgeText as string || 'Sold Out'}
                    </button>
                  ) : (
                    <>
                      {(mode === 'fixed_price' || mode === 'hybrid') && (
                        <Link
                          href={`/${tenantSlug}/${eventSlug}/checkout/${slug}`}
                          className="block w-full text-center py-4 font-sans font-semibold text-white transition-all duration-200"
                          style={{ background: '#4361ee' }}
                        >
                          Buy Now →
                        </Link>
                      )}
                      {(mode === 'sealed_bid' || mode === 'hybrid' || mode === 'request_only') && (
                        <Link
                          href={`/${tenantSlug}/${eventSlug}/bid/${slug}`}
                          className="flex items-center justify-center gap-2.5 w-full py-4 font-sans font-semibold text-white transition-all duration-200"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <Zap className="w-4 h-4" />
                          {mode === 'request_only' ? 'Request Package' : 'Submit Private Offer'}
                        </Link>
                      )}
                    </>
                  )}
                </div>

                {/* Contact link */}
                <p
                  className="font-mono text-[10px] tracking-wide text-center"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  Questions?{' '}
                  <Link
                    href={`/${tenantSlug}/${eventSlug}/contact`}
                    className="text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Contact our team →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
