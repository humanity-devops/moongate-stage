'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

function buildBidSchema(minimumBid: number | null, maximumBid: number | null) {
  let budgetSchema = z.number({ invalid_type_error: 'Enter a valid budget' }).positive('Budget must be positive');
  if (minimumBid !== null) {
    budgetSchema = budgetSchema.min(minimumBid, `Minimum offer is ${minimumBid.toLocaleString()}`);
  }
  if (maximumBid !== null) {
    budgetSchema = budgetSchema.max(maximumBid, `Maximum offer is ${maximumBid.toLocaleString()}`);
  }
  return z.object({
    companyName: z.string().min(1, 'Company name required'),
    contactName: z.string().min(1, 'Contact name required'),
    email: z.string().email('Valid email required'),
    telegram: z.string().optional(),
    whatsapp: z.string().optional(),
    proposedBudget: budgetSchema,
    currency: z.string().default('USD'),
    notes: z.string().max(2000).optional(),
    customAsks: z.string().max(1000).optional(),
    termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  });
}

type BidFormData = {
  companyName: string;
  contactName: string;
  email: string;
  telegram?: string;
  whatsapp?: string;
  proposedBudget: number;
  currency: string;
  notes?: string;
  customAsks?: string;
  termsAccepted: true;
};

interface BidFormProps {
  tenantSlug: string;
  eventSlug: string;
  itemSlug: string;
  listPrice?: number | null;
  minimumBid?: number | null;
  maximumBid?: number | null;
  currency?: string;
  mode?: string;
}

export function BidForm({
  tenantSlug, eventSlug, itemSlug,
  listPrice, minimumBid = null, maximumBid = null,
  currency = 'USD', mode,
}: BidFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bidSchema = buildBidSchema(minimumBid, maximumBid);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BidFormData>({
    resolver: zodResolver(bidSchema),
    defaultValues: { currency, proposedBudget: listPrice ? Math.round(listPrice * 0.8) : (minimumBid ?? undefined) },
  });

  async function onSubmit(data: BidFormData) {
    setError(null);
    try {
      await publicApi.submitBid(tenantSlug, eventSlug, itemSlug, data);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-white mb-2">Offer Submitted!</h3>
        <p className="text-gray-400">
          Thank you! Your private offer has been submitted to the organizers.
          You'll hear back within 2 business days.
        </p>
      </div>
    );
  }

  const hasPriceRange = minimumBid !== null || maximumBid !== null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Company Name *</label>
          <input
            {...register('companyName')}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
            placeholder="Acme Protocol"
          />
          {errors.companyName && <p className="text-red-400 text-xs mt-1">{errors.companyName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name *</label>
          <input
            {...register('contactName')}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
            placeholder="Alice Chen"
          />
          {errors.contactName && <p className="text-red-400 text-xs mt-1">{errors.contactName.message}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address *</label>
        <input
          {...register('email')}
          type="email"
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
          placeholder="alice@company.xyz"
        />
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
      </div>

      {/* Optional contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Telegram <span className="text-gray-500">(optional)</span></label>
          <input
            {...register('telegram')}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
            placeholder="@username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">WhatsApp <span className="text-gray-500">(optional)</span></label>
          <input
            {...register('whatsapp')}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>

      {/* Budget */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Your Offer ({currency}) *
          {listPrice && (
            <span className="text-gray-500 ml-2 font-normal text-xs">
              Listed: {formatCurrency(listPrice, currency)}
            </span>
          )}
        </label>
        {hasPriceRange && (
          <div
            className="mb-2 px-3 py-2 rounded-lg text-xs font-mono"
            style={{ background: 'rgba(123,147,248,0.06)', border: '1px solid rgba(123,147,248,0.15)', color: 'rgba(123,147,248,0.8)' }}
          >
            {minimumBid !== null && maximumBid !== null && (
              <>Accepted range: {formatCurrency(minimumBid, currency)} – {formatCurrency(maximumBid, currency)}</>
            )}
            {minimumBid !== null && maximumBid === null && (
              <>Minimum offer: {formatCurrency(minimumBid, currency)}</>
            )}
            {minimumBid === null && maximumBid !== null && (
              <>Maximum offer: {formatCurrency(maximumBid, currency)}</>
            )}
          </div>
        )}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
          <input
            {...register('proposedBudget', { valueAsNumber: true })}
            type="number"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
            placeholder={minimumBid ? String(minimumBid) : '25000'}
            min={minimumBid ?? 0}
            max={maximumBid ?? undefined}
            step={1}
          />
        </div>
        {errors.proposedBudget && (
          <p className="text-red-400 text-xs mt-1">{errors.proposedBudget.message}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Message to Organizers <span className="text-gray-500">(optional)</span></label>
        <textarea
          {...register('notes')}
          rows={4}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors resize-none"
          placeholder="Tell us about your company, your goals for the sponsorship, or any questions you have..."
        />
      </div>

      {/* Custom asks */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Custom Requests <span className="text-gray-500">(optional)</span></label>
        <textarea
          {...register('customAsks')}
          rows={2}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors resize-none"
          placeholder="Any specific customizations, topic requests, or add-ons you'd like to discuss?"
        />
      </div>

      {/* Terms */}
      <div className="flex items-start gap-3">
        <input
          {...register('termsAccepted')}
          type="checkbox"
          id="terms"
          className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="terms" className="text-sm text-gray-400">
          I understand that this is a private offer and agree that my information will be shared with the event organizers only.
          I accept the{' '}
          <a href="#" className="text-brand-400 hover:text-brand-300 underline">terms of service</a>.
        </label>
      </div>
      {errors.termsAccepted && <p className="text-red-400 text-xs">{errors.termsAccepted.message}</p>}

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-colors"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Private Offer'}
      </button>

      <p className="text-center text-xs text-gray-500">
        Your offer is completely private. Only event organizers can see your submission.
      </p>
    </form>
  );
}
