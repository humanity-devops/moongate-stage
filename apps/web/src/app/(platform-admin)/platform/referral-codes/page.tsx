'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ReferralCode = {
  id: string;
  code: string;
  status: 'generated' | 'sent' | 'used' | 'expired';
  label: string | null;
  assignedTo: string | null;
  usedBy: string | null;
  source: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type Meta = { total: number; page: number; pageSize: number };

const STATUS_TABS = ['all', 'generated', 'sent', 'used', 'expired'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_STYLE: Record<string, string> = {
  generated: 'text-white/50 bg-white/[0.05] border-white/[0.10]',
  sent:       'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  used:       'text-green-300 bg-green-500/10 border-green-500/20',
  expired:    'text-red-300/70 bg-red-500/[0.07] border-red-500/15',
};

export default function ReferralCodesPage() {
  const router = useRouter();

  // List state
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, pageSize: 50 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Generate form
  const [genCount, setGenCount] = useState(1);
  const [genLabel, setGenLabel] = useState('');
  const [genSource, setGenSource] = useState('platform-admin');
  const [genExpiresAt, setGenExpiresAt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string[] | null>(null);
  const [genError, setGenError] = useState('');

  // Per-row action state
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const loadCodes = useCallback(async (page = 1) => {
    if (!token) { router.push('/platform/login'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (activeTab !== 'all') params.set('status', activeTab);
      if (sourceFilter) params.set('source', sourceFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`${API_URL}/api/platform/referrals/codes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) { router.push('/platform/login'); return; }
      const json = await res.json();
      setCodes(json.data ?? []);
      if (json.meta) setMeta(json.meta);
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, [token, router, activeTab, sourceFilter, dateFrom, dateTo]);

  useEffect(() => { loadCodes(1); }, [loadCodes]);

  // Generate
  async function handleGenerate() {
    if (!token) return;
    setGenerating(true);
    setGenResult(null);
    setGenError('');
    try {
      const res = await fetch(`${API_URL}/api/platform/referrals/codes/generate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          count: genCount,
          label: genLabel || undefined,
          source: genSource || 'platform-admin',
          expiresAt: genExpiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGenResult(data.data.codes);
        loadCodes(1);
      } else {
        setGenError(data.error ?? 'Generation failed');
      }
    } catch {
      setGenError('Network error');
    } finally {
      setGenerating(false);
    }
  }

  // Revoke
  async function handleRevoke(code: string) {
    if (!token || !confirm(`Revoke code ${code}? This cannot be undone.`)) return;
    setActionLoading(code);
    try {
      await fetch(`${API_URL}/api/platform/referrals/codes/${code}/revoke`, {
        method: 'POST',
        headers: authHeaders,
      });
      loadCodes(meta.page);
    } finally {
      setActionLoading(null);
    }
  }

  // Regenerate
  async function handleRegenerate(code: string) {
    if (!token || !confirm(`Regenerate code ${code}? Old code will be revoked and a new one created.`)) return;
    setActionLoading(code);
    try {
      await fetch(`${API_URL}/api/platform/referrals/codes/${code}/regenerate`, {
        method: 'POST',
        headers: authHeaders,
      });
      loadCodes(meta.page);
    } finally {
      setActionLoading(null);
    }
  }

  // Assign
  async function handleAssign(code: string) {
    if (!token || !assignEmail.trim()) return;
    setActionLoading(code);
    try {
      const res = await fetch(`${API_URL}/api/platform/referrals/codes/${code}/assign`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ email: assignEmail.trim() }),
      });
      if (res.ok) {
        setAssignTarget(null);
        setAssignEmail('');
        loadCodes(meta.page);
      }
    } finally {
      setActionLoading(null);
    }
  }

  // Delete
  async function handleDelete(code: string) {
    if (!token || !confirm(`Permanently delete code ${code}?`)) return;
    setActionLoading(code);
    try {
      await fetch(`${API_URL}/api/platform/referrals/codes/${code}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadCodes(meta.page);
    } finally {
      setActionLoading(null);
    }
  }

  // Export
  async function handleExport() {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/platform/referrals/codes/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'referral-codes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusCounts = {
    all: meta.total,
    generated: codes.filter(c => c.status === 'generated').length,
    sent: codes.filter(c => c.status === 'sent').length,
    used: codes.filter(c => c.status === 'used').length,
    expired: codes.filter(c => c.status === 'expired').length,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Referral Codes</h1>
          <p className="text-sm text-white/40 mt-1">Generate and manage platform referral codes</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Generate panel */}
      <div className="rounded-xl border border-white/[0.08] p-5 mb-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Generate New Codes</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-white/40 mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={500}
              value={genCount}
              onChange={e => setGenCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-24 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-white/40 mb-1">Label (optional)</label>
            <input
              type="text"
              value={genLabel}
              onChange={e => setGenLabel(e.target.value)}
              placeholder="e.g. ETHDenver 2026"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-white/40 mb-1">Source</label>
            <input
              type="text"
              value={genSource}
              onChange={e => setGenSource(e.target.value)}
              placeholder="platform-admin"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Expires at (optional)</label>
            <input
              type="date"
              value={genExpiresAt}
              onChange={e => setGenExpiresAt(e.target.value)}
              className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {genError && (
          <div className="mt-3 text-xs text-red-400">{genError}</div>
        )}

        {genResult && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-xs text-green-300 mb-2">Generated {genResult.length} code{genResult.length !== 1 ? 's' : ''}:</p>
            <div className="flex flex-wrap gap-2">
              {genResult.map(code => (
                <code key={code} className="text-xs font-mono bg-white/[0.06] border border-white/10 px-2 py-1 rounded text-white/70">
                  {code}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end mb-5">
        {/* Status tabs */}
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-white/30 mb-1">Source filter</label>
          <input
            type="text"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            placeholder="Any source"
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <div>
          <label className="block text-xs text-white/30 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <div>
          <label className="block text-xs text-white/30 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {(sourceFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setSourceFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors self-end py-1.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              activeTab === tab
                ? 'border-indigo-500/40 bg-indigo-500/10'
                : 'border-white/[0.08] hover:border-white/[0.14]'
            }`}
            style={activeTab !== tab ? { background: 'rgba(255,255,255,0.02)' } : undefined}
          >
            <div className="text-xl font-bold text-white">{statusCounts[tab]}</div>
            <div className="text-xs text-white/40 mt-0.5 capitalize">{tab}</div>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          No referral codes found. Generate some above.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="px-4 py-3 text-left text-xs text-white/40 font-medium uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs text-white/40 font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-white/40 font-medium uppercase tracking-wider">Label</th>
                  <th className="px-4 py-3 text-left text-xs text-white/40 font-medium uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs text-white/40 font-medium uppercase tracking-wider">Used By</th>
                  <th className="px-4 py-3 text-left text-xs text-white/40 font-medium uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-right text-xs text-white/40 font-medium uppercase tracking-wider">Expires</th>
                  <th className="px-4 py-3 text-right text-xs text-white/40 font-medium uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-right text-xs text-white/40 font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((row, i) => {
                  const isActing = actionLoading === row.code;
                  const isAssigning = assignTarget === row.code;
                  return (
                    <>
                      <tr
                        key={row.id}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        style={i % 2 === 0 ? { background: 'transparent' } : { background: 'rgba(255,255,255,0.01)' }}
                      >
                        <td className="px-4 py-3">
                          <code className="text-indigo-300 font-mono text-sm">{row.code}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_STYLE[row.status] ?? STATUS_STYLE.generated}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-xs max-w-[160px] truncate">{row.label ?? '—'}</td>
                        <td className="px-4 py-3 text-white/60 text-xs max-w-[180px] truncate">{row.assignedTo ?? '—'}</td>
                        <td className="px-4 py-3 text-white/60 text-xs max-w-[180px] truncate">{row.usedBy ?? '—'}</td>
                        <td className="px-4 py-3 text-white/40 text-xs">{row.source ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-white/40 text-xs">
                          {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-white/40 text-xs">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Assign — only for generated codes */}
                            {row.status === 'generated' && (
                              <button
                                disabled={isActing}
                                onClick={() => { setAssignTarget(isAssigning ? null : row.code); setAssignEmail(''); }}
                                className="text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors disabled:opacity-40"
                              >
                                Assign
                              </button>
                            )}
                            {/* Revoke — any non-used, non-expired */}
                            {(row.status === 'generated' || row.status === 'sent') && (
                              <button
                                disabled={isActing}
                                onClick={() => handleRevoke(row.code)}
                                className="text-xs text-amber-400/60 hover:text-amber-300 transition-colors disabled:opacity-40"
                              >
                                {isActing ? '...' : 'Revoke'}
                              </button>
                            )}
                            {/* Regenerate — for sent/expired */}
                            {(row.status === 'sent' || row.status === 'expired') && (
                              <button
                                disabled={isActing}
                                onClick={() => handleRegenerate(row.code)}
                                className="text-xs text-sky-400/60 hover:text-sky-300 transition-colors disabled:opacity-40"
                              >
                                {isActing ? '...' : 'Regen'}
                              </button>
                            )}
                            {/* Delete — generated or expired only */}
                            {(row.status === 'generated' || row.status === 'expired') && (
                              <button
                                disabled={isActing}
                                onClick={() => handleDelete(row.code)}
                                className="text-xs text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-40"
                              >
                                {isActing ? '...' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Inline assign form */}
                      {isAssigning && (
                        <tr key={`${row.id}-assign`} className="border-b border-indigo-500/20">
                          <td colSpan={9} className="px-4 py-3 bg-indigo-500/[0.06]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/50 shrink-0">Assign {row.code} to:</span>
                              <input
                                type="email"
                                autoFocus
                                value={assignEmail}
                                onChange={e => setAssignEmail(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAssign(row.code); if (e.key === 'Escape') setAssignTarget(null); }}
                                placeholder="user@example.com"
                                className="flex-1 max-w-xs bg-white/[0.06] border border-indigo-500/30 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/60"
                              />
                              <button
                                onClick={() => handleAssign(row.code)}
                                disabled={!assignEmail.trim() || actionLoading === row.code}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => { setAssignTarget(null); setAssignEmail(''); }}
                                className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.total > meta.pageSize && (
            <div className="flex items-center justify-between mt-4 text-xs text-white/40">
              <span>Showing {((meta.page - 1) * meta.pageSize) + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}</span>
              <div className="flex gap-2">
                <button
                  disabled={meta.page <= 1}
                  onClick={() => loadCodes(meta.page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={meta.page * meta.pageSize >= meta.total}
                  onClick={() => loadCodes(meta.page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
