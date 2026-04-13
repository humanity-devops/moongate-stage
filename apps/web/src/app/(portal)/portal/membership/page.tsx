'use client';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type MembershipData = {
  referralCode: string | null;
  referredByCode: string | null;
  referralCount: number;
  earlyAccessStatus: string | null;
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}` };
}

export default function PortalMembershipPage() {
  const [data, setData] = useState<MembershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/membership`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setData(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const [copiedShare, setCopiedShare] = useState(false);

  function shareReferralUrl() {
    if (!data?.referralCode) return;
    const url = `https://stage.moongate.xyz/join?ref=${data.referralCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    });
    // Fire-and-forget analytics
    fetch(`${API_URL}/api/public/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'referral_link_shared' }),
    }).catch(() => {});
  }

  function copyReferral() {
    if (!data?.referralCode) return;
    const url = `${window.location.origin}/join?ref=${data.referralCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Membership</h1>
      <p className="text-white/40 text-sm mb-8">Your membership status and referrals</p>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {/* Refer a sponsor */}
          {data?.referralCode && (
            <div className="glass rounded-xl p-5 border border-indigo-500/20 bg-indigo-500/[0.04]">
              <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-mono mb-3">Refer a sponsor</div>
              <p className="text-sm text-white/70 mb-4">
                Share your referral link to invite other sponsors. You&apos;ll both get early access priority.
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-white/[0.06] rounded-lg px-3 py-2 text-sm text-indigo-300 font-mono truncate">
                  {`https://stage.moongate.xyz/join?ref=${data.referralCode}`}
                </code>
                <button
                  onClick={shareReferralUrl}
                  className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    copiedShare
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
                  }`}
                >
                  {copiedShare ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          {data?.earlyAccessStatus && (
            <div className="glass rounded-xl p-5 border border-white/[0.06]">
              <div className="text-[10px] text-white/30 uppercase tracking-widest font-mono mb-2">Early Access Status</div>
              <div className={`inline-flex px-2.5 py-1 rounded-lg border text-xs ${
                data.earlyAccessStatus === 'onboarded'
                  ? 'text-green-300 bg-green-500/10 border-green-500/30'
                  : data.earlyAccessStatus === 'invited'
                  ? 'text-blue-300 bg-blue-500/10 border-blue-500/30'
                  : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
              }`}>
                {data.earlyAccessStatus}
              </div>
            </div>
          )}

          {/* Referral */}
          <div className="glass rounded-xl p-5 border border-white/[0.06] space-y-4">
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-widest font-mono mb-2">Your Referral Code</div>
              {data?.referralCode ? (
                <div className="flex items-center gap-3">
                  <code className="flex-1 bg-white/[0.06] rounded-lg px-3 py-2 text-sm text-indigo-300 font-mono">
                    {data.referralCode}
                  </code>
                  <button
                    onClick={copyReferral}
                    className={`px-3 py-2 rounded-lg text-xs transition-colors ${
                      copied
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-white/[0.06] text-white/50 border border-white/10 hover:bg-white/[0.10]'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-white/30">No referral code assigned yet</div>
              )}
            </div>

            <div className="flex items-center gap-6 pt-2 border-t border-white/[0.06]">
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-widest font-mono mb-1">Referrals</div>
                <div className="text-2xl font-bold text-white">{data?.referralCount ?? 0}</div>
              </div>
              {data?.referredByCode && (
                <div>
                  <div className="text-[10px] text-white/30 uppercase tracking-widest font-mono mb-1">Referred by</div>
                  <code className="text-xs text-white/40">{data.referredByCode}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
