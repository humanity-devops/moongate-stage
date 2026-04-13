import type { Metadata } from 'next';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { ItemCard } from '@/components/public/ItemCard';
import { EventHero } from '@/components/public/EventHero';
import { StatsSection } from '@/components/public/StatsSection';
import { ArrowRight, Target, Globe, Radio } from 'lucide-react';

interface PageProps {
  params: { tenantSlug: string; eventSlug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: event } = await publicApi.getEvent(params.tenantSlug, params.eventSlug);
    return {
      title: `Sponsor ${event.name as string}`,
      description: event.tagline as string,
    };
  } catch {
    return { title: 'Event Sponsorship' };
  }
}

export default async function EventSponsorPage({ params }: PageProps) {
  const { tenantSlug, eventSlug } = params;

  let event: Record<string, unknown>;
  let featuredItems: unknown[] = [];
  let stats: Record<string, unknown> | null = null;

  try {
    const eventRes = await publicApi.getEvent(tenantSlug, eventSlug);
    event = eventRes.data;
    stats = (event.stats as Record<string, unknown>) ?? null;

    const itemsRes = await publicApi.getItems(tenantSlug, eventSlug, { featured: 'true', pageSize: '6' });
    featuredItems = itemsRes.data;
  } catch (e) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Event not found</h1>
          <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            This event doesn&apos;t exist or is not yet published.
          </p>
        </div>
      </div>
    );
  }

  const whySponsorPoints = [
    {
      icon: Target,
      title: 'Targeted Audience',
      desc: 'Developers, founders, VCs, and ecosystem builders — the people building the future of Web3.',
    },
    {
      icon: Globe,
      title: 'International Reach',
      desc: `${stats?.internationalPct ?? 60}% of attendees travel internationally, bringing unparalleled global network value.`,
    },
    {
      icon: Radio,
      title: 'Extended Impact',
      desc: `${formatNumber((stats?.mediaReach as number) ?? 50000)} media reach and ${formatNumber((stats?.newsletterSubs as number) ?? 8500)} newsletter subscribers amplify your visibility.`,
    },
  ];

  return (
    <div className="min-h-screen bg-void">
      <EventHero event={event} tenantSlug={tenantSlug} eventSlug={eventSlug} />

      {stats && <StatsSection stats={stats} />}

      {/* Why sponsor section */}
      <section className="py-28 px-6 max-w-7xl mx-auto">
        <div className="mb-16">
          <p
            className="font-mono text-[11px] tracking-[0.4em] uppercase mb-4"
            style={{ color: '#7b93f8' }}
          >
            Why Sponsor
          </p>
          <h2 className="font-display text-5xl md:text-6xl font-bold text-white leading-tight">
            Sponsor {event.name as string}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {whySponsorPoints.map((item, i) => (
            <div
              key={item.title}
              className="p-8 md:p-10 animate-fade-in-up"
              style={{ background: '#0d0d14', animationDelay: `${i * 120}ms` }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center mb-6"
                style={{ border: '1px solid rgba(67,97,238,0.2)', background: 'rgba(67,97,238,0.07)' }}
              >
                <item.icon className="w-5 h-5 text-brand-400" />
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="font-sans text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured packages */}
      {featuredItems.length > 0 && (
        <section className="pb-28 px-6 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p
                className="font-mono text-[11px] tracking-[0.4em] uppercase mb-4"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                Handpicked
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
                Featured Packages
              </h2>
            </div>
            <Link
              href={`/${tenantSlug}/${eventSlug}/sponsor`}
              className="hidden md:flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase transition-colors hover:text-brand-400"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {featuredItems.map((item, i) => (
              <ItemCard
                key={(item as Record<string, unknown>).id as string}
                item={item as Record<string, unknown>}
                tenantSlug={tenantSlug}
                eventSlug={eventSlug}
                animationDelay={i * 80}
              />
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link
              href={`/${tenantSlug}/${eventSlug}/sponsor`}
              className="btn-ghost inline-flex text-sm"
            >
              View All Packages
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* CTA section */}
      <section className="py-28 px-6">
        <div
          className="max-w-4xl mx-auto p-16 text-center relative overflow-hidden"
          style={{ border: '1px solid rgba(67,97,238,0.15)', background: 'rgba(67,97,238,0.04)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(67,97,238,0.08) 0%, transparent 70%)',
            }}
          />
          <p
            className="relative font-mono text-[11px] tracking-[0.4em] uppercase mb-6"
            style={{ color: 'rgba(67,97,238,0.7)' }}
          >
            Get Started
          </p>
          <h2 className="relative font-display text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Ready to Sponsor?
          </h2>
          <p
            className="relative font-sans text-lg mb-10 max-w-md mx-auto leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Browse all packages, submit a private offer, or get in touch with our sponsorship team.
          </p>
          <div className="relative flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${tenantSlug}/${eventSlug}/sponsor`} className="btn-primary group">
              Browse All Packages
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href={`/${tenantSlug}/${eventSlug}/contact`} className="btn-ghost">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
