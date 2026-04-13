'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Member = { id: string; email: string; name?: string; company?: string; role?: string; status: string; internalStatus: string; adminNotes?: string; createdAt: string };

const STATUS_STYLES: Record<string, string> = {
  new: 'text-white/40 bg-white/[0.04] border-white/[0.08]',
  reviewed: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  contacted: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  archived: 'text-white/20 bg-white/[0.03] border-white/[0.06]',
  waitlisted: 'text-white/40 bg-white/[0.04] border-white/[0.08]',
  invited: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  onboarded: 'text-green-300 bg-green-500/10 border-green-500/20',
};

export default function MembershipPage() {
  const router = useRouter();
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Member | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [platformToken, setPlatformToken] = useState<string | null>(null);

  useEffect(() => {
    const pt = localStorage.getItem('platform_token');
    setPlatformToken(pt);
    if (!pt) setAccessDenied(true);
  }, []);

  const load = useCallback(async () => {
    if (!platformToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('internalStatus', statusFilter);
      const res = await fetch(`${API_URL}/api/organizer/membership/early-access?${params}`, {
        headers: { Authorization: `Bearer ${platformToken}` },
      });
      if (res.status === 401 || res.status === 403) { setAccessDenied(true); return; }
      const json = await res.json();
      setMembers(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [platformToken, search, statusFilter]);

  useEffect(() => { if (platformToken) load(); }, [load, platformToken]);

  async function patchMember(id: string, data: Record<string, unknown>) {
    if (!platformToken) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/membership/early-access/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${platformToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      setSelected(json.data);
      setMembers(prev => prev.map(m => m.id === id ? json.data : m));
    } finally { setSaving(false); }
  }

  if (accessDenied) {
    return (
      <div className="p-8">
        <div className="max-w-lg">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="text-amber-400 text-xl mt-0.5">⚠</span>
              <div>
                <h2 className="font-semibold text-amber-300 mb-1">Staff Access Required</h2>
                <p className="text-sm text-amber-300/70 mb-4">
                  Membership management requires Moongate Super Admin (platform_superadmin) credentials.
                  You must be logged in to the Platform Admin to access this section.
                </p>
                <a href="/platform/login" className="text-xs text-amber-400 hover:text-amber-300 underline">
                  Go to Platform Admin Login →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]" style={{ background: '#0a0a12' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">Early Access Membership</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">Staff Only</span>
              </div>
              <p className="text-xs text-white/30 mt-0.5">{total} members</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/[0.05] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none w-48"
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
              <option value="">All status</option>
              {['new','reviewed','contacted','archived'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="space-y-px">{[...Array(6)].map((_, i) => <div key={i} className="h-11 animate-pulse bg-white/[0.02]" />)}</div>
          ) : members.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-white/30">No members found</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: '#0d0d14' }}>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-white/30 px-4 py-2.5">Contact</th>
                  <th className="text-left text-white/30 px-3 py-2.5">Company</th>
                  <th className="text-left text-white/30 px-3 py-2.5">Public Status</th>
                  <th className="text-left text-white/30 px-3 py-2.5">Admin Status</th>
                  <th className="text-left text-white/30 px-3 py-2.5">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} onClick={() => { setSelected(m); setNotesInput(m.adminNotes ?? ''); }}
                    className={`border-b border-white/[0.04] cursor-pointer transition-colors ${selected?.id === m.id ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'}`}>
                    <td className="px-4 py-2.5">
                      <div className="text-white font-medium truncate max-w-[160px]">{m.name ?? '—'}</div>
                      <div className="text-white/40 truncate max-w-[160px]">{m.email}</div>
                    </td>
                    <td className="px-3 py-2.5 text-white/50 truncate max-w-[100px]">{m.company ?? '—'}</td>
                    <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded border text-[10px] capitalize ${STATUS_STYLES[m.status] ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}>{m.status}</span></td>
                    <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded border text-[10px] capitalize ${STATUS_STYLES[m.internalStatus] ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}>{m.internalStatus}</span></td>
                    <td className="px-3 py-2.5 text-white/30">{new Date(m.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* Detail panel */}
      {selected ? (
        <div className="w-72 border-l border-white/[0.06] flex flex-col overflow-hidden" style={{ background: '#0d0d14' }}>
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-start justify-between">
            <div>
              <div className="font-semibold text-sm text-white">{selected.name ?? '(no name)'}</div>
              <div className="text-xs text-white/40 break-all">{selected.email}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white text-lg">×</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {[{ label: 'Company', value: selected.company }, { label: 'Role', value: selected.role }].filter(r => r.value).map(r => (
              <div key={r.label} className="flex justify-between text-xs">
                <span className="text-white/30">{r.label}</span>
                <span className="text-white/70">{r.value}</span>
              </div>
            ))}
            <div>
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Public Status</label>
              <div className="flex gap-1">
                {['waitlisted','invited','onboarded'].map(s => (
                  <button key={s} onClick={() => patchMember(selected.id, { status: s })} disabled={saving || selected.status === s}
                    className={`px-2 py-1 rounded text-[10px] border capitalize transition-all disabled:cursor-not-allowed ${selected.status === s ? (STATUS_STYLES[s] ?? 'text-gray-400 bg-gray-800 border-gray-700') : 'border-white/10 text-white/30 hover:text-white/60'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Admin Status</label>
              <div className="flex flex-wrap gap-1">
                {['new','reviewed','contacted','archived'].map(s => (
                  <button key={s} onClick={() => patchMember(selected.id, { internalStatus: s })} disabled={saving || selected.internalStatus === s}
                    className={`px-2 py-1 rounded text-[10px] border capitalize transition-all disabled:cursor-not-allowed ${selected.internalStatus === s ? (STATUS_STYLES[s] ?? 'text-gray-400 bg-gray-800 border-gray-700') : 'border-white/10 text-white/30 hover:text-white/60'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Notes</label>
              <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} rows={3}
                className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-xs text-white resize-none focus:outline-none" />
              <button onClick={() => patchMember(selected.id, { adminNotes: notesInput })}
                disabled={saving || notesInput === (selected.adminNotes ?? '')}
                className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-30">
                {saving ? 'Saving...' : 'Save notes'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-72 border-l border-white/[0.06] flex items-center justify-center" style={{ background: '#0d0d14' }}>
          <p className="text-xs text-white/20">Select a row</p>
        </div>
      )}
    </div>
  );
}
