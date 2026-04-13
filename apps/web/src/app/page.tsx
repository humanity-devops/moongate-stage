import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { EarlyAccessForm } from '@/components/site/EarlyAccessForm';

export const metadata: Metadata = {
  title: 'Stage by Moongate — Sponsorship Marketplace for Live Events',
  description:
    'Stage by Moongate connects sponsors with the most impactful live conferences, hackathons, and summits. Discover packages, propose custom deals, and close sponsorships faster.',
};

// Fetch featured events server-side
async function getFeaturedEvents() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${API_URL}/api/public/events?sort=startDate&pageSize=6`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

type Event = {
  id: string;
  name: string;
  tagline?: string;
  city?: string;
  country?: string;
  startDate?: string;
  slug: string;
  tenant: { slug: string };
  branding?: { primaryColor?: string };
  _count?: { sponsorItems: number };
};

const VALUE_PROPS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L17 5.5V10.5C17 14.09 13.87 17.5 10 18C6.13 17.5 3 14.09 3 10.5V5.5L10 2Z" stroke="#4361ee" strokeWidth="1.5" fill="rgba(67,97,238,0.15)" />
        <path d="M7 10L9 12L13 8" stroke="#4361ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Verified events only',
    body: 'Every event goes through an approval process. Sponsors reach real audiences at real conferences.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 6H16M4 10H16M4 14H10" stroke="#4361ee" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="12" y="11" width="6" height="6" rx="1" stroke="#c9a227" strokeWidth="1.5" fill="rgba(201,162,39,0.15)" />
      </svg>
    ),
    title: 'Custom package builder',
    body: 'Propose bespoke sponsorship bundles. Mix and match assets, set your budget, submit in minutes.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="#4361ee" strokeWidth="1.5" fill="rgba(67,97,238,0.1)" />
        <path d="M10 6V10L13 12" stroke="#4361ee" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Fast decisions',
    body: 'Organizers review counter-offers in real time. Most proposals get a response within 6 hours.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4H17V14H3V4Z" stroke="#4361ee" strokeWidth="1.5" fill="rgba(67,97,238,0.1)" />
        <path d="M7 17H13" stroke="#4361ee" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 14V17" stroke="#4361ee" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Full analytics',
    body: 'Track impressions, clicks, and conversions. Measure ROI across every sponsored event.',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Browse events', body: 'Filter by date, location, audience size, or category. Find the right conferences for your brand.' },
  { step: '02', title: 'Build your package', body: 'Use our drag-and-drop builder to assemble a custom sponsorship bundle, or pick from existing tiers.' },
  { step: '03', title: 'Submit & negotiate', body: 'Submit your proposal. Organizers review, counter-offer, or approve — all in one thread.' },
  { step: '04', title: 'Activate', body: 'Once accepted, access your order details, invoices, and event onboarding materials in your dashboard.' },
];

const SOCIAL_PROOF = [
  { name: 'ETHDenver Steward 2025', role: 'ETHDenver', quote: 'It was great working with Moongate. They designed and implemented a ticketing solution that integrates with Unicorn wallets to drive ETHDenver account creation and enable new opportunities for onchain engagement at conferences.' },
  { name: 'Momori Hirabayashi', role: 'Jai by OneSiam', quote: 'Moongate powers our membership program, enabling Jai by OneSiam to build a vibrant community and offer exclusive experiences. Its reliable and intuitive platform demonstrates how NFT technology can be easily embraced by the public.' },
  { name: 'Peter Noszek', role: 'TOKEN2049', quote: 'Moongate seamlessly integrated all immersive experiences onto one platform. This engagement encouraged attendees to explore the venue, interact with vendors, and help regulate crowds.' },
];

export default async function LandingPage() {
  const events = await getFeaturedEvents() as Event[];

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader variant="transparent" />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden mesh-bg noise-overlay">
        {/* Grid lines */}
        <div className="absolute inset-0 grid-lines opacity-40 pointer-events-none" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Now in early access — Live events only
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
            New-era for brand engagement<br />
            <span className="text-gradient">at live events.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Stage by Moongate connects sponsors with the most impactful live conferences, hackathons, and summits.
            Build custom packages, submit proposals, and close deals — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/browse" className="btn-primary px-8 py-3.5 text-base">
              Browse Events
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-1">
                <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/#early-access" className="btn-ghost px-8 py-3.5 text-base border border-white/10">
              Get early access
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-16 pt-10 border-t border-white/[0.06] grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: '50+', label: 'Events live' },
              { value: '$2M+', label: 'Deals closed' },
              { value: '6hrs', label: 'Avg. response' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-display font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Events ───────────────────────────────────── */}
      {events.length > 0 && (
        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-2">Upcoming</p>
                <h2 className="font-display text-3xl font-bold">Live opportunities</h2>
              </div>
              <Link href="/browse" className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1">
                View all
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/${event.tenant.slug}/${event.slug}/sponsor`}
                  className="item-card glass rounded-xl p-5 group hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: `${event.branding?.primaryColor ?? '#4361ee'}20`,
                        color: event.branding?.primaryColor ?? '#4361ee',
                        border: `1px solid ${event.branding?.primaryColor ?? '#4361ee'}30`,
                      }}
                    >
                      {event.name.charAt(0)}
                    </div>
                    {event._count && event._count.sponsorItems > 0 && (
                      <span className="text-xs text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">
                        {event._count.sponsorItems} packages
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">{event.name}</h3>
                  {event.tagline && <p className="text-sm text-white/40 line-clamp-2 mb-3">{event.tagline}</p>}
                  <div className="flex items-center gap-3 text-xs text-white/30">
                    {(event.city || event.country) && (
                      <span>{[event.city, event.country].filter(Boolean).join(', ')}</span>
                    )}
                    {event.startDate && (
                      <span>{new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Value Props ───────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">Why Moongate</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Everything you need to sponsor smarter</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUE_PROPS.map(({ icon, title, body }) => (
              <div key={title} className="glass rounded-xl p-6">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">Process</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold">From interest to activation in 4 steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div key={step} className="glass rounded-xl p-6 flex gap-5">
                <div className="text-4xl font-display font-bold text-white/10 leading-none select-none w-12 shrink-0">{step}</div>
                <div>
                  <h3 className="font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ──────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="font-display text-3xl font-bold">Trusted by Web3 teams</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOCIAL_PROOF.map(({ name, role, quote }) => (
              <div key={name} className="glass rounded-xl p-6">
                <svg width="24" height="18" viewBox="0 0 24 18" fill="none" className="mb-4 opacity-30">
                  <path d="M0 18V12C0 8.4 1.4 5.2 4.2 2.4L6 4.2C4.2 5.8 3.2 7.8 3 10H6V18H0ZM12 18V12C12 8.4 13.4 5.2 16.2 2.4L18 4.2C16.2 5.8 15.2 7.8 15 10H18V18H12Z" fill="white" />
                </svg>
                <p className="text-sm text-white/60 leading-relaxed mb-5 italic">{quote}</p>
                <div>
                  <div className="text-sm font-semibold text-white">{name}</div>
                  <div className="text-xs text-white/35 mt-0.5">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Early Access CTA ──────────────────────────────────── */}
      <section id="early-access" className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-amber-900/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto text-center">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-4">Early Access</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Be first in the{' '}
            <span className="text-gradient-gold">Web3 sponsorship</span>{' '}
            revolution.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Join the waitlist and get priority access when we open to new organizers and sponsors.
            No spam. Unsubscribe anytime.
          </p>

          <EarlyAccessForm />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
