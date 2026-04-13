import Link from 'next/link';

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-void mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group w-fit">
              <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#4361ee" strokeWidth="1.5" fill="none" />
                  <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="#4361ee" opacity="0.6" />
                </svg>
              </div>
              <span className="font-display font-bold text-white tracking-tight">
                Stage <span className="text-white/40 font-normal text-xs">by Moongate</span>
              </span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed max-w-[200px]">
              The sponsorship marketplace for live events.
            </p>
          </div>

          {/* About Stage */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">About Stage</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/about', label: 'About Stage' },
                { href: '/how-it-works', label: 'How It Works' },
                { href: '/get-started', label: 'Get Started' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/50 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Sponsors */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Sponsors</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/browse', label: 'Browse Events' },
                { href: '/join', label: 'Early Access' },
                { href: '/login', label: 'Manage' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/50 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Organizers */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Organizers</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/auth/login', label: 'Dashboard Login' },
                { href: '/docs', label: 'Documentation' },
                { href: '/#early-access', label: 'Apply as Organizer' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/50 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/faq', label: 'FAQ' },
                { href: 'mailto:contact@moongate.id', label: 'Contact Us' },
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms of Service' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/50 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30 flex items-center gap-2">
            <span>Moongate by Humanity {currentYear} &copy;</span>
            <span className="text-white/15">·</span>
            <a href="https://humanity.org" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">humanity.org</a>
            <span className="text-white/15">·</span>
            <a href="https://moongate.id" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">moongate.id</a>
          </p>

          {/* Subtle early access CTA */}
          <Link
            href="/join"
            className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
          >
            Apply for early access
          </Link>

          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="text-white/30 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-white/30 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
