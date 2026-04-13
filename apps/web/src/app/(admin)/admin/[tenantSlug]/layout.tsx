'use client';
import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const NAV = [
  { label: 'Dashboard', href: '', icon: '▣' },
  { section: 'MARKETPLACE' },
  { label: 'Events', href: '/events', icon: '📅' },
  { label: 'Proposals', href: '/proposals', icon: '📋' },
  { label: 'Package Templates', href: '/package-templates', icon: '📦' },
  { section: 'APPROVALS' },
  { label: 'Community Funding', href: '/approvals', icon: '🗳' },
  { section: 'ACCESS & PRIVACY' },
  { label: 'Access Control', href: '/access', icon: '🔑' },
  { section: 'COMPLIANCE' },
  { label: 'KYC & Onboarding', href: '/kyc', icon: '🛂' },
  { section: 'INBOX' },
  { label: 'Messages', href: '/messages', icon: '✉' },
  { section: 'CONTACTS' },
  { label: 'Outreach', href: '/outreach', icon: '📬' },
  { section: 'MEMBERSHIP', staffOnly: true },
  { label: 'Early Access', href: '/membership', icon: '⭐', staffOnly: true },
  { section: 'USERS' },
  { label: 'Directory', href: '/users', icon: '👥' },
  { section: 'FINANCE' },
  { label: 'Finance', href: '/finance', icon: '💳' },
  { section: 'ANALYTICS' },
  { label: 'Overview', href: '/analytics', icon: '📊' },
  { section: 'SETTINGS' },
  { label: 'General', href: '/settings', icon: '⚙️' },
  { label: 'Roles & Perms', href: '/settings/roles', icon: '🛡' },
  { label: 'Audit Logs', href: '/settings/audit-logs', icon: '📜' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const params = useParams() as { tenantSlug: string };
  const tenantSlug = params.tenantSlug;
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    setIsStaff(!!localStorage.getItem('platform_token'));

    // Fetch tenant settings to get logoUrl
    fetch(`${API_URL}/api/organizer/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
      },
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data?.tenant?.logoUrl) setTenantLogoUrl(json.data.tenant.logoUrl);
      })
      .catch(() => {});
  }, [router, tenantSlug]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#06060a' }}>
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const base = `/admin/${tenantSlug}`;

  return (
    <div className="flex min-h-screen" style={{ background: '#06060a' }}>
      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-full w-[220px] flex flex-col border-r border-white/[0.06] z-40 overflow-y-auto"
        style={{ background: '#0d0d14' }}
      >
        {/* Logo / Tenant header */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/[0.06]">
          {tenantLogoUrl ? (
            <div className="w-7 h-7 rounded-md overflow-hidden border border-white/[0.08] shrink-0 flex items-center justify-center bg-white/[0.04]">
              <Image src={tenantLogoUrl} alt="Logo" width={28} height={28} className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L11 3.5V8.5L6 11L1 8.5V3.5L6 1Z" stroke="#4361ee" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
          )}
          <div>
            <div className="text-xs font-bold text-white leading-none">{tenantSlug}</div>
            <div className="text-[9px] text-white/30 mt-0.5">Admin Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.filter(item => !item.staffOnly || isStaff).map((item, i) => {
            if ('section' in item) {
              return (
                <div key={i} className={`flex items-center gap-1.5 px-2 pt-4 pb-1 ${i === 0 ? 'pt-1' : ''}`}>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-white/20">{item.label}</span>
                  {item.staffOnly && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">Staff</span>
                  )}
                </div>
              );
            }
            const href = base + item.href;
            const isActive = item.href === ''
              ? pathname === base || pathname === base + '/'
              : pathname.startsWith(href);
            return (
              <Link
                key={i}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                  isActive
                    ? 'bg-indigo-500/10 text-white border-l-2 border-indigo-500 pl-[10px]'
                    : 'text-white/40 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
                {item.staffOnly && (
                  <span className="ml-auto text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400/70">Staff</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mode switcher + sign out */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          {/* Account mode toggle — organiser admin context */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5" role="group" aria-label="Account mode">
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all text-white/40 hover:text-white/70"
            >
              Buyer
            </button>
            <button
              className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              aria-pressed={true}
            >
              Organiser
            </button>
          </div>
          <button
            onClick={() => { localStorage.removeItem('moongate_token'); router.push('/auth/login'); }}
            className="w-full text-xs text-white/30 hover:text-white py-2 px-3 rounded-lg hover:bg-white/[0.04] text-left transition-colors"
          >
            Sign out
          </button>

          {/* Moongate branding */}
          <div className="flex items-center gap-1.5 px-1 pt-1">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-20">
              <path d="M6 1L11 3.5V8.5L6 11L1 8.5V3.5L6 1Z" stroke="white" strokeWidth="1.2" fill="none" />
            </svg>
            <span className="text-xs text-white/20">Stage by Moongate</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-[220px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
