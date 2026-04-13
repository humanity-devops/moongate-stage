import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FAQ — Stage by Moongate',
  description: 'Frequently asked questions about Stage by Moongate — the sponsorship marketplace for live events.',
};

const FAQS = [
  {
    q: 'What is Stage by Moongate?',
    a: 'Stage is a sponsorship marketplace that connects brands and sponsors with live events — conferences, hackathons, summits, and more. Sponsors discover and close deals directly on the platform; organisers manage their full pipeline from listing to payment.',
  },
  {
    q: 'Who is early access for?',
    a: 'Early access is currently open to potential sponsors and brands looking to activate at live events. If you\'re an event organiser, please contact us directly at contact@moongate.id.',
  },
  {
    q: 'How does the sponsorship bidding work?',
    a: 'Once you find an event, you can select from existing packages or build a custom bundle using the drag-and-drop builder. Submit your proposal, and the organiser will review, counter, or accept — all within the platform.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'Stage supports both crypto and fiat payments. You\'ll receive a custom invoice after your deal is accepted.',
  },
  {
    q: 'How long does it take to get a response from an organiser?',
    a: 'Our average organiser response time is 6 hours. You\'ll receive notifications in-platform and by email as soon as there\'s an update on your proposal.',
  },
  {
    q: 'Is KYC required?',
    a: 'Some events require KYC verification before a deal is finalised. Stage handles the KYC workflow end-to-end — you\'ll be prompted if it\'s needed for a specific event.',
  },
  {
    q: 'How do I get analytics on my sponsorship?',
    a: 'After your deal is activated, you\'ll have access to your sponsor dashboard with activation analytics — tracking deal performance and deliverables.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email us at contact@moongate.id and we\'ll get back to you shortly.',
  },
];

export default function FAQPage() {
  return (
    <div className="flex flex-col">
      <section className="relative py-24 mesh-bg noise-overlay overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-4">Support</p>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight mb-6">
            Frequently asked questions
          </h1>
          <p className="text-lg text-white/50">
            Can&apos;t find what you need?{' '}
            <a href="mailto:contact@moongate.id" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Contact us
            </a>.
          </p>
        </div>
      </section>

      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto space-y-4">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="glass rounded-xl group open:ring-1 open:ring-indigo-500/20"
            >
              <summary className="px-6 py-5 cursor-pointer flex items-center justify-between gap-4 list-none select-none">
                <span className="font-semibold text-white text-sm">{item.q}</span>
                <svg
                  className="w-4 h-4 text-white/30 shrink-0 transition-transform group-open:rotate-180"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5">
                <p className="text-sm text-white/50 leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/[0.06] text-center">
        <p className="text-white/40 text-sm mb-4">Still have questions?</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:contact@moongate.id"
            className="btn-primary text-sm px-6 py-3 inline-block"
            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
          >
            Email us
          </a>
          <Link href="/browse" className="btn-ghost text-sm px-6 py-3 border border-white/10">
            Browse events
          </Link>
        </div>
      </section>
    </div>
  );
}
