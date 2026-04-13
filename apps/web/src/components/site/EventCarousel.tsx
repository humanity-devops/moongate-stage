'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { track } from '@/lib/track';

type CarouselEvent = {
  id: string;
  name: string;
  tagline?: string;
  city?: string;
  country?: string;
  startDate?: string;
  slug: string;
  tenant: { name: string; slug: string };
  branding?: { primaryColor?: string; logoUrl?: string };
  _count: { sponsorItems: number };
};

interface EventCarouselProps {
  events: CarouselEvent[];
}

const INTERVAL_MS = 5000;

export function EventCarousel({ events }: EventCarouselProps) {
  const slides = events.slice(0, 4);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((index: number) => {
    setActive(((index % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Auto-rotate
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setTimeout(next, INTERVAL_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active, paused, next, slides.length]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { prev(); setPaused(true); }
      if (e.key === 'ArrowRight') { next(); setPaused(true); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev]);

  if (slides.length === 0) return null;

  const ev = slides[active];
  const accent = ev.branding?.primaryColor ?? '#4361ee';
  const dateStr = ev.startDate
    ? new Date(ev.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div
      className="relative overflow-hidden border-b border-white/[0.06]"
      style={{ background: 'linear-gradient(135deg, #0d0d14 0%, #0a0a12 100%)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-label="Featured events carousel"
      aria-live="polite"
    >
      {/* Glow behind accent */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none transition-all duration-700"
        style={{ background: `radial-gradient(ellipse 60% 60% at 70% 50%, ${accent}, transparent)` }}
      />

      <div className="max-w-7xl mx-auto px-6 py-10 md:py-14">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest">Featured</p>
          {/* Pagination indicators */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Slide indicators">
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === active}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => { goTo(i); setPaused(true); }}
                className={`rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  i === active ? 'w-6 h-1.5 bg-indigo-400' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Slide content */}
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div key={ev.id} className="animate-fade-in">
            {/* Accent bar */}
            <div className="h-0.5 w-12 rounded-full mb-5" style={{ background: accent }} />

            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
              {ev.name}
            </h2>
            {ev.tagline && (
              <p className="text-white/50 text-base mb-5 leading-relaxed max-w-lg">{ev.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-white/40">
              {(ev.city || ev.country) && (
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 11C6 11 2 8 2 5a4 4 0 118 0c0 3-4 6-4 6Z" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  {[ev.city, ev.country].filter(Boolean).join(', ')}
                </span>
              )}
              {dateStr && (
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <rect x="1.5" y="2" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M4 1V3M8 1V3M1.5 5H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {dateStr}
                </span>
              )}
              {ev._count.sponsorItems > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ color: accent, backgroundColor: `${accent}18`, border: `1px solid ${accent}28` }}
                >
                  {ev._count.sponsorItems} packages
                </span>
              )}
            </div>

            <Link
              href={`/${ev.tenant.slug}/${ev.slug}`}
              className="inline-flex items-center gap-2 btn-primary text-sm px-5 py-2.5"
              onClick={() => track({ eventType: 'cta_click', metadata: { action: 'carousel_view_event', eventSlug: ev.slug, position: active } })}
              style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
            >
              View packages
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Visual panel */}
          <div className="hidden md:flex items-center justify-center">
            <div
              className="w-48 h-48 rounded-2xl flex items-center justify-center text-5xl font-display font-bold transition-all duration-500"
              style={{
                background: `linear-gradient(135deg, ${accent}25, ${accent}08)`,
                border: `1px solid ${accent}30`,
                color: accent,
                boxShadow: `0 0 60px ${accent}12`,
              }}
              aria-hidden="true"
            >
              {ev.name.charAt(0)}
            </div>
          </div>
        </div>

        {/* Prev/next controls */}
        {slides.length > 1 && (
          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={() => { prev(); setPaused(true); }}
              className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Previous event"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => { next(); setPaused(true); }}
              className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Next event"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-xs text-white/20 ml-2 font-mono">{active + 1} / {slides.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}
