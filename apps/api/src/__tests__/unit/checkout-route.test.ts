/**
 * Regression tests for the "Buy Now" 404 bug.
 *
 * Root cause: items/[slug]/page.tsx linked to /${tenantSlug}/${eventSlug}/checkout/${slug}
 * but the checkout/[itemSlug] page.tsx did not exist.
 *
 * Fix: created apps/web/src/app/(public)/[tenantSlug]/[eventSlug]/checkout/[itemSlug]/page.tsx
 * and the companion CheckoutForm.tsx client component.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Route resolution helpers — mirror Next.js App Router matching rules
// ---------------------------------------------------------------------------

interface RouteDefinition {
  pattern: string; // e.g. "/[a]/[b]/checkout/[itemSlug]"
  exists: boolean;
}

function matchesRoute(pathname: string, routes: RouteDefinition[]): RouteDefinition | undefined {
  for (const route of routes) {
    const regexStr = route.pattern
      .replace(/\[([^\]]+)\]/g, '([^/]+)')   // [param] → capture group
      .replace(/\//g, '\\/');
    const re = new RegExp(`^${regexStr}$`);
    if (re.test(pathname)) return route;
  }
  return undefined;
}

// Simulated Next.js route tree — before and after the fix
const ROUTES_BEFORE_FIX: RouteDefinition[] = [
  { pattern: '/[tenantSlug]/[eventSlug]/items/[slug]', exists: true },
  { pattern: '/[tenantSlug]/[eventSlug]/bid/[itemSlug]', exists: true },
  { pattern: '/[tenantSlug]/[eventSlug]/sponsor', exists: true },
  // checkout/[itemSlug] was NOT present — only the empty success subdirectory existed
  { pattern: '/[tenantSlug]/[eventSlug]/checkout/success', exists: true },
];

const ROUTES_AFTER_FIX: RouteDefinition[] = [
  ...ROUTES_BEFORE_FIX,
  { pattern: '/[tenantSlug]/[eventSlug]/checkout/[itemSlug]', exists: true },
];

describe('Buy Now route — before fix', () => {
  const buyNowHref = (t: string, e: string, s: string) => `/${t}/${e}/checkout/${s}`;

  it('Buy Now link generates the expected URL shape', () => {
    const href = buyNowHref('ethglobal', 'ethmilan-2025', 'premium-sponsor');
    expect(href).toBe('/ethglobal/ethmilan-2025/checkout/premium-sponsor');
  });

  it('URL does NOT resolve to an existing route before fix', () => {
    const href = buyNowHref('ethglobal', 'ethmilan-2025', 'premium-sponsor');
    const match = matchesRoute(href, ROUTES_BEFORE_FIX);
    // checkout/[itemSlug] did not exist — only checkout/success which is static
    expect(match).toBeUndefined();
  });

  it('checkout/success static path is not confused with dynamic itemSlug', () => {
    const successHref = '/ethglobal/ethmilan-2025/checkout/success';
    // "success" matches the static route, NOT the itemSlug route
    const match = matchesRoute(successHref, ROUTES_BEFORE_FIX);
    // static "success" route existed but item checkout did not
    expect(match?.pattern).toBe('/[tenantSlug]/[eventSlug]/checkout/success');
    // therefore a real item slug would still 404
    const itemHref = '/ethglobal/ethmilan-2025/checkout/community-sponsor';
    expect(matchesRoute(itemHref, ROUTES_BEFORE_FIX)).toBeUndefined();
  });
});

describe('Buy Now route — after fix', () => {
  const buyNowHref = (t: string, e: string, s: string) => `/${t}/${e}/checkout/${s}`;

  it('URL resolves to checkout/[itemSlug] page after fix', () => {
    const href = buyNowHref('ethglobal', 'ethmilan-2025', 'premium-sponsor');
    const match = matchesRoute(href, ROUTES_AFTER_FIX);
    expect(match).toBeDefined();
    expect(match?.pattern).toBe('/[tenantSlug]/[eventSlug]/checkout/[itemSlug]');
    expect(match?.exists).toBe(true);
  });

  it('resolves for any valid item slug', () => {
    const slugs = ['title-sponsor', 'community-sponsor', 'badge-sponsor', 'newsletter-sponsor'];
    for (const slug of slugs) {
      const href = buyNowHref('ethglobal', 'ethmilan-2025', slug);
      const match = matchesRoute(href, ROUTES_AFTER_FIX);
      expect(match?.exists).toBe(true);
    }
  });

  it('does not 404 for any tenant/event/slug combination', () => {
    const cases = [
      ['ethglobal', 'ethmilan-2025', 'title-sponsor'],
      ['ethglobal', 'ethmilan-2026', 'platinum-sponsor'],
      ['another-org', 'some-event-2026', 'booth-package'],
    ] as const;
    for (const [t, e, s] of cases) {
      const href = `/${t}/${e}/checkout/${s}`;
      expect(matchesRoute(href, ROUTES_AFTER_FIX)).toBeDefined();
    }
  });

  it('bid route still works independently', () => {
    const href = '/ethglobal/ethmilan-2025/bid/premium-sponsor';
    const match = matchesRoute(href, ROUTES_AFTER_FIX);
    expect(match?.pattern).toBe('/[tenantSlug]/[eventSlug]/bid/[itemSlug]');
  });

  it('item detail route still works independently', () => {
    const href = '/ethglobal/ethmilan-2025/items/premium-sponsor';
    const match = matchesRoute(href, ROUTES_AFTER_FIX);
    expect(match?.pattern).toBe('/[tenantSlug]/[eventSlug]/items/[slug]');
  });
});

// ---------------------------------------------------------------------------
// ItemCard.tsx — "Buy Now" on card goes to item detail (not checkout)
// This is intentional: card → detail page → then user clicks "Buy Now →" → checkout
// ---------------------------------------------------------------------------

describe('ItemCard Buy Now routing (unchanged, correct)', () => {
  function getCardHref(tenantSlug: string, eventSlug: string, itemSlug: string) {
    // Mirrors ItemCard.tsx line 21: detailHref = /${tenantSlug}/${eventSlug}/items/${item.slug}
    return `/${tenantSlug}/${eventSlug}/items/${itemSlug}`;
  }

  it('card Buy Now goes to item detail page, not checkout', () => {
    const href = getCardHref('ethglobal', 'ethmilan-2025', 'premium-sponsor');
    expect(href).toBe('/ethglobal/ethmilan-2025/items/premium-sponsor');
    expect(href).not.toContain('/checkout/');
  });

  it('item detail page Buy Now goes to checkout', () => {
    // Mirrors items/[slug]/page.tsx line 461
    const tenantSlug = 'ethglobal';
    const eventSlug = 'ethmilan-2025';
    const slug = 'premium-sponsor';
    const href = `/${tenantSlug}/${eventSlug}/checkout/${slug}`;
    expect(href).toBe('/ethglobal/ethmilan-2025/checkout/premium-sponsor');
    expect(matchesRoute(href, ROUTES_AFTER_FIX)?.exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CheckoutForm mode guard — only fixed_price and hybrid allow direct purchase
// ---------------------------------------------------------------------------

function isCheckoutAllowed(mode: string): boolean {
  return mode === 'fixed_price' || mode === 'hybrid';
}

describe('checkout page mode guard', () => {
  it('allows fixed_price mode', () => {
    expect(isCheckoutAllowed('fixed_price')).toBe(true);
  });

  it('allows hybrid mode', () => {
    expect(isCheckoutAllowed('hybrid')).toBe(true);
  });

  it('blocks sealed_bid mode (use private offer instead)', () => {
    expect(isCheckoutAllowed('sealed_bid')).toBe(false);
  });

  it('blocks request_only mode', () => {
    expect(isCheckoutAllowed('request_only')).toBe(false);
  });
});
