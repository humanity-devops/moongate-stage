'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SponsorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Failed to send sign-in link');
        return;
      }
      setSent(true);
      if (data.data?._devToken) setDevToken(data.data._devToken);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center mb-10">
          <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#4361ee" strokeWidth="1.5" fill="none" />
              <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="#4361ee" opacity="0.6" />
            </svg>
          </div>
          <span className="font-bold text-white tracking-tight">
            Stage <span className="text-white/40 font-normal text-xs ml-0.5">by Moongate</span>
          </span>
        </Link>

        <div className="glass rounded-2xl border border-white/[0.08] p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-white font-semibold mb-1">Check your email</h2>
              <p className="text-white/40 text-sm">We sent a sign-in link to <span className="text-white/60">{email}</span></p>
              {devToken && (
                <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-left">
                  <p className="text-indigo-300 text-xs font-mono break-all">DEV: {devToken}</p>
                  <button
                    onClick={() => router.push(`/auth/verify?token=${devToken}`)}
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Click to verify now
                  </button>
                </div>
              )}
              <button
                onClick={() => { setSent(false); setDevToken(null); }}
                className="mt-6 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-white mb-1">Sponsor sign in</h1>
                <p className="text-white/40 text-sm">Enter your email to receive a sign-in link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-white/[0.04] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  {loading ? 'Sending...' : 'Send sign-in link'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/[0.06] text-center space-y-2">
                <p className="text-white/30 text-xs">
                  Don&apos;t have an account?{' '}
                  <Link href="/join" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                    Apply to join
                  </Link>
                </p>
                <p className="text-white/20 text-xs">
                  Organizer?{' '}
                  <Link href="/auth/login" className="text-white/40 hover:text-white/60 transition-colors">
                    Merchant login
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
