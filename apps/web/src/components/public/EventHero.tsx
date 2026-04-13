'use client';
import Link from 'next/link';
import { MapPin, Calendar, ExternalLink, ArrowRight } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface EventHeroProps {
  event: Record<string, unknown>;
  tenantSlug: string;
  eventSlug: string;
}

export function EventHero({ event, tenantSlug, eventSlug }: EventHeroProps) {
  const branding = event.branding as Record<string, unknown> | null;
  const heroImage = branding?.heroImageUrl as string | null;
  const stats = event.stats as Record<string, unknown> | null;

  return (
    <div className="relative overflow-hidden mesh-bg min-h-[90vh] flex flex-col justify-end noise-overlay">
      {/* Grid lines */}
      <div className="absolute inset-0 grid-lines pointer-events-none" />

      {/* Hero image */}
      {heroImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void/70 to-void" />
        </>
      )}

      {/* Accent glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '15%',
          left: '10%',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(67,97,238,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '20%',
          right: '5%',
          width: '400px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(201,162,39,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 px-6 md:px-14 py-7 flex items-center justify-between z-10">
        <span className="font-mono text-[11px] tracking-[0.35em] text-white/35 uppercase">
          {event.tenant ? (event.tenant as Record<string, unknown>).name as string : 'Moongate'}
        </span>
        {!!event.websiteUrl && (
          <a
            href={event.websiteUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-white/30 hover:text-white/60 uppercase transition-colors"
          >
            Event Website
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Main content */}
      <div className="relative px-6 md:px-14 pb-20 pt-40 max-w-7xl mx-auto w-full z-10">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-8 mb-10 animate-fade-in-up">
          {!!event.city && (
            <div className="flex items-center gap-2.5">
              <MapPin className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
              <span className="font-mono text-[11px] tracking-[0.25em] text-white/45 uppercase">
                {event.city as string}{event.country ? `, ${event.country}` : ''}
              </span>
            </div>
          )}
          {!!event.startDate && (
            <div className="flex items-center gap-2.5">
              <Calendar className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
              <span className="font-mono text-[11px] tracking-[0.25em] text-white/45 uppercase">
                {new Date(event.startDate as string).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Event name */}
        <h1
          className="font-display text-white leading-[0.88] tracking-tight mb-8 animate-fade-in-up delay-100"
          style={{ fontSize: 'clamp(3.5rem, 10vw, 8rem)', fontWeight: 800 }}
        >
          {event.name as string}
        </h1>

        {!!event.tagline && (
          <p className="text-white/45 text-lg md:text-xl max-w-lg mb-12 font-sans leading-relaxed animate-fade-in-up delay-200">
            {event.tagline as string}
          </p>
        )}

        {/* Stats row */}
        {stats && (
          <div className="flex flex-wrap gap-10 mb-14 animate-fade-in-up delay-300">
            {!!stats.expectedAttendees && (
              <div>
                <div className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {formatNumber(stats.expectedAttendees as number)}+
                </div>
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase mt-1.5">
                  Attendees
                </div>
              </div>
            )}
            {!!stats.mediaReach && (
              <div>
                <div className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {formatNumber(stats.mediaReach as number)}
                </div>
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase mt-1.5">
                  Media Reach
                </div>
              </div>
            )}
            {!!stats.newsletterSubs && (
              <div>
                <div className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {formatNumber(stats.newsletterSubs as number)}
                </div>
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase mt-1.5">
                  Newsletter
                </div>
              </div>
            )}
            {!!stats.internationalPct && (
              <div>
                <div className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {stats.internationalPct as number}%
                </div>
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase mt-1.5">
                  International
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up delay-400">
          <Link href={`/${tenantSlug}/${eventSlug}/sponsor`} className="btn-primary group">
            Explore Packages
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href={`/${tenantSlug}/${eventSlug}/bid/custom-package`} className="btn-ghost">
            Submit Private Offer
          </Link>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #06060a)' }}
      />
    </div>
  );
}
