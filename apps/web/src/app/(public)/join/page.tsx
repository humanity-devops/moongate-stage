'use client';

import type { Metadata } from 'next';
import Link from 'next/link';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function JoinPage() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    websiteUrl: '',
    role: 'sponsor' as 'sponsor' | 'both',
    termsAccepted: false,
  });

  function set(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.termsAccepted) {
      setErrorMsg('You must accept the terms to continue.');
      return;
    }
    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/api/public/sponsor/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company || undefined,
          websiteUrl: form.websiteUrl || undefined,
          role: form.role,
          termsAccepted: form.termsAccepted,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? 'Something went wrong. Please try again.');
      }
      setState('success');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center px-6">
        <div className="glass rounded-2xl border border-white/[0.08] p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-2">Check your inbox</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            We sent a verification link to <strong className="text-white">{form.email}</strong>. Click the link to confirm your email and complete your application.
          </p>
          <p className="text-white/30 text-xs">
            Did not receive it? Check your spam folder or{' '}
            <button
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              onClick={() => setState('idle')}
            >
              try again
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg">
      {/* Header */}
      <header className="py-6 px-6 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#4361ee" strokeWidth="1.5" fill="none" />
                <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="#4361ee" opacity="0.6" />
              </svg>
            </div>
            <span className="font-display font-bold text-white tracking-tight">Stage</span>
          </Link>
          <Link href="/auth/login" className="text-sm text-white/50 hover:text-white transition-colors">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-16 items-start">
        {/* Left: pitch */}
        <div>
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-4">Sponsor portal</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight text-white mb-5">
            Discover and back<br />
            <span className="text-gradient">live event sponsorships.</span>
          </h1>
          <p className="text-white/50 text-base leading-relaxed mb-8">
            Moongate connects sponsors with event organizers at scale. Browse crowdfunded campaigns, make direct bids, and manage all your sponsorship relationships in one place.
          </p>
          <div className="space-y-4">
            {[
              { title: 'Curated opportunities', desc: 'Access pre-vetted events across tech, sports, culture, and more.' },
              { title: 'Transparent pricing', desc: 'See list prices, bid history, and campaign progress before you commit.' },
              { title: 'Streamlined onboarding', desc: 'Your account is reviewed and approved — no unsolicited cold calls.' },
            ].map(b => (
              <div key={b.title} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{b.title}</p>
                  <p className="text-white/40 text-sm">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form */}
        <div className="glass rounded-2xl border border-white/[0.08] p-8">
          <h2 className="font-display text-xl font-bold text-white mb-1">Create your sponsor account</h2>
          <p className="text-white/40 text-sm mb-6">Free to apply. We review all accounts within 24 hours.</p>

          {state === 'error' && (
            <div className="mb-5 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5" htmlFor="name">
                Full name <span className="text-indigo-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
                placeholder="Jane Smith"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5" htmlFor="email">
                Work email <span className="text-indigo-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
                placeholder="jane@company.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5" htmlFor="company">
                Company
              </label>
              <input
                id="company"
                type="text"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
                placeholder="Acme Corp"
                value={form.company}
                onChange={e => set('company', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5" htmlFor="website">
                Website
              </label>
              <input
                id="website"
                type="url"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
                placeholder="https://company.com"
                value={form.websiteUrl}
                onChange={e => set('websiteUrl', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">
                I want to
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'sponsor', label: 'Sponsor events' },
                  { value: 'both', label: 'Sponsor + Organize' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('role', opt.value)}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors text-left ${
                      form.role === opt.value
                        ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                        : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-white/20 bg-white/[0.04] text-indigo-500 focus:ring-indigo-500/50"
                checked={form.termsAccepted}
                onChange={e => set('termsAccepted', e.target.checked)}
              />
              <span className="text-white/50 text-xs leading-relaxed">
                I agree to the{' '}
                <Link href="/legal/terms" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={state === 'submitting'}
              className="w-full btn-primary py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
            >
              {state === 'submitting' ? 'Submitting...' : 'Apply for access'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
