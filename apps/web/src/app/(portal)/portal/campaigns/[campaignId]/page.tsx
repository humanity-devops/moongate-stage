'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Contribution = {
  id: string;
  contributorName: string;
  amount: number;
  currency: string;
  message: string | null;
  createdAt: string;
};

type Campaign = {
  id: string;
  entityName: string;
  entityDescription: string | null;
  entityWebsite: string | null;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
  deadline: string;
  status: string;
  item: {
    publicTitle: string;
    shortDescription: string | null;
    category: string;
    listPrice: number | null;
    benefits: { label: string; value: string | null }[];
  };
  event: {
    name: string;
    slug: string;
    startDate: string | null;
    endDate: string | null;
    city: string | null;
    country: string | null;
  };
  tenant: { slug: string; name: string };
  contributions: Contribution[];
  _count: { contributions: number };
  myContribution: { id: string; amount: number; status: string } | null;
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const pct = Math.min(100, goal > 0 ? (raised / goal) * 100 : 0);
  return (
    <div>
      <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-white font-semibold">
          {goal > 0 ? `${pct.toFixed(0)}% funded` : 'Just started'}
        </span>
        <span className="text-white/40">
          {raised.toLocaleString()} / {goal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function ContributionForm({ campaign, onSuccess }: { campaign: Campaign; onSuccess: () => void }) {
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const presets = [50, 100, 250, 500];

  async function handleContribute() {
    if (amount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/sponsor/campaigns/${campaign.id}/contribute`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount, message: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to create contribution.');
      // Redirect to Stripe
      if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass rounded-xl border border-white/[0.08] p-5">
      <h3 className="font-display text-base font-bold text-white mb-4">Back this campaign</h3>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Amount ({campaign.currency})</label>
        <div className="flex gap-2 mb-3 flex-wrap">
          {presets.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                amount === p
                  ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                  : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
        />
      </div>

      <div className="mb-4">
        <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Message (optional)</label>
        <textarea
          className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 resize-none transition-colors"
          rows={2}
          placeholder="Leave a message of support..."
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>

      <button
        onClick={handleContribute}
        disabled={submitting || amount <= 0}
        className="w-full btn-primary py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
      >
        {submitting ? 'Redirecting to checkout...' : `Contribute ${campaign.currency} ${amount}`}
      </button>
      <p className="text-center text-white/20 text-xs mt-2">Secure checkout via Stripe</p>
    </div>
  );
}

function CampaignDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = params.campaignId as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/sponsor/campaigns/${campaignId}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to load campaign.');
      }
      const data = await res.json();
      setCampaign(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [campaignId]);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass rounded-xl border border-white/[0.06] h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-8">
        <div className="glass rounded-xl border border-red-500/20 p-8 text-center max-w-md">
          <p className="text-red-300 text-sm mb-3">{error || 'Campaign not found.'}</p>
          <Link href="/portal/campaigns" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const isActive = campaign.status === 'active' && daysLeft > 0;

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link href="/portal/campaigns" className="hover:text-white transition-colors">Campaigns</Link>
        <span>/</span>
        <span className="text-white/60">{campaign.entityName}</span>
      </nav>

      {/* Success / cancelled banners */}
      {success && (
        <div className="mb-6 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-green-300 text-sm">
          Your contribution was successful. Thank you for backing this campaign!
        </div>
      )}
      {cancelled && (
        <div className="mb-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-yellow-300 text-sm">
          Your checkout was cancelled. You can try again below.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-5">
          {/* Header */}
          <div className="glass rounded-xl border border-white/[0.06] p-6">
            <div className="flex items-start gap-4 mb-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-white mb-1">{campaign.entityName}</h1>
                {campaign.item?.publicTitle && (
                  <p className="text-white/40 text-sm">{campaign.item.publicTitle}</p>
                )}
              </div>
            </div>
            {campaign.entityDescription && (
              <p className="text-white/50 text-sm leading-relaxed mb-4">{campaign.entityDescription}</p>
            )}

            <ProgressBar
              raised={Number(campaign.raisedAmount)}
              goal={Number(campaign.goalAmount)}
            />

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.04]">
              <div className="text-center">
                <p className="text-white font-bold text-lg">{campaign._count.contributions}</p>
                <p className="text-white/30 text-xs">Backers</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg">{daysLeft}</p>
                <p className="text-white/30 text-xs">Days left</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg capitalize">{campaign.status}</p>
                <p className="text-white/30 text-xs">Status</p>
              </div>
            </div>
          </div>

          {/* Event info */}
          <div className="glass rounded-xl border border-white/[0.06] p-5">
            <h3 className="text-white/40 text-xs uppercase tracking-wide mb-3">Event</h3>
            <p className="text-white font-medium">{campaign.event.name}</p>
            {campaign.event.city && (
              <p className="text-white/40 text-sm">
                {campaign.event.city}{campaign.event.country ? `, ${campaign.event.country}` : ''}
              </p>
            )}
            {campaign.event.startDate && (
              <p className="text-white/40 text-sm">{new Date(campaign.event.startDate).toLocaleDateString()}</p>
            )}
          </div>

          {/* Sponsorship package benefits */}
          {(campaign.item?.benefits?.length ?? 0) > 0 && (
            <div className="glass rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-white/40 text-xs uppercase tracking-wide mb-3">Package includes</h3>
              <div className="space-y-2">
                {campaign.item!.benefits.map((b, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3 3 7-7" />
                    </svg>
                    <span className="text-white/60">{b.label}{b.value ? `: ${b.value}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent backers */}
          {campaign.contributions.length > 0 && (
            <div className="glass rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-white/40 text-xs uppercase tracking-wide mb-3">Recent backers</h3>
              <div className="space-y-3">
                {campaign.contributions.map(contrib => (
                  <div key={contrib.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-xs text-indigo-400 font-medium">
                      {contrib.contributorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{contrib.contributorName}</span>
                        <span className="text-white/40 text-xs">
                          {contrib.currency} {Number(contrib.amount).toLocaleString()}
                        </span>
                      </div>
                      {contrib.message && (
                        <p className="text-white/40 text-xs mt-0.5 truncate">{contrib.message}</p>
                      )}
                    </div>
                    <span className="text-white/20 text-xs shrink-0">
                      {new Date(contrib.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* My existing contribution */}
          {campaign.myContribution && (
            <div className="glass rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-green-300 text-sm font-medium mb-1">You backed this</p>
              <p className="text-white/50 text-xs">
                {campaign.currency} {Number(campaign.myContribution.amount).toLocaleString()} — {campaign.myContribution.status}
              </p>
            </div>
          )}

          {/* Contribution form */}
          {isActive && !campaign.myContribution && (
            <ContributionForm campaign={campaign} onSuccess={load} />
          )}

          {/* Not active states */}
          {!isActive && (
            <div className="glass rounded-xl border border-white/[0.06] p-5 text-center">
              <p className="text-white/50 text-sm">
                {campaign.status === 'won'
                  ? 'This campaign reached its goal!'
                  : campaign.status === 'lost'
                    ? 'This campaign did not reach its goal.'
                    : daysLeft === 0
                      ? 'This campaign has ended.'
                      : 'This campaign is not accepting contributions.'}
              </p>
            </div>
          )}

          {/* Organizer link */}
          {campaign.entityWebsite && (
            <a
              href={campaign.entityWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="block glass rounded-xl border border-white/[0.06] p-4 hover:border-indigo-500/30 transition-colors"
            >
              <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Website</p>
              <p className="text-indigo-400 text-sm truncate">{campaign.entityWebsite}</p>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/40 text-sm">Loading...</div>}>
      <CampaignDetailContent />
    </Suspense>
  );
}
