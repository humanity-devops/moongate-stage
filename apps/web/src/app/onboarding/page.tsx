'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Step = 1 | 2 | 3;

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AUD'] as const;
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [slugTimer, setSlugTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    currency: 'USD' as typeof CURRENCIES[number],
    timezone: 'UTC',
  });

  const [result, setResult] = useState<{ tenantId: string; tenantSlug: string; adminUrl: string } | null>(null);

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleNameChange(name: string) {
    setField('tenantName', name);
    const slug = slugify(name);
    setField('tenantSlug', slug);
    if (slug.length >= 3) checkSlug(slug);
  }

  function handleSlugChange(slug: string) {
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    setField('tenantSlug', clean);
    if (clean.length >= 3) checkSlug(clean);
    else setSlugStatus('idle');
  }

  function checkSlug(slug: string) {
    if (slugTimer) clearTimeout(slugTimer);
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/onboarding/check-slug?slug=${encodeURIComponent(slug)}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.data.available && data.data.error) {
            setSlugStatus('invalid');
          } else {
            setSlugStatus(data.data.available ? 'available' : 'taken');
          }
        }
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    setSlugTimer(t);
  }

  async function handleProvision() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/onboarding/provision`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? 'Something went wrong.');
      }
      setResult(data.data);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  const slugIndicator = {
    idle: null,
    checking: <span className="text-white/30 text-xs">Checking...</span>,
    available: <span className="text-green-400 text-xs">Available</span>,
    taken: <span className="text-red-400 text-xs">Already taken</span>,
    invalid: <span className="text-yellow-400 text-xs">Invalid slug</span>,
  }[slugStatus];

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#4361ee" strokeWidth="1.5" fill="none" />
                <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="#4361ee" opacity="0.6" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3] as const).map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-colors ${
                s < step
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : s === step
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-white/20 text-white/20'
              }`}>
                {s < step ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                ) : s}
              </div>
              {s < 3 && <div className={`flex-1 h-px ${s < step ? 'bg-indigo-500/40' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl border border-white/[0.08] p-8">
          {/* Step 1: Profile */}
          {step === 1 && (
            <>
              <h1 className="font-display text-xl font-bold text-white mb-1">Welcome to Moongate</h1>
              <p className="text-white/40 text-sm mb-6">
                Let&apos;s set up your organization. You&apos;ll be able to create events and list sponsorship packages.
              </p>
              <div className="space-y-4">
                <div className="glass-light rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-white/30 text-xs uppercase tracking-wide mb-3">What you get</p>
                  <div className="space-y-2">
                    {[
                      'Your own event pages and sponsorship marketplace',
                      'AI-powered deck extraction and item creation',
                      'Bid management, invoicing, and KYC workflows',
                    ].map(item => (
                      <div key={item} className="flex gap-2 text-sm">
                        <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3 3 7-7" />
                        </svg>
                        <span className="text-white/60">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full mt-6 btn-primary py-3 text-sm font-semibold"
                style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
              >
                Set up my organization
              </button>
            </>
          )}

          {/* Step 2: Organization setup */}
          {step === 2 && (
            <>
              <h1 className="font-display text-xl font-bold text-white mb-1">Organization details</h1>
              <p className="text-white/40 text-sm mb-6">This creates your workspace on Moongate.</p>

              {error && (
                <div className="mb-5 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">
                    Organization name <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
                    placeholder="TechConf Events"
                    value={form.tenantName}
                    onChange={e => handleNameChange(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-white/50 uppercase tracking-wide">
                      URL slug <span className="text-indigo-400">*</span>
                    </label>
                    {slugIndicator}
                  </div>
                  <div className="flex items-center gap-0">
                    <span className="bg-white/[0.02] border border-r-0 border-white/10 rounded-l-lg px-3 py-2.5 text-white/30 text-sm shrink-0">
                      moongate.xyz/
                    </span>
                    <input
                      type="text"
                      className={`flex-1 bg-white/[0.04] border rounded-r-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none transition-colors ${
                        slugStatus === 'available'
                          ? 'border-green-500/40 focus:border-green-500/60'
                          : slugStatus === 'taken' || slugStatus === 'invalid'
                            ? 'border-red-500/40 focus:border-red-500/60'
                            : 'border-white/10 focus:border-indigo-500/60'
                      }`}
                      placeholder="techconf-events"
                      value={form.tenantSlug}
                      onChange={e => handleSlugChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">
                      Currency
                    </label>
                    <select
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
                      value={form.currency}
                      onChange={e => setField('currency', e.target.value)}
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">
                      Timezone
                    </label>
                    <select
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
                      value={form.timezone}
                      onChange={e => setField('timezone', e.target.value)}
                    >
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 text-sm hover:text-white hover:border-white/20 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleProvision}
                  disabled={
                    submitting ||
                    !form.tenantName ||
                    !form.tenantSlug ||
                    slugStatus === 'taken' ||
                    slugStatus === 'invalid' ||
                    slugStatus === 'checking'
                  }
                  className="flex-1 btn-primary py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                >
                  {submitting ? 'Creating...' : 'Create organization'}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && result && (
            <>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="font-display text-xl font-bold text-white mb-2">
                  {form.tenantName} is ready
                </h1>
                <p className="text-white/40 text-sm mb-6 leading-relaxed">
                  Your organization has been created. Start by adding your first event and uploading your sponsorship deck.
                </p>
                <div className="glass-light rounded-xl p-4 border border-white/[0.06] text-left mb-6">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/40">Organization</span>
                      <span className="text-white font-medium">{form.tenantName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Slug</span>
                      <code className="text-indigo-300">/{result.tenantSlug}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Currency</span>
                      <span className="text-white">{form.currency}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(result.adminUrl)}
                  className="w-full btn-primary py-3 text-sm font-semibold"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                >
                  Go to Admin Console
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
