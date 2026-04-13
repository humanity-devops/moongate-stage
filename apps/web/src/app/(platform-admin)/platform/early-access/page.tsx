'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Member = {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  status: string;
  internalStatus: string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  invitedAt?: string;
  onboardedAt?: string;
  createdAt: string;
};

const INTERNAL_STATUS_STYLES: Record<string, string> = {
  new: 'text-white/50 bg-white/[0.06] border-white/10',
  reviewed: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  contacted: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  archived: 'text-white/20 bg-white/[0.03] border-white/[0.06]',
};

const PUBLIC_STATUS_STYLES: Record<string, string> = {
  waitlisted: 'text-white/40 bg-white/[0.04] border-white/[0.08]',
  invited: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  onboarded: 'text-green-300 bg-green-500/10 border-green-500/20',
};

const INTERNAL_STATUSES = ['new', 'reviewed', 'contacted', 'archived'];
const PUBLIC_STATUSES = ['waitlisted', 'invited', 'onboarded'];
const SORT_FIELDS = [
  { value: 'createdAt', label: 'Date joined' },
  { value: 'email', label: 'Email' },
  { value: 'name', label: 'Name' },
  { value: 'internalStatus', label: 'Admin status' },
];

function EarlyAccessPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Member | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [internalFilter, setInternalFilter] = useState(searchParams.get('internalStatus') ?? '');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'createdAt');
  const [order, setOrder] = useState(searchParams.get('order') ?? 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') ?? '1'));

  // Read token client-side only to avoid hydration mismatch
  useEffect(() => {
    setToken(localStorage.getItem('platform_token'));
    setTokenReady(true);
  }, []);

  function authHeaders() {
    return { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' };
  }

  const load = useCallback(async () => {
    if (!tokenReady) return;
    if (!token) { router.push('/platform/login'); return; }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (internalFilter) params.set('internalStatus', internalFilter);
      params.set('sort', sort);
      params.set('order', order);
      params.set('page', String(page));
      params.set('pageSize', '50');

      const res = await fetch(`${API_URL}/api/platform/early-access?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) { router.push('/platform/login'); return; }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setMembers(json.data ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [token, tokenReady, search, statusFilter, internalFilter, sort, order, page, router]);

  useEffect(() => {
    if (!tokenReady) return;
    if (!token) { router.push('/platform/login'); return; }
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, token, tokenReady, router, search]);

  // Open detail
  function openDetail(m: Member) {
    setSelected(m);
    setNotesInput(m.adminNotes ?? '');
  }

  // Update single member status or notes
  async function patchMember(id: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/platform/early-access/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Update failed');
      const json = await res.json();
      setSelected(json.data);
      setMembers(prev => prev.map(m => m.id === id ? json.data : m));
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!selected) return;
    await patchMember(selected.id, { adminNotes: notesInput });
  }

  async function updateStatus(field: 'internalStatus' | 'status', value: string) {
    if (!selected) return;
    await patchMember(selected.id, { [field]: value });
  }

  // Bulk actions
  async function executeBulk() {
    if (!bulkAction || selectedIds.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/platform/early-access/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ids: Array.from(selectedIds), action: bulkAction }),
      });
      if (!res.ok) throw new Error('Bulk action failed');
      setBulkConfirm(false);
      setBulkAction('');
      setSelectedIds(new Set());
      load();
    } finally {
      setSaving(false);
    }
  }

  // CSV export
  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (internalFilter) params.set('internalStatus', internalFilter);

      const res = await fetch(`${API_URL}/api/platform/early-access/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `early-access-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map(m => m.id)));
    }
  }

  function fmtDate(s?: string) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="min-h-screen" style={{ background: '#06060a' }}>
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0d0d14] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L11 3.5V8.5L6 11L1 8.5V3.5L6 1Z" stroke="#4361ee" strokeWidth="1.2" fill="none" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Platform Admin</span>
          <span className="text-white/20">›</span>
          <span className="text-sm text-white/60">Early Access</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white px-3 py-1.5 border border-white/10 rounded-lg transition-colors disabled:opacity-40"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M6 1V8M3 6L6 9L9 6M2 11H10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={() => { localStorage.removeItem('platform_token'); router.push('/platform/login'); }}
            className="text-xs text-white/30 hover:text-white px-3 py-1.5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-49px)]">
        {/* List panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters bar */}
          <div className="border-b border-white/[0.06] bg-[#0a0a12] px-5 py-3 flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search name, email, company..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="bg-white/[0.05] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/40 w-56 transition-all"
              />
            </div>

            {/* Internal status filter */}
            <select
              value={internalFilter}
              onChange={e => { setInternalFilter(e.target.value); setPage(1); }}
              className="bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none capitalize"
            >
              <option value="" className="bg-[#0d0d14]">All admin status</option>
              {INTERNAL_STATUSES.map(s => (
                <option key={s} value={s} className="bg-[#0d0d14] capitalize">{s}</option>
              ))}
            </select>

            {/* Public status filter */}
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none capitalize"
            >
              <option value="" className="bg-[#0d0d14]">All public status</option>
              {PUBLIC_STATUSES.map(s => (
                <option key={s} value={s} className="bg-[#0d0d14] capitalize">{s}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={`${sort}:${order}`}
              onChange={e => {
                const [s, o] = e.target.value.split(':');
                setSort(s);
                setOrder(o);
                setPage(1);
              }}
              className="bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none ml-auto"
            >
              {SORT_FIELDS.map(f => [
                <option key={`${f.value}:desc`} value={`${f.value}:desc`} className="bg-[#0d0d14]">{f.label} ↓</option>,
                <option key={`${f.value}:asc`} value={`${f.value}:asc`} className="bg-[#0d0d14]">{f.label} ↑</option>,
              ])}
            </select>

            <span className="text-xs text-white/25 font-mono">{total} total</span>
          </div>

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="border-b border-amber-500/20 bg-amber-500/5 px-5 py-2 flex items-center gap-3">
              <span className="text-xs text-amber-300 font-medium">{selectedIds.size} selected</span>
              <select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value)}
                className="bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="">Choose action...</option>
                <option value="mark_reviewed">Mark reviewed</option>
                <option value="mark_contacted">Mark contacted</option>
                <option value="archive">Archive</option>
              </select>
              {bulkAction && (
                <button
                  onClick={() => setBulkConfirm(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-all"
                >
                  Apply
                </button>
              )}
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-white/30 hover:text-white ml-auto">
                Clear
              </button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="space-y-px pt-px">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse bg-white/[0.02] border-b border-white/[0.04]" />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-40 text-sm text-red-400">{error}</div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40">
                <p className="text-sm text-white/30">No submissions found</p>
                {(search || statusFilter || internalFilter) && (
                  <button onClick={() => { setSearch(''); setStatusFilter(''); setInternalFilter(''); }} className="text-xs text-indigo-400 mt-2 hover:text-indigo-300">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0d0d14] border-b border-white/[0.06]">
                  <tr>
                    <th className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === members.length && members.length > 0}
                        onChange={toggleAll}
                        className="accent-indigo-500"
                      />
                    </th>
                    <th className="text-left text-white/30 uppercase tracking-wider font-medium px-3 py-2.5">Contact</th>
                    <th className="text-left text-white/30 uppercase tracking-wider font-medium px-3 py-2.5">Company / Role</th>
                    <th className="text-left text-white/30 uppercase tracking-wider font-medium px-3 py-2.5">Source</th>
                    <th className="text-left text-white/30 uppercase tracking-wider font-medium px-3 py-2.5">Status</th>
                    <th className="text-left text-white/30 uppercase tracking-wider font-medium px-3 py-2.5">Admin</th>
                    <th className="text-left text-white/30 uppercase tracking-wider font-medium px-3 py-2.5">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr
                      key={m.id}
                      onClick={() => openDetail(m)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        selected?.id === m.id ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'
                      } ${idx === members.length - 1 ? 'border-0' : ''}`}
                    >
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          className="accent-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-white truncate max-w-[160px]">{m.name ?? '—'}</div>
                        <div className="text-white/40 truncate max-w-[160px]">{m.email}</div>
                      </td>
                      <td className="px-3 py-2.5 text-white/50 truncate max-w-[120px]">
                        {m.company ? <span className="text-white/60">{m.company}</span> : null}
                        {m.role && <span className="text-white/30 ml-1 capitalize">· {m.role}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-white/35">{m.utmSource ?? m.referrer ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded-md border capitalize text-[10px] ${PUBLIC_STATUS_STYLES[m.status] ?? ''}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded-md border capitalize text-[10px] ${INTERNAL_STATUS_STYLES[m.internalStatus] ?? ''}`}>
                          {m.internalStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white/30 whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-white/[0.06] px-5 py-2.5 flex items-center justify-between bg-[#0a0a12]">
              <span className="text-xs text-white/30">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-3 py-1.5 border border-white/10 rounded-lg text-white/50 hover:text-white disabled:opacity-30 transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-xs px-3 py-1.5 border border-white/10 rounded-lg text-white/50 hover:text-white disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="w-80 border-l border-white/[0.06] bg-[#0d0d14] flex flex-col overflow-hidden">
            {/* Detail header */}
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between">
              <div>
                <div className="font-semibold text-white text-sm">{selected.name ?? '(no name)'}</div>
                <div className="text-xs text-white/40 mt-0.5 break-all">{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white transition-colors text-lg leading-none ml-2">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Metadata */}
              <div className="space-y-2">
                {[
                  { label: 'Company', value: selected.company },
                  { label: 'Role', value: selected.role },
                  { label: 'UTM Source', value: selected.utmSource },
                  { label: 'UTM Medium', value: selected.utmMedium },
                  { label: 'UTM Campaign', value: selected.utmCampaign },
                  { label: 'Referrer', value: selected.referrer },
                  { label: 'Joined', value: fmtDate(selected.createdAt) },
                  { label: 'Invited', value: fmtDate(selected.invitedAt) },
                  { label: 'Onboarded', value: fmtDate(selected.onboardedAt) },
                  { label: 'Reviewed', value: fmtDate(selected.reviewedAt) },
                ].filter(r => r.value).map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-start gap-2">
                    <span className="text-xs text-white/30 shrink-0">{label}</span>
                    <span className="text-xs text-white/70 text-right break-words">{value}</span>
                  </div>
                ))}
              </div>

              {/* Public status */}
              <div>
                <label className="block text-xs text-white/30 uppercase tracking-widest mb-2">Public status</label>
                <div className="flex flex-wrap gap-1.5">
                  {PUBLIC_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus('status', s)}
                      disabled={saving || selected.status === s}
                      className={`px-2.5 py-1 rounded-lg text-xs border capitalize transition-all disabled:cursor-not-allowed ${
                        selected.status === s
                          ? (PUBLIC_STATUS_STYLES[s] ?? 'text-white border-white/20')
                          : 'border-white/10 text-white/30 hover:text-white/70'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin status */}
              <div>
                <label className="block text-xs text-white/30 uppercase tracking-widest mb-2">Admin status</label>
                <div className="flex flex-wrap gap-1.5">
                  {INTERNAL_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus('internalStatus', s)}
                      disabled={saving || selected.internalStatus === s}
                      className={`px-2.5 py-1 rounded-lg text-xs border capitalize transition-all disabled:cursor-not-allowed ${
                        selected.internalStatus === s
                          ? (INTERNAL_STATUS_STYLES[s] ?? 'text-white border-white/20')
                          : 'border-white/10 text-white/30 hover:text-white/70'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <label className="block text-xs text-white/30 uppercase tracking-widest mb-2">Internal notes</label>
                <textarea
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  placeholder="Add private notes about this applicant..."
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/40 resize-none transition-all"
                />
                <button
                  onClick={saveNotes}
                  disabled={saving || notesInput === (selected.adminNotes ?? '')}
                  className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save notes'}
                </button>
              </div>

              {/* Submission ID */}
              <div>
                <label className="block text-xs text-white/20 uppercase tracking-widest mb-1">Submission ID</label>
                <code className="text-[10px] text-white/25 break-all font-mono">{selected.id}</code>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-80 border-l border-white/[0.06] bg-[#0d0d14] flex items-center justify-center">
            <p className="text-xs text-white/20">Select a row to view details</p>
          </div>
        )}
      </div>

      {/* Bulk confirm modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glass rounded-2xl p-7 w-full max-w-sm text-center space-y-4">
            <div className="text-3xl">⚡</div>
            <h2 className="font-semibold text-white">
              {bulkAction.replace(/_/g, ' ')} {selectedIds.size} submission{selectedIds.size !== 1 ? 's' : ''}?
            </h2>
            <p className="text-sm text-white/40">This will update the admin status for all selected entries.</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkConfirm(false)} className="flex-1 py-2 rounded-lg text-sm border border-white/10 text-white/50 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={executeBulk}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm btn-primary disabled:opacity-40"
              >
                {saving ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EarlyAccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#06060a' }} />}>
      <EarlyAccessPageInner />
    </Suspense>
  );
}
