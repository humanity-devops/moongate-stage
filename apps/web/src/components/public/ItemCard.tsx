import Link from 'next/link';
import { formatCurrency, getCategoryLabel, getModeLabel, getItemsRemaining, isLimitedAvailability } from '@/lib/utils';
import { Zap, Lock, ArrowUpRight } from 'lucide-react';

interface ItemCardProps {
  item: Record<string, unknown>;
  tenantSlug: string;
  eventSlug: string;
  animationDelay?: number;
}

export function ItemCard({ item, tenantSlug, eventSlug, animationDelay = 0 }: ItemCardProps) {
  const remaining = getItemsRemaining(item as { quantityTotal?: number; quantitySold?: number });
  const limited = isLimitedAvailability(item as { quantityTotal?: number; quantitySold?: number });
  const isSoldOut = item.status === 'sold_out' || remaining === 0;
  const isFeatured = item.featured as boolean;
  const isExclusive = item.isExclusive as boolean;
  const mode = item.mode as string;
  const listPrice = item.listPrice as number | null;
  const benefits = (item.benefits as unknown[]) ?? [];
  const detailHref = `/${tenantSlug}/${eventSlug}/items/${item.slug}`;

  return (
    <div
      className={`relative flex flex-col item-card ${isFeatured ? 'item-card-featured' : ''} ${isSoldOut ? 'opacity-60' : ''}`}
      style={{
        background: '#0d0d14',
        border: `1px solid ${isFeatured ? 'rgba(201,162,39,0.2)' : 'rgba(255,255,255,0.07)'}`,
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Featured gold top bar */}
      {isFeatured && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #c9a227, transparent)' }}
        />
      )}

      {/* Sold-out overlay marker */}
      {isSoldOut && (
        <div
          className="absolute top-4 right-4 font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'rgba(252,165,165,0.7)',
          }}
        >
          {item.soldBadgeText as string || 'Sold Out'}
        </div>
      )}

      {/* Main clickable area → detail page */}
      <Link href={detailHref} className="flex flex-col flex-1 p-6 pb-5 group">
        {/* Category + badges row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <span
            className="font-mono text-[10px] tracking-[0.3em] uppercase"
            style={{ color: '#7b93f8' }}
          >
            {getCategoryLabel(item.category as string)}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isFeatured && (
              <span
                className="font-mono text-[9px] tracking-[0.2em] uppercase px-2 py-0.5"
                style={{
                  background: 'rgba(201,162,39,0.12)',
                  border: '1px solid rgba(201,162,39,0.25)',
                  color: '#e0b83e',
                }}
              >
                Featured
              </span>
            )}
            {isExclusive && (
              <span
                className="flex items-center gap-1 font-mono text-[9px] tracking-[0.2em] uppercase px-2 py-0.5"
                style={{
                  background: 'rgba(168,85,247,0.1)',
                  border: '1px solid rgba(168,85,247,0.2)',
                  color: 'rgba(216,180,254,0.8)',
                }}
              >
                <Lock className="w-2.5 h-2.5" />
                Excl
              </span>
            )}
            {limited && !isSoldOut && (
              <span
                className="font-mono text-[9px] tracking-[0.2em] uppercase px-2 py-0.5"
                style={{
                  background: 'rgba(249,115,22,0.1)',
                  border: '1px solid rgba(249,115,22,0.2)',
                  color: 'rgba(253,186,116,0.8)',
                }}
              >
                {remaining} left
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          className="font-display text-xl font-bold leading-snug mb-2.5 group-hover:text-brand-400 transition-colors"
          style={{ color: '#f1f0ff' }}
        >
          {item.publicTitle as string}
          <ArrowUpRight
            className="inline-block w-4 h-4 ml-1.5 opacity-0 group-hover:opacity-40 transition-opacity -translate-y-0.5"
          />
        </h3>

        {/* Description */}
        {!!item.shortDescription && (
          <p
            className="text-sm leading-relaxed mb-5 line-clamp-2"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {item.shortDescription as string}
          </p>
        )}

        {/* Top benefits */}
        {benefits.length > 0 && (
          <div className="space-y-2 flex-1">
            {(benefits as Record<string, unknown>[]).slice(0, 3).map((b, i) => (
              <div key={i} className="flex items-baseline gap-2.5 text-sm">
                <span
                  className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: 'rgba(67,97,238,0.6)' }}
                />
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {b.label as string}
                  {b.value ? (
                    <span className="font-mono text-xs ml-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      — {b.value as string}
                    </span>
                  ) : null}
                  {b.quantity ? (
                    <span className="font-mono text-xs ml-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      × {b.quantity as string}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
            {benefits.length > 3 && (
              <div
                className="font-mono text-[11px] tracking-wider pl-3.5"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                +{benefits.length - 3} more included
              </div>
            )}
          </div>
        )}
      </Link>

      {/* Price + CTA — outside the main link */}
      <div
        className="px-6 pb-6 pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Price row */}
        <div className="flex items-end justify-between mb-4">
          <div>
            {mode === 'request_only' || item.onRequest ? (
              <span
                className="font-sans font-medium text-sm"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                On request
              </span>
            ) : mode === 'sealed_bid' ? (
              <div>
                <div
                  className="font-mono text-[10px] tracking-widest uppercase mb-1"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  Starting from
                </div>
                <div className="font-mono text-2xl font-semibold text-white tabular-nums">
                  {listPrice ? formatCurrency(listPrice, item.currency as string) : '—'}
                </div>
              </div>
            ) : listPrice ? (
              <div className="font-mono text-2xl font-semibold text-white tabular-nums">
                {formatCurrency(listPrice, item.currency as string)}
              </div>
            ) : (
              <span
                className="font-sans font-medium text-sm"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Private offer only
              </span>
            )}
          </div>
          <span
            className="font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            {getModeLabel(mode)}
          </span>
        </div>

        {/* Action buttons */}
        {isSoldOut ? (
          <button
            disabled
            className="w-full py-3 font-sans font-semibold text-sm cursor-not-allowed"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Sold Out
          </button>
        ) : (
          <div className="flex gap-2">
            {(mode === 'fixed_price' || mode === 'hybrid') && (
              <Link
                href={detailHref}
                className="flex-1 py-3 font-sans font-semibold text-sm text-center text-white bg-brand-500 hover:bg-brand-600 transition-colors duration-200"
              >
                {mode === 'hybrid' ? 'Buy Now' : 'Get Package'}
              </Link>
            )}
            {(mode === 'sealed_bid' || mode === 'hybrid' || mode === 'request_only') && (
              <Link
                href={`/${tenantSlug}/${eventSlug}/bid/${item.slug}`}
                className={`${mode === 'hybrid' ? '' : 'flex-1'} flex items-center justify-center gap-1.5 py-3 px-4 font-sans font-semibold text-sm text-white transition-all duration-200`}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Zap className="w-3.5 h-3.5" />
                {mode === 'request_only' ? 'Request' : 'Private Offer'}
              </Link>
            )}
            {mode === 'fixed_price' && (
              <Link
                href={detailHref}
                className="flex items-center justify-center py-3 px-3.5 text-sm transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.45)',
                }}
                title="View details"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
