'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { organizerApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

type Campaign = {
  id: string;
  entityName: string;
  entityDescription?: string;
  entityWebsite?: string;
  contactName: string;
  contactEmail: string;
  goalAmount: string;
  raisedAmount: string;
  currency: string;
  deadline: string;
  status: string;
  approvalStatus: string;
  rejectionReason?: string;
  createdAt: string;
  item: { publicTitle: string; slug: string; category: string; listPrice?: string };
  _count: { contributions: number };
};

const APPROVAL_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const APPROVAL_BADGE: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Pending',  className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/15 text-green-300 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  active:  'text-blue-400',
  won:     'text-green-400',
  lost:    'text-gray-500',
  expired: 'text-gray-500',
};

export default function CampaignsPage() {
  const { tenantSlug, eventId } = useParams() as { tenantSlug: string; eventId: string };
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{ campaign: Campaign; action: 'approved' | 'rejected' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadCampaigns = useCallback(async () => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    try {
      const res = await organizerApi.getCampaigns(eventId, token, tenantSlug, activeTab || undefined);
      setCampaigns(res.data as Campaign[]);
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [eventId, tenantSlug, activeTab, router]);

  useEffect(() => { setLoading(true); loadCampaigns(); }, [loadCampaigns]);

  async function handleReview() {
    if (!reviewModal) return;
    const token = localStorage.getItem('moongate_token');
    if (!token) return;
    const { campaign, action } = reviewModal;
    if (action === 'rejected' && !rejectionReason.trim()) return;
    setActionLoading(campaign.id);
    try {
      await organizerApi.reviewCampaign(
        eventId,
        campaign.id,
        { approvalStatus: action, rejectionReason: action === 'rejected' ? rejectionReason : undefined },
        token,
        tenantSlug,
      );
      setReviewModal(null);
      setRejectionReason('');
      await loadCampaigns();
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCount = campaigns.filter(c => c.approvalStatus === 'pending').length;

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading campaigns...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href={`/admin/${tenantSlug}/events`} className="hover:text-white">Events</Link>
            <span className="mx-2">›</span>
            <Link href={`/admin/${tenantSlug}/events/${eventId}`} className="hover:text-white">Dashboard</Link>
            <span className="mx-2">›</span>
            <span className="text-white">Community Campaigns</span>
          </nav>
          <h1 className="text-3xl font-bold text-white">Community Campaigns</h1>
          <p className="text-gray-400 mt-1">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
            {pendingCount > 0 && activeTab !== 'pending' && (
              <span className="ml-2 text-yellow-400 font-medium">{pendingCount} pending review</span>
            )}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 mb-6 w-fit">
          {APPROVAL_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Campaign list */}
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-white font-semibold mb-2">No campaigns</h3>
              <p className="text-gray-400 text-sm">
                {activeTab === 'pending'
                  ? 'No campaigns awaiting review.'
                  : 'Community crowdfunding campaigns will appear here once submitted.'}
              </p>
            </div>
          ) : (
            campaigns.map(campaign => {
              const badge = APPROVAL_BADGE[campaign.approvalStatus] ?? APPROVAL_BADGE.pending;
              const pct = Number(campaign.goalAmount) > 0
                ? Math.round((Number(campaign.raisedAmount) / Number(campaign.goalAmount)) * 100)
                : 0;
              return (
                <div key={campaign.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <div className="flex items-start gap-4">
                    {/* Approval badge */}
                    <span className={`mt-0.5 flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.className}`}>
                      {badge.label}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-white">{campaign.entityName}</h3>
                        <span className="text-gray-500 text-sm">·</span>
                        <span className="text-gray-400 text-sm">{campaign.contactName}</span>
                        <span className="text-gray-500 text-sm">·</span>
                        <a href={`mailto:${campaign.contactEmail}`} className="text-gray-500 text-xs hover:text-gray-300">{campaign.contactEmail}</a>
                      </div>
                      <p className="text-brand-400 text-sm font-medium mb-1">{campaign.item?.publicTitle}</p>
                      {campaign.entityDescription && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-2">{campaign.entityDescription}</p>
                      )}
                      {campaign.entityWebsite && (
                        <a
                          href={campaign.entityWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                        >
                          {campaign.entityWebsite}
                        </a>
                      )}

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span className={CAMPAIGN_STATUS_BADGE[campaign.status] ?? 'text-gray-400'}>
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </span>
                          <span>{pct}% funded · {campaign._count.contributions} backer{campaign._count.contributions !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>

                      {campaign.rejectionReason && (
                        <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                          Rejection reason: {campaign.rejectionReason}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>Submitted {new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>·</span>
                        <span>Deadline {new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Goal amount */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-bold text-white">
                        {formatCurrency(Number(campaign.raisedAmount), campaign.currency)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        of {formatCurrency(Number(campaign.goalAmount), campaign.currency)} goal
                      </div>
                    </div>

                    {/* Actions */}
                    {campaign.approvalStatus === 'pending' && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => setReviewModal({ campaign, action: 'approved' })}
                          disabled={!!actionLoading}
                          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { setReviewModal({ campaign, action: 'rejected' }); setRejectionReason(''); }}
                          disabled={!!actionLoading}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md">
            {reviewModal.action === 'approved' ? (
              <>
                <h3 className="text-xl font-bold text-white mb-2">Approve Campaign</h3>
                <p className="text-gray-400 text-sm mb-6">
                  <strong className="text-white">{reviewModal.campaign.entityName}</strong>&apos;s campaign for{' '}
                  <span className="text-brand-400">{reviewModal.campaign.item?.publicTitle}</span> will go live and be
                  visible to the public.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReviewModal(null)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReview}
                    disabled={!!actionLoading}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    {actionLoading ? 'Approving...' : 'Confirm Approve'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-2">Reject Campaign</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Rejecting <strong className="text-white">{reviewModal.campaign.entityName}</strong>&apos;s campaign.
                  Please provide a reason that will be recorded internally.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Reason for rejection</label>
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 resize-none"
                    placeholder="e.g. Duplicate submission, incomplete information, does not meet eligibility requirements..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReviewModal(null)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReview}
                    disabled={!!actionLoading || !rejectionReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
