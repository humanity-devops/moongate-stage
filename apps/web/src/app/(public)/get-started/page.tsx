import type { Metadata } from 'next';
import Link from 'next/link';
import { EarlyAccessForm } from '@/components/site/EarlyAccessForm';

export const metadata: Metadata = {
  title: 'Get Started — Stage by Moongate',
  description: 'Apply for early access as a sponsor, or list your event as an organiser. Stage by Moongate connects brands with live events.',
};

const SPONSOR_BENEFITS = [
  { title: 'Curated event marketplace', body: 'Every event is reviewed before listing. Reach real, engaged audiences — not outdated directories.' },
  { title: 'Transparent pricing upfront', body: 'Package tiers, deliverables, and terms are visible before you reach out. No surprises.' },
  { title: 'Close deals in days', body: 'Bid directly, negotiate via the platform, and sign off without back-and-forth email chains.' },
  { title: 'Activation analytics', body: 'Track deal performance, access activation analytics, and manage deliverables from your dashboard.' },
];

const ORGANISER_STEPS = [
  { n: '01', title: 'Create your account', body: 'Complete a short application to get your organiser account set up. We review each organiser to maintain quality.' },
  { n: '02', title: 'Upload your deck', body: 'Drop in your current sponsorship PDF. Our AI extracts your packages, pricing, and deliverables automatically.' },
  { n: '03', title: 'Review & publish', body: 'QA your listing in the admin portal. Add a hero image, tagline, and any custom tiers. Hit publish when ready.' },
  { n: '04', title: 'Manage incoming bids', body: 'Sponsors discover your event, build packages, and submit proposals. You review, counter, accept — all in one place.' },
];

export default function GetStartedPage() {
  return (
    <div className="flex flex-col">

      {/* ── SPONSOR SECTION ──────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 mesh-bg noise-overlay overflow-hidden" id="sponsors">
        <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left: messaging */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                For sponsors &amp; brands
              </div>

              <h1 className="font-display text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight mb-6">
                Find the right events.<br />
                <span className="text-gradient">Close deals faster.</span>
              </h1>

              <p className="text-lg text-white/50 leading-relaxed mb-10">
                Stage by Moongate gives brands a single place to discover live events, build custom sponsorship packages,
                and close deals — without the spreadsheet chaos.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {SPONSOR_BENEFITS.map(b => (
                  <div key={b.title} className="glass rounded-xl p-4">
                    <h3 className="font-semibold text-white text-sm mb-1">{b.title}</h3>
                    <p className="text-xs text-white/45 leading-relaxed">{b.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link href="/browse" className="btn-ghost text-sm px-5 py-2.5 border border-white/10 inline-flex items-center gap-2">
                  Browse live events
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right: Early Access form */}
            <div className="glass rounded-2xl p-8 border border-white/[0.08]">
              <h2 className="font-display text-xl font-bold text-white mb-1">Apply for early access</h2>
              <p className="text-sm text-white/40 mb-6">Join the sponsor waitlist. We review every application.</p>
              <EarlyAccessForm defaultRole="sponsor" />
            </div>
          </div>
        </div>
      </section>

      {/* ── ORGANISER SECTION ────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/[0.06]" id="organisers" style={{ background: 'linear-gradient(180deg, transparent, rgba(67,97,238,0.03))' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-amber-400 font-medium uppercase tracking-widest mb-3">For organisers</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Get your event in front of<br />
              <span className="text-gradient">the right sponsors.</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Upload your sponsorship deck and go live in under an hour. Manage your full pipeline — bids, KYC, payments, and analytics — from one portal.
            </p>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-2 gap-4 mb-12">
            {ORGANISER_STEPS.map(s => (
              <div key={s.n} className="glass rounded-xl p-6 flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-mono text-xs text-amber-400">
                  {s.n}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1.5">{s.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Organiser CTA */}
          <div className="glass rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-semibold text-white mb-1">Ready to list your event?</h3>
              <p className="text-sm text-white/40">Upload your sponsorship deck and go live in minutes.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/auth/login"
                className="btn-primary text-sm px-6 py-3 inline-flex items-center gap-2 whitespace-nowrap"
                style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload your deck
              </Link>
              <Link href="/#early-access" className="btn-ghost text-sm px-6 py-3 border border-white/10 whitespace-nowrap">
                Apply for access
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Organiser benefits ─────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">Why Stage</p>
            <h2 className="font-display text-3xl font-bold mb-4">Everything organisers need to sell sponsorships</h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Built for organisers who run real events and need a professional, scalable way to manage brand partnerships.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Verified brand reach', body: 'Your event is seen by pre-qualified sponsors actively looking for live event partnerships — not cold outreach lists.' },
              { title: 'Upload once, sell always', body: 'Import your sponsorship deck and we turn it into a live, structured marketplace listing — packages, pricing, and all.' },
              { title: '6hrs average response', body: 'Manage bids, counter-offers, and approvals from a single dashboard. No more spreadsheets or lost email threads.' },
              { title: 'Real-time analytics', body: 'Track which packages get the most views, proposal conversion rates, and deal velocity across every event you run.' },
              { title: 'KYC & compliance built in', body: 'We handle sponsor onboarding, contract templates, and KYC checks — so your team can focus on running great events.' },
              { title: 'Custom package builder', body: 'Create bespoke sponsorship tiers, combine assets, set limits, and offer exclusive add-ons — all in your admin portal.' },
            ].map(b => (
              <div key={b.title} className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
