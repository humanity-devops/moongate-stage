'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No token provided.');
      return;
    }

    fetch(`${API_URL}/api/auth/magic-link/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.data?.token) {
          localStorage.setItem('moongate_token', data.data.token);
          setStatus('success');
          // Route to organizer portal if tenantSlug is known, otherwise sponsor portal
          const tenantSlug = (data.data as Record<string, unknown>).tenantSlug as string | undefined;
          setTimeout(() => {
            router.push(tenantSlug ? `/admin/${tenantSlug}/events` : '/portal');
          }, 1500);
        } else {
          setStatus('error');
          setMessage(data.message ?? 'Invalid or expired link. Please request a new one.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not connect to server. Make sure the API is running.');
      });
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#06060a' }}>
      <div className="w-full max-w-sm text-center">
        {status === 'verifying' && (
          <>
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm">Verifying your link…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10L8 14L16 6" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-1">Signed in!</p>
            <p className="text-white/50 text-sm">Redirecting to your portal…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M6 6L14 14M14 6L6 14" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-2">Link invalid or expired</p>
            <p className="text-white/50 text-sm mb-6">{message}</p>
            <a href="/auth/login" className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2">
              Back to login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#06060a' }}>
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyInner />
    </Suspense>
  );
}
