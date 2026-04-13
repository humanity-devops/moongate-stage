import type { Metadata } from 'next';
import Link from 'next/link';
import { ProposalWizard } from '@/components/public/ProposalWizard';

interface Props {
  params: { tenantSlug: string; eventSlug: string };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getEvent(tenantSlug: string, eventSlug: string) {
  try {
    const res = await fetch(`${API_URL}/api/public/events/${tenantSlug}/${eventSlug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEvent(params.tenantSlug, params.eventSlug);
  return {
    title: event ? `Propose Sponsorship — ${event.name}` : 'Propose Sponsorship',
  };
}

export default async function ProposePage({ params }: Props) {
  const { tenantSlug, eventSlug } = params;
  const event = await getEvent(tenantSlug, eventSlug);

  return (
    <div className="min-h-screen mesh-bg">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href={`/${tenantSlug}/${eventSlug}/sponsor`}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 3L5 7L9 11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to event
        </Link>

        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-2">Custom Proposal</p>
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            {event ? `Sponsor ${event.name}` : 'Submit a sponsorship proposal'}
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Design a custom sponsorship package, set your budget, and submit it for review.
            The event team will respond within 48 hours.
          </p>
        </div>

        <ProposalWizard
          tenantSlug={tenantSlug}
          eventSlug={eventSlug}
          eventName={event?.name ?? 'this event'}
        />
      </div>
    </div>
  );
}
