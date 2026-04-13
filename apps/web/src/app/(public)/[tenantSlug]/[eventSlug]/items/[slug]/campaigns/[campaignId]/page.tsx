import type { Metadata } from 'next';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import { formatCurrency, getCategoryLabel } from '@/lib/utils';
import { ContributeForm } from '@/components/public/ContributeForm';
import { ArrowLeft, Globe, Trophy, Clock, Users, CheckCircle2, XCircle } from 'lucide-react';

interface PageProps {
  params: { tenantSlug: string; eventSlug: string; slug: string; campaignId: string };
  searchParams: { started?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: campaign } = await publicApi.getCampaign(params.tenantSlug, params.eventSlug, params.campaignId);
    return {
      title: `${campaign.entityName} — Community Campaign`,
      description: campaign.entityDescription,
    };
  } catch {
    return { title: 'Community Campaign' };
  }
}

function timeRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Campaign ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ${hours}h remaining`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${mins}m remaining` : `${mins} minute${mins !== 1 ? 's' : ''} remaining`;
}

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { tenantSlug, eventSlug, slug, campaignId } = params;
  const justStarted = searchParams.started === '1';

  let campaign: import('@/lib/api').CrowdfundCampaignDetail;

  try {
    const res = await publicApi.getCampaign(tenantSlug, eventSlug, campaignId);
    campaign = res.data;
  } catch {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-white mb-3">Campaign not found</h1>
          <Link href={`/${tenantSlug}/${eventSlug}/items/${slug}`} className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors">
            ← Back to package
          </Link>
        </div>
      </div>
    );
  }

  const isActive = campaign.status === 'active';
  const isWon = campaign.status === 'won';
  const pct = campaign.percentFunded;
  const goalNum = Number(campaign.goalAmount);
  const raisedNum = Number(campaign.raisedAmount);

  return (
    <div className="min-h-screen bg-void">
      {/* Nav bar */}
      <div className="px-6 md:px-10 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <Link
            href={`/${tenantSlug}/${eventSlug}/items/${slug}`}
            className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <ArrowLeft className="w-3 h-3" />
            {campaign.item.publicTitle}
          </Link>
          <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span className="font-mono text-[11px] tracking-widest uppercase truncate max-w-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {campaign.entityName}
          </span>
        </div>
      </div>

      {/* Just started banner */}
      {justStarted && (
        <div
          className="px-6 py-4 text-center"
          style={{ background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.15)' }}
        >
          <p className="font-sans text-sm font-semibold" style={{ color: 'rgba(134,239,172,0.9)' }}>
            🎉 Your campaign is live! Share this page with your community to start collecting pledges.
          </p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-14">
          {/* ── Main column ── */}
          <div className="lg:col-span-2 space-y-10">
            {/* Campaign header */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="font-mono text-[11px] tracking-[0.3em] uppercase" style={{ color: '#7b93f8' }}>
                  {getCategoryLabel(campaign.item.category)}
                </span>
                {isWon && (
                  <span
                    className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1"
                    style={{ background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.25)', color: '#e0b83e' }}
                  >
                    <Trophy className="w-2.5 h-2.5" /> Goal Reached
                  </span>
                )}
                {campaign.status === 'lost' && (
                  <span
                    className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
                  >
                    <XCircle className="w-2.5 h-2.5" /> Another Campaign Won
                  </span>
                )}
                {campaign.status === 'expired' && (
                  <span
                    className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
                  >
                    <Clock className="w-2.5 h-2.5" /> Expired
                  </span>
                )}
              </div>

              <h1
                className="font-display font-bold text-white leading-tight mb-3"
                style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}
              >
                {campaign.entityName}
              </h1>
              <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Raising community funds for{' '}
                <Link href={`/${tenantSlug}/${eventSlug}/items/${slug}`} className="text-brand-400 hover:text-brand-300 transition-colors">
                  {campaign.item.publicTitle}
                </Link>
              </p>

              {campaign.entityWebsite && (
                <a
                  href={campaign.entityWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 font-mono text-[10px] tracking-widest uppercase transition-colors hover:text-brand-400"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <Globe className="w-3 h-3" />
                  {new URL(campaign.entityWebsite).hostname}
                </a>
              )}
            </div>

            {/* Description */}
            {campaign.entityDescription && (
              <div className="p-8" style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="font-sans text-base leading-loose" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {campaign.entityDescription}
                </p>
              </div>
            )}

            {/* Progress block */}
            <div className="p-8 space-y-5" style={{ background: '#0d0d14', border: `1px solid ${isWon ? 'rgba(201,162,39,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
              {isWon && (
                <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #c9a227, transparent)', marginTop: '-2rem', marginLeft: '-2rem', marginRight: '-2rem', marginBottom: '1.5rem' }} />
              )}
              <div className="flex items-end justify-between">
                <div>
                  <span className="font-mono text-4xl font-semibold text-white tabular-nums">
                    {formatCurrency(raisedNum, campaign.currency)}
                  </span>
                  <span className="font-mono text-sm ml-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    raised of {formatCurrency(goalNum, campaign.currency)} goal
                  </span>
                </div>
                <span
                  className="font-mono text-2xl font-semibold tabular-nums"
                  style={{ color: isWon ? '#c9a227' : pct >= 75 ? 'rgba(134,239,172,0.8)' : '#7b93f8' }}
                >
                  {pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: isWon
                      ? 'linear-gradient(90deg, #c9a227, #f0d070)'
                      : pct >= 75
                        ? 'linear-gradient(90deg, rgba(67,97,238,0.8), rgba(134,239,172,0.8))'
                        : '#4361ee',
                  }}
                />
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-8 pt-2">
                <div>
                  <div className="font-mono text-xl font-semibold text-white tabular-nums">{campaign.backerCount}</div>
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Backers
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xl font-semibold text-white tabular-nums">
                    {formatCurrency(Math.max(0, goalNum - raisedNum), campaign.currency)}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Still Needed
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xl font-semibold text-white">
                    {isActive ? timeRemaining(campaign.deadline) : new Date(campaign.deadline).toLocaleDateString()}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {isActive ? 'Time Left' : 'Ended'}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent contributions */}
            {campaign.recentContributions.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-bold text-white mb-5">
                  Recent Backers
                </h2>
                <div className="space-y-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {campaign.recentContributions.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-4 px-5 py-4"
                      style={{ background: '#0d0d14' }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {i === 0 && isWon && <Trophy className="w-3 h-3 flex-shrink-0" style={{ color: '#c9a227' }} />}
                          <span className="font-sans text-sm font-medium text-white">{c.contributorName}</span>
                        </div>
                        {c.message && (
                          <p className="font-sans text-xs leading-relaxed truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            &ldquo;{c.message}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono text-sm font-semibold text-white tabular-nums">
                          {formatCurrency(Number(c.amount), c.currency)}
                        </div>
                        <div className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div>
            <div className="sticky top-8 space-y-5">
              {/* Contribute form (active campaigns only) */}
              {isActive ? (
                <div style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Back This Campaign
                    </p>
                    <h3 className="font-display text-lg font-bold text-white">
                      Contribute
                    </h3>
                  </div>
                  <div className="p-6">
                    <ContributeForm
                      campaignId={campaignId}
                      tenantSlug={tenantSlug}
                      eventSlug={eventSlug}
                      goalAmount={goalNum}
                      raisedAmount={raisedNum}
                      currency={campaign.currency}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="p-6 text-center"
                  style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {isWon ? (
                    <>
                      <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: '#c9a227' }} />
                      <p className="font-display text-lg font-bold text-white mb-2">Goal Reached!</p>
                      <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        This campaign successfully funded {formatCurrency(raisedNum, campaign.currency)} from {campaign.backerCount} backers.
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
                      <p className="font-display text-lg font-bold text-white mb-2">Campaign Closed</p>
                      <p className="font-sans text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {campaign.status === 'lost'
                          ? 'Another campaign reached the goal first.'
                          : 'This campaign expired without reaching its goal.'}
                      </p>
                      <Link
                        href={`/${tenantSlug}/${eventSlug}/items/${slug}/campaigns/new`}
                        className="block w-full text-center py-3 font-sans font-semibold text-white transition-colors bg-brand-500 hover:bg-brand-600"
                      >
                        Start a New Campaign
                      </Link>
                    </>
                  )}
                </div>
              )}

              {/* Package summary card */}
              <div className="p-5" style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Sponsorship Package
                </p>
                <h4 className="font-display text-base font-bold text-white mb-1.5">
                  {campaign.item.publicTitle}
                </h4>
                {campaign.item.shortDescription && (
                  <p className="font-sans text-xs leading-relaxed mb-3 line-clamp-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {campaign.item.shortDescription}
                  </p>
                )}
                <Link
                  href={`/${tenantSlug}/${eventSlug}/items/${slug}`}
                  className="font-mono text-[10px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors"
                >
                  View full package →
                </Link>
              </div>

              {/* See other campaigns */}
              <Link
                href={`/${tenantSlug}/${eventSlug}/items/${slug}`}
                className="flex items-center justify-between w-full p-4 font-mono text-[10px] tracking-[0.2em] uppercase transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  All campaigns for this package
                </span>
                <ArrowLeft className="w-3 h-3 rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
