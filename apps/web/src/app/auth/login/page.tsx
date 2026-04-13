'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { organizerApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic'>('magic');
  const [showPw, setShowPw] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tenantSlug: tenantSlug || undefined }),
      });
      const data = await res.json();
      setMagicLinkSent(true);
      // In dev, show the token directly
      if (data.data?._devToken) {
        setError(`DEV MODE: Token = ${data.data._devToken}`);
      }
    } catch {
      setError('Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await organizerApi.login({ email, password, tenantSlug: tenantSlug || undefined });
      if (res.data.token) {
        localStorage.setItem('moongate_token', res.data.token as string);
        const slug = ((res.data as Record<string, unknown>).tenantSlug as string) || tenantSlug;
        if (slug) {
          router.push(`/admin/${slug}/events`);
        } else {
          router.push('/portal');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center mb-4">
            <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#4361ee" strokeWidth="1.5" fill="none" />
                <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="#4361ee" opacity="0.6" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight">Stage <span className="text-white/40 font-normal text-xs ml-0.5">by Moongate</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-1">Merchant login</h1>
          <p className="text-gray-400 text-sm">Sign in to your organizer console</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <div className="flex gap-1 mb-6 bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => setMode('magic')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'magic' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Magic Link
            </button>
            <button
              onClick={() => setMode('password')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'password' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Password
            </button>
          </div>

          {magicLinkSent && mode === 'magic' ? (
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-white font-semibold mb-2">Check your email</h3>
              <p className="text-gray-400 text-sm">We sent a magic link to {email}</p>
            </div>
          ) : (
            <form onSubmit={mode === 'magic' ? handleMagicLink : handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
                  placeholder="you@company.com"
                />
              </div>

              {mode === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type={showPw ? 'text' : 'password'}
                      required
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Organization <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  value={tenantSlug}
                  onChange={e => setTenantSlug(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
                  placeholder="ethglobal"
                />
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {loading ? 'Loading...' : mode === 'magic' ? 'Send Magic Link' : 'Sign In'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-gray-600 text-sm mt-4">
          Sponsor?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Sponsor sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
