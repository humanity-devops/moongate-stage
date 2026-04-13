'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type VerifyState = 'verifying' | 'success' | 'error' | 'no_token';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'no_token');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    fetch(`${API_URL}/api/public/sponsor/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          setState('error');
          setMessage(data.message ?? 'Verification failed. The link may have expired.');
        } else {
          setState('success');
          setMessage(data.data?.message ?? 'Email verified successfully.');
        }
      })
      .catch(() => {
        setState('error');
        setMessage('Could not connect to the server. Please try again.');
      });
  }, [token]);

  if (state === 'no_token') {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Invalid link</h2>
        <p className="text-white/50 text-sm mb-6">This verification link is missing or malformed.</p>
        <Link href="/join" className="text-indigo-400 hover:text-indigo-300 text-sm">
          Back to application
        </Link>
      </div>
    );
  }

  if (state === 'verifying') {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-5 animate-pulse">
          <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Verifying your email...</h2>
        <p className="text-white/40 text-sm">This will just take a moment.</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Verification failed</h2>
        <p className="text-white/50 text-sm mb-6">{message}</p>
        <Link href="/join" className="text-indigo-400 hover:text-indigo-300 text-sm">
          Apply again
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="font-display text-2xl font-bold text-white mb-2">Email verified</h2>
      <p className="text-white/50 text-sm leading-relaxed mb-6">
        {message}
      </p>
      <div className="text-white/30 text-xs">
        You will receive an email once your account is approved.
      </div>
    </div>
  );
}

export default function VerifyApplicationPage() {
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-6">
      <div className="glass rounded-2xl border border-white/[0.08] p-10 max-w-md w-full">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#4361ee" strokeWidth="1.5" fill="none" />
                <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="#4361ee" opacity="0.6" />
              </svg>
            </div>
          </Link>
        </div>
        <Suspense fallback={<div className="text-center text-white/40 text-sm">Loading...</div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
