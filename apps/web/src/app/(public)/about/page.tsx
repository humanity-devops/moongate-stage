import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Stage — Stage by Moongate',
  description: 'Stage by Moongate is the sponsorship marketplace for live events. Learn about our mission, the Moongate by Humanity team, and how we connect organisers with brands.',
};

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-24 md:py-32 mesh-bg noise-overlay overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-4">About</p>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
            Built for<br />
            <span className="text-gradient">today&apos;s live events.</span>
          </h1>
          <p className="text-lg text-white/50 leading-relaxed">
            Stage by Moongate connects brands with event organisers through a purpose-built marketplace — built for brands of every size. Collaborate to generate value, remove the manual grind of spreadsheets and cold email, compare ROI across events, and take control of your sponsorship risk and brand association.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">Mission</p>
              <h2 className="font-display text-3xl font-bold mb-4">Sponsorship should be fast, transparent, and fair.</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Live events deserve better infrastructure. Organisers spend months chasing leads over email,
                and sponsors evaluate dozens of pitch decks with no standard way to compare or act.
              </p>
              <p className="text-white/50 text-sm leading-relaxed">
                Stage changes that — giving organisers a professional listing and deal-management platform,
                and giving sponsors a single place to discover, evaluate, and close event partnerships at scale.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Events live', value: '50+' },
                { label: 'Deals closed', value: '$2M+' },
                { label: 'Avg. response time', value: '6hrs' },
                { label: 'Sponsor teams active', value: '200+' },
              ].map(s => (
                <div key={s.label} className="glass rounded-xl px-5 py-4 flex items-center justify-between">
                  <span className="text-sm text-white/50">{s.label}</span>
                  <span className="font-display font-bold text-white text-xl">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 px-6 border-t border-white/[0.06]" style={{ background: 'linear-gradient(180deg, transparent, rgba(67,97,238,0.03))' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">Principles</p>
            <h2 className="font-display text-3xl font-bold">How we build</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Quality over quantity', body: 'Every event on Stage is reviewed and approved. Sponsors know they\'re reaching real audiences at credible events.' },
              { title: 'Transparency by default', body: 'Pricing, deliverables, and terms are visible upfront. No hidden fees, no ambiguous "contact us for pricing."' },
              { title: 'Speed in every step', body: 'From listing to closed deal in days, not months. We automate the friction and leave humans to make the decisions.' },
              { title: 'Fair for Everyone', body: 'We design for both sides of the table — organisers get tools to run professional pipelines, sponsors get the transparency they need to commit fast.' },
            ].map(v => (
              <div key={v.title} className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">{v.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Organiser benefits */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">For Organisers</p>
            <h2 className="font-display text-3xl font-bold">Everything you need to land sponsors</h2>
            <p className="text-white/50 text-sm mt-3 max-w-xl mx-auto">From your first listing to a closed deal — without chasing inboxes.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: 'Professional listing in minutes', body: 'Upload your sponsorship deck and go live fast. AI extraction pulls your packages automatically — or generate a professional sponsorship page to share as a private link or list on the marketplace.' },
              { title: 'Inbound sponsor interest', body: 'Qualified brands discover your event. You\'ll get bids, not cold leads — real budget attached, ready to negotiate.' },
              { title: 'Deal management built-in', body: 'Counter-offers, contracts, KYC, and payment — managed in one place with a full audit trail. Includes analytics reporting.' },
            ].map(b => (
              <div key={b.title} className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand / CMO benefits */}
      <section className="py-24 px-6 border-t border-white/[0.06]" style={{ background: 'linear-gradient(180deg, transparent, rgba(67,97,238,0.03))' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">For Sponsors & CMOs</p>
            <h2 className="font-display text-3xl font-bold">Find the right events, faster</h2>
            <p className="text-white/50 text-sm mt-3 max-w-xl mx-auto">Stop evaluating pitch decks in your inbox. Discover, compare, and close event partnerships at scale.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: 'Curated event marketplace', body: 'Every event is reviewed before listing. Reach real, engaged audiences — not outdated directories.' },
              { title: 'Transparent pricing upfront', body: 'Package tiers, deliverables, and terms are visible before you reach out. No "contact us" surprises.' },
              { title: 'Close deals in days', body: 'Bid directly, negotiate via the platform, and sign off without back-and-forth email chains.' },
            ].map(b => (
              <div key={b.title} className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="font-display text-3xl font-bold">What our partners say</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { quote: 'It was great working with Moongate. They designed and implemented a ticketing solution that integrates with Unicorn wallets to drive ETHDenver account creation and enable new opportunities for onchain engagement at conferences.', name: 'ETHDenver Steward 2025', role: 'ETHDenver' },
              { quote: 'Moongate powers our membership program, enabling Jai by OneSiam to build a vibrant community and offer exclusive experiences. Its reliable and intuitive platform demonstrates how NFT technology can be easily embraced by the public.', name: 'Momori Hirabayashi', role: 'Jai by OneSiam' },
              { quote: 'Moongate seamlessly integrated all immersive experiences onto one platform. This engagement encouraged attendees to explore the venue, interact with vendors, and help regulate crowds.', name: 'Peter Noszek', role: 'TOKEN2049' },
            ].map(t => (
              <div key={t.name} className="glass rounded-xl p-6 flex flex-col gap-4">
                <p className="text-sm text-white/70 leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/40">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team — Moongate by Humanity */}
      <section className="py-24 px-6 border-t border-white/[0.06]" style={{ background: 'linear-gradient(180deg, transparent, rgba(67,97,238,0.03))' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">The Team</p>
            <h2 className="font-display text-3xl font-bold">Moongate by Humanity</h2>
            <p className="text-white/50 text-sm mt-3 max-w-xl mx-auto">
              Moongate is built by a team of event-industry veterans backed by Humanity Protocol — creating the trust infrastructure that powers the next era of live experiences.
            </p>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { name: 'Terence Kwok', role: 'Founder, Humanity Protocol', initials: 'TK' },
              { name: 'T Fung', role: 'Head of Product', initials: 'TF' },
              { name: 'Ry Lee', role: 'Head of BD', initials: 'RL' },
              { name: 'Joao Machado', role: 'Head of Marketing', initials: 'JM' },
            ].map(p => (
              <div key={p.name} className="glass rounded-xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
                  <span className="text-indigo-300 font-semibold text-sm">{p.initials}</span>
                </div>
                <p className="font-semibold text-white text-sm">{p.name}</p>
                <p className="text-xs text-white/40 mt-1">{p.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-4">Ready to find sponsors?</h2>
          <p className="text-white/50 mb-8">List your event or browse as a sponsor — it takes minutes to get started.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/join" className="btn-ghost text-sm px-6 py-3 border border-white/10">Become a Sponsor</Link>
            <Link href="/get-started" className="btn-primary text-sm px-6 py-3" style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
