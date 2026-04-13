'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { track } from '@/lib/track';

interface SiteHeaderProps {
  variant?: 'default' | 'transparent';
}

const NAV_LINKS = [
  { href: '/browse', label: 'Browse Events' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/about', label: 'About Stage' },
];

export function SiteHeader({ variant = 'default' }: SiteHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const loginMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    setIsLoggedIn(!!token);
    // Try to get tenant slug from token payload (base64 decode middle segment)
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenantSlug) setTenantSlug(payload.tenantSlug);
      } catch {
        // not a JWT — session token, no embedded payload
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (loginMenuRef.current && !loginMenuRef.current.contains(e.target as Node)) {
        setLoginMenuOpen(false);
      }
    }
    if (loginMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [loginMenuOpen]);

  const isTransparent = variant === 'transparent' && !scrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isTransparent
          ? 'bg-transparent border-transparent'
          : 'bg-void/90 backdrop-blur-xl border-b border-white/[0.06]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#4361ee" strokeWidth="1.5" fill="none" />
              <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="#4361ee" opacity="0.6" />
            </svg>
          </div>
          <span className="font-display font-bold text-white tracking-tight">
            Stage <span className="text-white/40 font-normal text-xs ml-0.5">by Moongate</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                pathname === href || pathname.startsWith(href + '/')
                  ? 'text-white bg-white/8'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-2">
          {isLoggedIn ? (
            <Link
              href={tenantSlug ? `/admin/${tenantSlug}/events` : '/portal'}
              className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5"
            >
              Dashboard
            </Link>
          ) : (
            <>
              {/* Sign in dropdown */}
              <div className="relative" ref={loginMenuRef}>
                <button
                  onClick={() => setLoginMenuOpen(o => !o)}
                  className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5 flex items-center gap-1"
                >
                  Sign in
                  <svg className={`w-3 h-3 transition-transform ${loginMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {loginMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 glass rounded-xl border border-white/[0.08] py-1 shadow-xl z-50">
                    <Link
                      href="/login"
                      onClick={() => setLoginMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      Sponsor login
                    </Link>
                    <Link
                      href="/auth/login"
                      onClick={() => setLoginMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      Merchant login
                    </Link>
                  </div>
                )}
              </div>
              <Link
                href="/get-started"
                onClick={() => track({ eventType: 'cta_click', metadata: { action: 'get_started_nav' } })}
                className="btn-primary text-sm px-4 py-2"
                style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-white/60 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {mobileOpen ? (
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-void/95 backdrop-blur-xl border-t border-white/[0.06] px-6 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2.5 text-sm rounded-md transition-colors ${
                pathname === href ? 'text-white bg-white/[0.08]' : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/[0.06] space-y-1">
            {isLoggedIn ? (
              <Link
                href={tenantSlug ? `/admin/${tenantSlug}/events` : '/portal'}
                className="block px-3 py-2.5 text-sm text-white/70 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="block px-3 py-2.5 text-sm text-white/70 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors" onClick={() => setMobileOpen(false)}>
                  Sponsor sign in
                </Link>
                <Link href="/auth/login" className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors" onClick={() => setMobileOpen(false)}>
                  Merchant login
                </Link>
                <Link
                  href="/get-started"
                  className="block btn-primary text-sm px-4 py-2.5 text-center mt-2"
                  onClick={() => { setMobileOpen(false); track({ eventType: 'cta_click', metadata: { action: 'get_started_nav_mobile' } }); }}
                >
                  Get Started
                </Link>
                <Link
                  href="/join"
                  className="block text-sm text-white/50 hover:text-white text-center py-2 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Apply as Sponsor
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
