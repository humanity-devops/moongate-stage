'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { publicApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, Loader2 } from 'lucide-react';

const checkoutSchema = z.object({
  companyName: z.string().min(1, 'Company name required'),
  contactName: z.string().min(1, 'Your name required'),
  email: z.string().email('Valid email required'),
  telegram: z.string().optional(),
  notes: z.string().max(1000).optional(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

interface CheckoutFormProps {
  tenantSlug: string;
  eventSlug: string;
  itemSlug: string;
  listPrice: number | null; // dueNow amount
  currency: string;
  depositEnabled?: boolean;
  depositPercentage?: number;
}

export function CheckoutForm({ tenantSlug, eventSlug, itemSlug, listPrice, currency, depositEnabled, depositPercentage }: CheckoutFormProps) {
  // 'form' | 'redirecting' | 'reserve_success' | 'error'
  const [stage, setStage] = useState<'form' | 'redirecting' | 'reserve_success'>('form');
  const [error, setError] = useState<string | null>(null);
  const [reserveMessage, setReserveMessage] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  async function onSubmit(data: CheckoutFormData) {
    setError(null);

    if (!listPrice || !Number.isFinite(listPrice) || listPrice <= 0) {
      setError('This package is not configured for direct purchase. Please submit a custom bid instead.');
      return;
    }

    try {
      const result = await publicApi.startCheckout(tenantSlug, eventSlug, itemSlug, {
        companyName: data.companyName,
        contactName: data.contactName,
        email: data.email,
        telegram: data.telegram,
        notes: data.notes,
        termsAccepted: true,
      });

      if (result.data.mode === 'stripe_redirect') {
        // Redirect to Stripe-hosted checkout
        setStage('redirecting');
        window.location.href = result.data.checkoutUrl!;
      } else {
        // Stripe not configured — show reserve success
        setReserveMessage(result.data.message ?? '');
        setStage('reserve_success');
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'SOLD_OUT' || err.message?.includes('sold out')) {
        setError('This package is no longer available. Please choose another package.');
      } else if (err.code === 'ALREADY_PURCHASED') {
        setError('You have already purchased this package. Check your email for your invoice.');
      } else {
        setError(err.message ?? 'Something went wrong. Please try again.');
      }
    }
  }

  if (stage === 'redirecting') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        <p className="text-sm text-white/50">Redirecting to secure payment...</p>
      </div>
    );
  }

  if (stage === 'reserve_success') {
    return (
      <div
        className="p-8 text-center"
        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
      >
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-4" />
        <h3 className="font-display text-xl font-bold text-white mb-2">Purchase Request Received</h3>
        <p className="text-sm leading-relaxed mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {reserveMessage ||
            'The organizers will review your request and send a secure payment link to your email within 2 business days.'}
        </p>
        {listPrice && (
          <p className="font-mono text-sm text-green-400 mt-3">
            Package total: {formatCurrency(listPrice, currency)}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Telegram <span className="text-gray-500">(optional)</span>
        </label>
        <input
          {...register('telegram')}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
          placeholder="@username"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Message for organizers <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors resize-none"
          placeholder="Questions, custom requests, or anything you'd like the organizer to know..."
        />
      </div>

      {/* Price line */}
      {listPrice && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-sm text-white/50">
            {depositEnabled
              ? `Due now (${depositPercentage ?? 30}% deposit)`
              : 'Package total'}
          </span>
          <span className="font-mono font-semibold text-white tabular-nums">
            {formatCurrency(listPrice, currency)}
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <input
          {...register('termsAccepted')}
          type="checkbox"
          id="terms"
          className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="terms" className="text-sm text-gray-400">
          I agree my details will be shared with the event organizer to process this purchase, and I accept the{' '}
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
        className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          `${listPrice ? `Pay ${formatCurrency(listPrice, currency)}${depositEnabled ? ' deposit' : ''}` : 'Complete Purchase'} →`
        )}
      </button>

      <p className="text-center text-xs text-gray-500">
        Payments are processed securely by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  );
}
