'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface CampaignFormProps {
  tenantSlug: string;
  eventSlug: string;
  itemSlug: string;
  itemTitle: string;
  listPrice: number | null;
  currency: string;
}

export function CampaignForm({
  tenantSlug, eventSlug, itemSlug, itemTitle, listPrice, currency,
}: CampaignFormProps) {
  const router = useRouter();
  const [entityName, setEntityName] = useState('');
  const [entityDescription, setEntityDescription] = useState('');
  const [entityWebsite, setEntityWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [goalAmount, setGoalAmount] = useState(listPrice ? String(listPrice) : '');
  const [deadline, setDeadline] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deadline constraints: tomorrow → 30 days out
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!termsAccepted) { setError('Please accept the terms to continue.'); return; }
    if (!deadline) { setError('Please set a campaign deadline.'); return; }

    const goalNum = parseFloat(goalAmount);
    if (!listPrice && (!goalNum || goalNum <= 0)) {
      setError('Please enter a funding goal amount.');
      return;
    }

    setLoading(true);
    try {
      const deadlineISO = new Date(deadline + 'T23:59:59Z').toISOString();
      const res = await publicApi.startCampaign(tenantSlug, eventSlug, itemSlug, {
        entityName: entityName.trim(),
        entityDescription: entityDescription.trim() || undefined,
        entityWebsite: entityWebsite.trim() || undefined,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        goalAmount: listPrice ?? goalNum,
        deadline: deadlineISO,
        termsAccepted: true,
      });
      router.push(`/${tenantSlug}/${eventSlug}/items/${itemSlug}/campaigns/${res.data.id}?started=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  };
  const focusStyle = { borderColor: 'rgba(67,97,238,0.5)' };
  const blurStyle = { borderColor: 'rgba(255,255,255,0.1)' };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Package being funded */}
      <div
        className="flex items-start gap-4 p-4"
        style={{ background: 'rgba(67,97,238,0.06)', border: '1px solid rgba(67,97,238,0.15)' }}
      >
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(123,147,248,0.7)' }}>
            Funding Goal
          </p>
          <p className="font-sans text-sm font-semibold text-white">{itemTitle}</p>
          {listPrice && (
            <p className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {formatCurrency(listPrice, currency)}
            </p>
          )}
        </div>
      </div>

      {/* Entity details */}
      <fieldset className="space-y-4">
        <legend className="font-mono text-[10px] tracking-[0.35em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Your Organization
        </legend>

        <div>
          <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Organization / Community Name *
          </label>
          <input
            type="text"
            placeholder="e.g. Ethereum Madrid DAO"
            value={entityName}
            onChange={e => setEntityName(e.target.value)}
            required
            className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, blurStyle)}
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Why should your community win this? <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span>
          </label>
          <textarea
            placeholder="Tell the community what you'll do with this sponsorship..."
            value={entityDescription}
            onChange={e => setEntityDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors resize-none"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, blurStyle)}
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Website <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span>
          </label>
          <input
            type="url"
            placeholder="https://yourdao.xyz"
            value={entityWebsite}
            onChange={e => setEntityWebsite(e.target.value)}
            className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, blurStyle)}
          />
        </div>
      </fieldset>

      {/* Contact details */}
      <fieldset className="space-y-4">
        <legend className="font-mono text-[10px] tracking-[0.35em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Your Contact Details
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Full Name *
            </label>
            <input
              type="text"
              placeholder="Jane Smith"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              required
              className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors"
              style={inputStyle}
              onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={e => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Email *
            </label>
            <input
              type="email"
              placeholder="jane@yourdao.xyz"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              required
              className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors"
              style={inputStyle}
              onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={e => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>
        </div>
      </fieldset>

      {/* Campaign settings */}
      <fieldset className="space-y-4">
        <legend className="font-mono text-[10px] tracking-[0.35em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Campaign Settings
        </legend>

        {/* Goal amount — only show if no list price */}
        {!listPrice && (
          <div>
            <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Funding Goal ({currency}) *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 5000"
              value={goalAmount}
              onChange={e => setGoalAmount(e.target.value)}
              required
              className="w-full px-4 py-3 font-mono text-sm text-white outline-none transition-colors"
              style={inputStyle}
              onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={e => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>
        )}

        <div>
          <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Campaign Deadline * <span style={{ color: 'rgba(255,255,255,0.2)' }}>(max 30 days)</span>
          </label>
          <input
            type="date"
            min={tomorrow}
            max={maxDate}
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            required
            className="w-full px-4 py-3 font-mono text-sm text-white outline-none transition-colors"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, blurStyle)}
          />
          <p className="font-mono text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Your campaign will automatically expire if the goal isn't reached by this date.
          </p>
        </div>
      </fieldset>

      {/* Rules summary */}
      <div
        className="p-4 space-y-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Campaign Rules
        </p>
        {[
          'First campaign to reach the funding goal wins the sponsorship package.',
          'All other campaigns are marked as lost — contributors will be notified.',
          'If no campaign reaches the goal by the deadline, all campaigns expire.',
          'Contributions are pledges — payment is only collected from the winning campaign.',
          'You can only run one active campaign per package.',
        ].map((rule, i) => (
          <div key={i} className="flex items-baseline gap-2.5">
            <span className="font-mono text-xs flex-shrink-0" style={{ color: 'rgba(67,97,238,0.5)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="font-sans text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {rule}
            </span>
          </div>
        ))}
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={e => setTermsAccepted(e.target.checked)}
          className="mt-0.5 flex-shrink-0"
          style={{ accentColor: '#4361ee' }}
        />
        <span className="font-sans text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
          I understand the campaign rules and agree that contributions are pledges pending campaign success.
        </span>
      </label>

      {error && (
        <p className="font-sans text-sm" style={{ color: 'rgba(252,165,165,0.8)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !termsAccepted}
        className="w-full py-4 font-sans font-semibold text-white transition-all duration-200 disabled:opacity-50"
        style={{
          background: '#4361ee',
          cursor: loading || !termsAccepted ? 'not-allowed' : 'pointer',
          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
        }}
      >
        {loading ? 'Launching Campaign...' : 'Launch Campaign'}
      </button>
    </form>
  );
}
