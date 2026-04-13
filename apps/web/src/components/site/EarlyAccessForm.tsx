'use client';

import { useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/track';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const CONSENT_VERSION = '1.0';

function isValidUrl(value: string): boolean {
  if (!value) return true; // optional
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

interface EarlyAccessFormProps {
  defaultRole?: 'organizer' | 'sponsor' | 'both';
}

export function EarlyAccessForm({ defaultRole }: EarlyAccessFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [role, setRole] = useState<'organizer' | 'sponsor' | 'both' | ''>(defaultRole ?? '');
  const [consent, setConsent] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  function validateUrl(value: string) {
    if (value && !isValidUrl(value)) {
      setUrlError('Please enter a valid website or X (Twitter) URL');
      return false;
    }
    setUrlError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (!consent) return; // blocked by required attr, but guard anyway
    if (!validateUrl(website)) return;

    setStatus('loading');
    try {
      const normalizedWebsite = website
        ? (website.startsWith('http') ? website : `https://${website}`)
        : undefined;

      const res = await fetch(`${API_URL}/api/invites/early-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name.trim() || undefined,
          company: company.trim() || undefined,
          websiteUrl: normalizedWebsite,
          role: role || undefined,
          consentVersion: CONSENT_VERSION,
          consentAt: new Date().toISOString(),
        }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.message ?? 'Something went wrong');

      track({ eventType: 'cta_click', metadata: { action: 'early_access_signup', role, consent: true } });
      setStatus('success');
      setMessage(
        json.alreadyRegistered
          ? "You're already on the list! We'll be in touch soon."
          : "You're on the list! We'll reach out when a spot opens up.",
      );
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="glass rounded-xl px-8 py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3.75 9L7.5 12.75L14.25 6" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-white font-medium mb-1">You&apos;re in!</p>
        <p className="text-sm text-white/50">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {/* Name + Email row */}
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor="ea-name" className="sr-only">Full name</label>
          <input
            id="ea-name"
            type="text"
            placeholder="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
          />
        </div>
        <div>
          <label htmlFor="ea-email" className="sr-only">Email address</label>
          <input
            id="ea-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
          />
        </div>
      </div>

      {/* Company + Website/X URL row */}
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor="ea-company" className="sr-only">Company</label>
          <input
            id="ea-company"
            type="text"
            placeholder="Company (optional)"
            value={company}
            onChange={e => setCompany(e.target.value)}
            autoComplete="organization"
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
          />
        </div>
        <div>
          <label htmlFor="ea-website" className="sr-only">Website or X URL</label>
          <input
            id="ea-website"
            type="text"
            placeholder="Website or X URL (optional)"
            value={website}
            onChange={e => { setWebsite(e.target.value); if (urlError) validateUrl(e.target.value); }}
            onBlur={() => validateUrl(website)}
            autoComplete="url"
            className={`w-full bg-white/[0.06] border rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:bg-white/[0.08] transition-all ${
              urlError ? 'border-red-500/50 focus:border-red-500/60' : 'border-white/10 focus:border-indigo-500/50'
            }`}
          />
          {urlError && <p className="text-xs text-red-400 mt-1">{urlError}</p>}
        </div>
      </div>

      {/* Role selector */}
      <div className="flex flex-wrap items-center gap-2">
        {(['organizer', 'sponsor', 'both'] as const).map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(role === r ? '' : r)}
            aria-pressed={role === r}
            className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
              role === r
                ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                : 'border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
            }`}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
        <span className="text-xs text-white/20">I&apos;m a...</span>
      </div>

      {/* Legal consent */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            required
            className="sr-only peer"
            aria-describedby="ea-consent-desc"
          />
          <div className={`w-4 h-4 rounded border transition-all peer-focus:ring-2 peer-focus:ring-indigo-500 peer-focus:ring-offset-1 peer-focus:ring-offset-void ${
            consent ? 'bg-indigo-500 border-indigo-500' : 'bg-white/[0.05] border-white/20 group-hover:border-white/30'
          }`}>
            {consent && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="absolute inset-0 m-auto" aria-hidden="true">
                <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span id="ea-consent-desc" className="text-xs text-white/40 leading-relaxed">
          I agree to the{' '}
          <Link href="/terms" className="text-white/70 underline underline-offset-2 hover:text-white transition-colors">
            Terms &amp; Conditions
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-white/70 underline underline-offset-2 hover:text-white transition-colors">
            Data Privacy Protection Agreement
          </Link>
          . <span className="text-red-400/70">*</span>
        </span>
      </label>

      {status === 'error' && (
        <p className="text-sm text-red-400 text-center">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !consent}
        className="w-full btn-primary px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Joining...' : 'Join waitlist'}
      </button>

      <p className="text-xs text-white/25 text-center">No spam. Unsubscribe at any time.</p>
    </form>
  );
}
