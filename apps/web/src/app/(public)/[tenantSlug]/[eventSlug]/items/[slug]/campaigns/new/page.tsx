import type { Metadata } from 'next';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import { formatCurrency, getCategoryLabel } from '@/lib/utils';
import { CampaignForm } from '@/components/public/CampaignForm';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: { tenantSlug: string; eventSlug: string; slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: item } = await publicApi.getItem(params.tenantSlug, params.eventSlug, params.slug);
    return { title: `Start Campaign — ${item.publicTitle as string}` };
  } catch {
    return { title: 'Start Campaign' };
  }
}

export default async function NewCampaignPage({ params }: PageProps) {
  const { tenantSlug, eventSlug, slug } = params;

  let item: Record<string, unknown> = {};
  let event: Record<string, unknown> = {};

  try {
    const [itemRes, eventRes] = await Promise.all([
      publicApi.getItem(tenantSlug, eventSlug, slug),
      publicApi.getEvent(tenantSlug, eventSlug),
    ]);
    item = itemRes.data;
    event = eventRes.data;
  } catch {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Package not found</h1>
          <Link href={`/${tenantSlug}/${eventSlug}/sponsor`} className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors">
            ← Back to packages
          </Link>
        </div>
      </div>
    );
  }

  if (item.status === 'sold_out') {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Package Unavailable</h1>
          <p className="font-sans text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            This package is sold out and no longer accepting campaigns.
          </p>
          <Link href={`/${tenantSlug}/${eventSlug}/items/${slug}`} className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors">
            ← Back to package
          </Link>
        </div>
      </div>
    );
  }

  const listPrice = item.listPrice ? Number(item.listPrice) : null;

  return (
    <div className="min-h-screen bg-void">
      {/* Nav bar */}
      <div className="px-6 md:px-10 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link
            href={`/${tenantSlug}/${eventSlug}/items/${slug}`}
            className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <ArrowLeft className="w-3 h-3" />
            {item.publicTitle as string}
          </Link>
          <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span className="font-mono text-[11px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Start Campaign
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left: context */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 space-y-6">
              <div>
                <p className="font-mono text-[11px] tracking-[0.35em] uppercase mb-4" style={{ color: '#7b93f8' }}>
                  Community Crowdfund
                </p>
                <h1 className="font-display text-3xl font-bold text-white mb-3">
                  Start a Campaign
                </h1>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Rally your community to fund this sponsorship. The first campaign to reach the goal wins the package.
                </p>
              </div>

              {/* Package card */}
              <div className="p-6" style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: '#7b93f8' }}>
                  {getCategoryLabel(item.category as string)}
                </span>
                <h3 className="font-display text-lg font-bold text-white mb-2">
                  {item.publicTitle as string}
                </h3>
                {!!item.shortDescription && (
                  <p className="font-sans text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {item.shortDescription as string}
                  </p>
                )}
                {listPrice && (
                  <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Funding Goal
                    </p>
                    <p className="font-mono text-2xl font-semibold text-white">
                      {formatCurrency(listPrice, item.currency as string)}
                    </p>
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="space-y-3">
                {[
                  ['01', 'Launch your campaign with a deadline of up to 30 days.'],
                  ['02', 'Share with your community — they pledge contributions.'],
                  ['03', 'First campaign to reach the goal wins the sponsorship.'],
                  ['04', 'If you win, the organizers are notified and payment is arranged.'],
                ].map(([n, text]) => (
                  <div key={n} className="flex items-baseline gap-3">
                    <span className="font-mono text-xs flex-shrink-0" style={{ color: 'rgba(67,97,238,0.5)' }}>{n}</span>
                    <span className="font-sans text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-3">
            <CampaignForm
              tenantSlug={tenantSlug}
              eventSlug={eventSlug}
              itemSlug={slug}
              itemTitle={item.publicTitle as string}
              listPrice={listPrice}
              currency={item.currency as string ?? 'USD'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
