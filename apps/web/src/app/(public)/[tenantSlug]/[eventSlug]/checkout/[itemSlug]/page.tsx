import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicApi } from '@/lib/api';
import { CheckoutForm } from './CheckoutForm';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Lock } from 'lucide-react';

interface PageProps {
  params: { tenantSlug: string; eventSlug: string; itemSlug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: item } = await publicApi.getItem(params.tenantSlug, params.eventSlug, params.itemSlug);
    return { title: `Purchase ${item.publicTitle as string}` };
  } catch {
    return { title: 'Purchase Package' };
  }
}

export default async function CheckoutPage({ params }: PageProps) {
  const { tenantSlug, eventSlug, itemSlug } = params;

  let item: Record<string, unknown>;
  let event: Record<string, unknown>;

  try {
    const [itemRes, eventRes] = await Promise.all([
      publicApi.getItem(tenantSlug, eventSlug, itemSlug),
      publicApi.getEvent(tenantSlug, eventSlug),
    ]);
    item = itemRes.data;
    event = eventRes.data;
  } catch {
    notFound();
  }

  // Only fixed_price and hybrid items support direct purchase
  const mode = item.mode as string;
  if (mode !== 'fixed_price' && mode !== 'hybrid') {
    notFound();
  }

  // Sold-out items cannot be purchased
  const quantityTotal = item.quantityTotal as number | null;
  const quantitySold = item.quantitySold as number;
  const isSoldOut = item.status === 'sold_out' || (quantityTotal !== null && quantitySold >= quantityTotal);

  const rawListPrice = item.listPrice as number | string | null;
  const listPrice = rawListPrice === null ? null : Number(rawListPrice);
  const currency = (item.currency as string) ?? 'USD';
  const depositEnabled = Boolean(item.depositEnabled);
  const depositPercentage = Number(item.depositPercentage ?? 30);
  // dueNow: deposit % of full price (divide by 100 since depositPercentage is e.g. 30 not 0.30)
  const dueNow = depositEnabled && listPrice
    ? Math.round((listPrice * depositPercentage / 100) * 100) / 100
    : listPrice;
  const balanceDue = listPrice && dueNow ? Math.round((listPrice - dueNow) * 100) / 100 : null;
  const finalPaymentDays = Number(item.finalPaymentDays ?? 0);
  const benefits = (item.benefits as { label: string; value?: string; quantity?: number }[]) ?? [];

  return (
    <div className="min-h-screen bg-void">
      {/* Nav */}
      <div
        className="px-6 md:px-10 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link
            href={`/${tenantSlug}/${eventSlug}/items/${itemSlug}`}
            className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <ArrowLeft className="w-3 h-3" />
            {item.publicTitle as string}
          </Link>
          <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <span
            className="font-mono text-[11px] tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Purchase
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 py-14">
        {isSoldOut ? (
          <div className="text-center py-20">
            <p className="text-white/40 mb-4">This package is no longer available.</p>
            <Link
              href={`/${tenantSlug}/${eventSlug}/sponsor`}
              className="font-mono text-[11px] tracking-widest uppercase text-brand-400 hover:text-brand-300 transition-colors"
            >
              ← Browse other packages
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left: Order summary */}
            <div>
              <div
                className="sticky top-8 p-8"
                style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p
                  className="font-mono text-[10px] tracking-[0.3em] uppercase mb-4"
                  style={{ color: '#7b93f8' }}
                >
                  {event.name as string}
                </p>
                <h2 className="font-display text-2xl font-bold text-white mb-3">
                  {item.publicTitle as string}
                </h2>
                {!!item.shortDescription && (
                  <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {item.shortDescription as string}
                  </p>
                )}

                {/* Price */}
                {listPrice && (
                  <div
                    className="flex items-center justify-between p-4 mb-6"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div>
                      <div
                        className="font-mono text-[10px] tracking-widest uppercase mb-1"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                      >
                        Package price
                      </div>
                      <div className="font-mono text-2xl font-semibold text-white tabular-nums">
                        {formatCurrency(listPrice, currency)}
                      </div>
                      {depositEnabled && dueNow && (
                        <p className="font-mono text-xs mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          Due now: {formatCurrency(dueNow, currency)} ({depositPercentage}% deposit)
                          {balanceDue !== null ? ` · Remaining: ${formatCurrency(balanceDue, currency)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {benefits.length > 0 && (
                  <div className="mb-4">
                    <h3
                      className="font-mono text-[10px] tracking-[0.3em] uppercase mb-3"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      What&apos;s included
                    </h3>
                    <div className="space-y-2">
                      {benefits.slice(0, 6).map((b, i) => (
                        <div key={i} className="flex items-baseline gap-2.5 text-sm">
                          <span
                            className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5"
                            style={{ background: 'rgba(67,97,238,0.5)' }}
                          />
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {b.label}
                            {b.value && (
                              <span className="font-mono text-xs ml-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                — {b.value}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                      {benefits.length > 6 && (
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          +{benefits.length - 6} more included
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Security note */}
                <div
                  className="flex items-start gap-3 p-4 mt-4"
                  style={{ background: 'rgba(67,97,238,0.05)', border: '1px solid rgba(67,97,238,0.12)' }}
                >
                  <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'rgba(123,147,248,0.7)' }} />
                  <p className="font-sans text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Your details are shared only with the event organizers. Payment is processed securely via Stripe.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Checkout form */}
            <div>
              <div className="mb-8">
                <p
                  className="font-mono text-[11px] tracking-[0.35em] uppercase mb-4"
                  style={{ color: '#7b93f8' }}
                >
                  Complete Purchase
                </p>
                <h1 className="font-display text-4xl font-bold text-white mb-3">
                  Your Details
                </h1>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {depositEnabled
                    ? `Pay the ${depositPercentage}% deposit now to secure this sponsorship package.`
                    : 'Enter your details and pay securely via Stripe. Your invoice will be emailed automatically on payment confirmation.'}
                  {depositEnabled && finalPaymentDays > 0
                    ? ` Final payment reminder will be sent in ${finalPaymentDays} day${finalPaymentDays === 1 ? '' : 's'}.`
                    : ''}
                </p>
              </div>

              <CheckoutForm
                tenantSlug={tenantSlug}
                eventSlug={eventSlug}
                itemSlug={itemSlug}
                listPrice={Number.isFinite(dueNow ?? NaN) ? dueNow : null}
                currency={currency}
                depositEnabled={depositEnabled}
                depositPercentage={depositPercentage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
