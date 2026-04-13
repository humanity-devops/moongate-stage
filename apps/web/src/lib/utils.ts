import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined, currency = 'USD'): string {
  if (amount == null) return 'On request';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

export function getModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    fixed_price: 'Fixed Price',
    sealed_bid: 'Private Offer',
    hybrid: 'Buy Now or Offer',
    request_only: 'Request Only',
  };
  return labels[mode] ?? mode;
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    title_sponsorship: 'Title Sponsor',
    sponsor_pack: 'Sponsor Package',
    booth: 'Booth',
    stage: 'Stage',
    branding: 'Branding',
    media: 'Media',
    food_beverage: 'Food & Beverage',
    badge: 'Badge / Lanyard',
    ad_placement: 'Ad Placement',
    side_event: 'Side Event',
    custom: 'Custom',
    other: 'Other',
  };
  return labels[category] ?? category;
}

export function getStatusBadge(status: string): { label: string; class: string } {
  const map: Record<string, { label: string; class: string }> = {
    published: { label: 'Available', class: 'bg-green-500/20 text-green-400' },
    sold_out: { label: 'Sold Out', class: 'bg-red-500/20 text-red-400' },
    reserved: { label: 'Reserved', class: 'bg-yellow-500/20 text-yellow-400' },
    draft: { label: 'Draft', class: 'bg-gray-500/20 text-gray-400' },
    limited: { label: 'Limited', class: 'bg-orange-500/20 text-orange-400' },
  };
  return map[status] ?? { label: status, class: 'bg-gray-500/20 text-gray-400' };
}

export function getItemsRemaining(item: { quantityTotal?: number | null; quantitySold?: number }): number | null {
  if (!item.quantityTotal) return null;
  return Math.max(0, item.quantityTotal - (item.quantitySold ?? 0));
}

export function isLimitedAvailability(item: { quantityTotal?: number | null; quantitySold?: number }): boolean {
  const remaining = getItemsRemaining(item);
  if (remaining === null) return false;
  return remaining <= 2 && remaining > 0;
}
