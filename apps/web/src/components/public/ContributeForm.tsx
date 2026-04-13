'use client';
import { useState } from 'react';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface ContributeFormProps {
  campaignId: string;
  tenantSlug: string;
  eventSlug: string;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
  onSuccess?: (result: { campaignWon: boolean; newRaisedAmount: number; message: string }) => void;
}

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2500];

export function ContributeForm({
  campaignId, tenantSlug, eventSlug, goalAmount, raisedAmount, currency, onSuccess,
}: ContributeFormProps) {
  const remaining = Math.max(0, goalAmount - raisedAmount);
  const [amount, setAmount] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ campaignWon: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { setError('Please enter a valid amount.'); return; }
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email.'); return; }

    setLoading(true);
    try {
      const res = await publicApi.contribute(tenantSlug, eventSlug, campaignId, {
        contributorName: name.trim(),
        contributorEmail: email.trim(),
        amount: amountNum,
        message: message.trim() || undefined,
      });
      setSuccess({ campaignWon: res.data.campaignWon, message: res.data.message });
      onSuccess?.(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        className="p-8 text-center"
        style={{
          background: success.campaignWon ? 'rgba(201,162,39,0.06)' : 'rgba(34,197,94,0.06)',
          border: `1px solid ${success.campaignWon ? 'rgba(201,162,39,0.2)' : 'rgba(34,197,94,0.15)'}`,
        }}
      >
        <div
          className="text-3xl mb-4"
          style={{ fontFamily: 'serif' }}
        >
          {success.campaignWon ? '🏆' : '✓'}
        </div>
        <h3
          className="font-display text-xl font-bold text-white mb-3"
        >
          {success.campaignWon ? 'Campaign Goal Reached!' : 'Contribution Recorded!'}
        </h3>
        <p className="font-sans text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {success.message}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Quick amount buttons */}
      <div>
        <label
          className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-3"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Contribution Amount ({currency})
        </label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {QUICK_AMOUNTS.filter(a => a <= remaining + 1).slice(0, 6).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              className="py-2.5 font-mono text-sm transition-all duration-150"
              style={{
                background: amount === String(a) ? 'rgba(67,97,238,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${amount === String(a) ? 'rgba(67,97,238,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: amount === String(a) ? '#7b93f8' : 'rgba(255,255,255,0.5)',
              }}
            >
              {formatCurrency(a, currency)}
            </button>
          ))}
        </div>

        {/* Also show "Cover remainder" if reasonable */}
        {remaining > 0 && remaining < 10000 && (
          <button
            type="button"
            onClick={() => setAmount(String(remaining))}
            className="w-full py-2.5 font-mono text-[11px] tracking-widest uppercase transition-all duration-150 mb-3"
            style={{
              background: amount === String(remaining) ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${amount === String(remaining) ? 'rgba(201,162,39,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: amount === String(remaining) ? '#e0b83e' : 'rgba(255,255,255,0.3)',
            }}
          >
            Cover the remaining {formatCurrency(remaining, currency)}
          </button>
        )}

        <input
          type="number"
          min="1"
          step="1"
          placeholder="Custom amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full px-4 py-3 font-mono text-sm text-white outline-none transition-colors"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(67,97,238,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
      </div>

      {/* Name */}
      <div>
        <label
          className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Your Name
        </label>
        <input
          type="text"
          placeholder="Jane Smith"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(67,97,238,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
      </div>

      {/* Email */}
      <div>
        <label
          className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Email
        </label>
        <input
          type="email"
          placeholder="jane@acme.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(67,97,238,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
      </div>

      {/* Message */}
      <div>
        <label
          className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Message <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span>
        </label>
        <textarea
          placeholder="Why are you backing this campaign?"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full px-4 py-3 font-sans text-sm text-white outline-none transition-colors resize-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(67,97,238,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
      </div>

      {error && (
        <p className="font-sans text-sm" style={{ color: 'rgba(252,165,165,0.8)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 font-sans font-semibold text-white transition-all duration-200 disabled:opacity-50"
        style={{
          background: loading ? 'rgba(67,97,238,0.5)' : '#4361ee',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading
          ? 'Processing...'
          : amount
            ? `Contribute ${formatCurrency(parseFloat(amount) || 0, currency)}`
            : 'Contribute'}
      </button>

      <p className="font-mono text-[10px] tracking-wide text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Contributions are pledges. Payment details will be collected if this campaign wins.
      </p>
    </form>
  );
}
