import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How It Works — Stage by Moongate',
  description: 'Learn how Stage by Moongate works for event organisers and sponsors. Step-by-step guide to listing your event, uploading your deck, and managing sponsorship deals.',
};

const SPONSOR_STEPS = [
  { n: '01', title: 'Browse Events', body: 'Browse all in-event brand activations that suit your goals. Filter by audience, location, and category.' },
  { n: '02', title: 'Submit Your Offer', body: 'Purchase offers instantly, submit your best price, crowdfund with your community, or build your own sponsorship package using drag & drop — then submit it for proposal.' },
  { n: '03', title: 'Close & Activate', body: 'Accept or counter offer, complete onboarding & KYC, review contracts, set up co-marketing tasks, and pay in crypto or fiat with a custom invoice.' },
  { n: '04', title: 'Post-Deal Management & Activation Analytics', body: 'Track deal performance, access activation analytics, and manage deliverables from your sponsor dashboard.' },
];

const ORGANISER_STEPS = [
  {
    n: '01',
    title: 'Create your account',
    body: 'Complete a short application to get your organiser account set up. We review each organiser to ensure quality for sponsors.',
  },
  {
    n: '02',
    title: 'Upload your sponsorship deck',
    body: 'Drop in your existing PDF. Our system extracts packages, pricing, and deliverables automatically — no manual data entry.',
  },
  {
    n: '03',
    title: 'Review your listing',
    body: 'Check the extracted packages in your admin portal. Add a hero image, set access controls, configure KYC requirements, then publish.',
    link: { label: 'Preview admin portal →', href: '/auth/login' },
  },
  {
    n: '04',
    title: 'Manage inbound proposals',
    body: 'Sponsors find your event, select packages, and submit proposals. You receive notifications and can respond from the bids dashboard.',
  },
  {
    n: '05',
    title: 'Close deals & track performance',
    body: 'Accept proposals, issue contracts, and monitor deal velocity, package views, and conversion rates from the analytics tab.',
  },
];

const ADMIN_SECTIONS = [
  {
    icon: '▣',
    title: 'Dashboard',
    body: 'See live KPIs — active events, pending proposals, approval queue, and weekly sponsor activity — at a glance.',
  },
  {
    icon: '📅',
    title: 'Events',
    body: 'Create and manage events. Each event has its own sponsorship items, branding, and access settings.',
  },
  {
    icon: '🗳',
    title: 'Approvals',
    body: 'Review community fundraising campaigns tied to your event items. Approve, reject, or request changes.',
  },
  {
    icon: '🔑',
    title: 'Access Control',
    body: 'Set your event to public, whitelist-only, or invite-only. Manage email grants and generate one-time access links.',
  },
  {
    icon: '🛂',
    title: 'KYC & Onboarding',
    body: 'Configure required sponsor documents. Review submissions and approve or request more info before deals complete.',
  },
  {
    icon: '📬',
    title: 'Outreach',
    body: 'Build your sponsor contact list, track pipeline stages (new → contacted → responded → converted), and launch campaigns.',
  },
  {
    icon: '👥',
    title: 'Users & Roles',
    body: 'Invite your team and assign roles: Owner, Admin, Ops, Growth, Analytics, Compliance, Finance, or Viewer.',
  },
  {
    icon: '📊',
    title: 'Analytics',
    body: 'Track impressions, clicks, proposal conversion, and revenue. Export reports for your finance team.',
  },
  {
    icon: '⚙️',
    title: 'Settings',
    body: 'Update branding, feature flags, and notification preferences. Manage API access and audit logs.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative py-24 mesh-bg noise-overlay overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-4">Platform guide</p>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
            How Stage works
          </h1>
          <p className="text-lg text-white/50 leading-relaxed">
            A single platform for event organisers to list sponsorship opportunities and for brands to discover, propose, and close deals.
          </p>
        </div>
      </section>

      {/* ── For Sponsors ── */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">For sponsors</p>
              <h2 className="font-display text-3xl font-bold mb-4">Find and close the right events</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-8">
                Browse a curated list of verified live events. Build a custom package, submit a proposal, and manage everything from your dashboard.
              </p>
              <Link href="/browse" className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-2" style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
                Browse events
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <div className="space-y-4">
              {SPONSOR_STEPS.map(s => (
                <div key={s.n} className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono text-xs text-indigo-400">
                    {s.n}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm mb-1">{s.title}</h3>
                    <p className="text-sm text-white/45 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── For Organisers ── */}
      <section className="py-24 px-6 border-t border-white/[0.06]" style={{ background: 'linear-gradient(180deg, transparent, rgba(67,97,238,0.03))' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div className="md:order-2">
              <p className="text-xs text-amber-400 font-medium uppercase tracking-widest mb-3">For organisers</p>
              <h2 className="font-display text-3xl font-bold mb-4">Get set up and live fast</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-8">
                From application to published listing in under an hour. Manage your full sponsorship pipeline — bids, KYC, payments, and analytics — from one portal.
              </p>
              <Link href="/get-started" className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-2" style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
                Get started
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <div className="space-y-4 md:order-1">
              {ORGANISER_STEPS.map(s => (
                <div key={s.n} className="flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-mono text-xs text-amber-400">
                    {s.n}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm mb-1">{s.title}</h3>
                    <p className="text-sm text-white/45 leading-relaxed mb-1">{s.body}</p>
                    {s.link && (
                      <Link href={s.link.href} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                        {s.link.label}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Admin portal basics ── */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Admin portal</p>
            <h2 className="font-display text-3xl font-bold mb-3">What&apos;s in your dashboard</h2>
            <p className="text-white/50 max-w-xl mx-auto text-sm">
              The organiser admin portal gives you full control over every aspect of your sponsorship programme.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ADMIN_SECTIONS.map(s => (
              <div key={s.title} className="glass rounded-xl p-5 flex gap-3">
                <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">{s.icon}</span>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-white/45 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
            >
              Go to your portal
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 6H9.5M6.5 3.5L9.5 6L6.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-4">Start today</h2>
          <p className="text-white/50 mb-8">Whether you&apos;re a sponsor looking for your next event or an organiser ready to list — Stage is the fastest way to make it happen.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/browse" className="btn-ghost text-sm px-6 py-3 border border-white/10">Browse events</Link>
            <Link href="/get-started" className="btn-primary text-sm px-6 py-3" style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
              Get started as organiser
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
