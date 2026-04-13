import type { Metadata } from 'next';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import { BidForm } from '@/components/public/BidForm';
import { formatCurrency, getCategoryLabel } from '@/lib/utils';
import { ArrowLeft, Lock } from 'lucide-react';

interface PageProps {
  params: { tenantSlug: string; eventSlug: string; itemSlug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: item } = await publicApi.getItem(params.tenantSlug, params.eventSlug, params.itemSlug);
    return { title: `Submit Private Offer — ${item.publicTitle as string}` };
  } catch {
    return { title: 'Submit Private Offer' };
  }
}

export default async function BidPage({ params }: PageProps) {
  const { tenantSlug, eventSlug, itemSlug } = params;

  let item: Record<string, unknown> = {};
  let event: Record<string, unknown> = {};

  try {
    const [itemRes, eventRes] = await Promise.all([
      publicApi.getItem(tenantSlug, eventSlug, itemSlug),
      publicApi.getEvent(tenantSlug, eventSlug),
    ]);
    item = itemRes.data;
    event = eventRes.data;
  } catch {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Item not found</h1>
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

  const benefits = (item.benefits as unknown[]) ?? [];

  return (
    <div className="min-h-screen bg-void">
      {/* Nav bar */}
      <div
        className="px-6 md:px-10 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3">
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
            href={`/${tenantSlug}/${eventSlug}/items/${itemSlug}`}
            className="font-mono text-[11px] tracking-widest uppercase transition-colors hover:text-white truncate max-w-xs"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            {item.publicTitle as string}
          </Link>
          <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span
            className="font-mono text-[11px] tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Private Offer
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Package summary */}
          <div>
            <div
              className="sticky top-8 p-8"
              style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span
                className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-4"
                style={{ color: '#7b93f8' }}
              >
                {getCategoryLabel(item.category as string)}
              </span>

              <h2 className="font-display text-2xl font-bold text-white mb-3">
                {item.publicTitle as string}
              </h2>

              {!!item.shortDescription && (
                <p
                  className="font-sans text-sm leading-relaxed mb-6"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {item.shortDescription as string}
                </p>
              )}

              {!!item.listPrice && (
                <div
                  className="flex items-center justify-between p-4 mb-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div>
                    <div
                      className="font-mono text-[10px] tracking-widest uppercase mb-1"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      Listed price
                    </div>
                    <div className="font-mono text-2xl font-semibold text-white tabular-nums">
                      {formatCurrency(item.listPrice as number, item.currency as string)}
                    </div>
                  </div>
                  <span
                    className="font-mono text-[10px] tracking-widest uppercase"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    Submit your offer →
                  </span>
                </div>
              )}

              {benefits.length > 0 && (
                <div className="mb-6">
                  <h3
                    className="font-mono text-[10px] tracking-[0.3em] uppercase mb-3"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    What&apos;s included
                  </h3>
                  <div className="space-y-2.5">
                    {(benefits as Record<string, unknown>[]).map((b, i) => (
                      <div key={i} className="flex items-baseline gap-2.5 text-sm">
                        <span
                          className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: 'rgba(67,97,238,0.5)' }}
                        />
                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {b.label as string}
                          {b.value ? (
                            <span className="font-mono text-xs ml-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              — {b.value as string}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy notice */}
              <div
                className="flex items-start gap-3 p-4"
                style={{
                  background: 'rgba(67,97,238,0.05)',
                  border: '1px solid rgba(67,97,238,0.12)',
                }}
              >
                <Lock
                  className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                  style={{ color: 'rgba(123,147,248,0.7)' }}
                />
                <div>
                  <p
                    className="font-mono text-[10px] tracking-[0.2em] uppercase mb-1.5"
                    style={{ color: 'rgba(123,147,248,0.7)' }}
                  >
                    Private & Confidential
                  </p>
                  <p
                    className="font-sans text-xs leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    Only the event organizers see your offer. No other sponsors know your position or amount.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div>
            <div className="mb-8">
              <p
                className="font-mono text-[11px] tracking-[0.35em] uppercase mb-4"
                style={{ color: '#7b93f8' }}
              >
                Private Offer
              </p>
              <h1 className="font-display text-4xl font-bold text-white mb-3">
                Submit Your Offer
              </h1>
              <p
                className="font-sans text-sm leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Tell us about your company and what you&apos;d like to offer.
                Our team reviews each bid and responds within 2 business days.
              </p>
            </div>

            <BidForm
              tenantSlug={tenantSlug}
              eventSlug={eventSlug}
              itemSlug={itemSlug}
              listPrice={item.listPrice as number | null}
              minimumBid={item.minimumBid as number | null}
              maximumBid={item.maximumBid as number | null}
              currency={item.currency as string}
              mode={item.mode as string}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
