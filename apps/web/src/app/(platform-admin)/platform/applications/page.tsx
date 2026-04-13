'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Application = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  websiteUrl: string | null;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  adminNotes: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  submitted: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  email_verified: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  approved: 'text-green-300 bg-green-500/10 border-green-500/20',
  rejected: 'text-red-300 bg-red-500/10 border-red-500/20',
  active: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function PlatformApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState<{
    open: boolean;
    app: Application | null;
    action: 'approve' | 'reject' | null;
    notes: string;
    rejectionReason: string;
    submitting: boolean;
  }>({ open: false, app: null, action: null, notes: '', rejectionReason: '', submitting: false });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (status) params.set('status', status);
      const res = await fetch(`${API_URL}/api/platform/applications?${params}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, page]);

  async function handleAction() {
    if (!modal.app || !modal.action) return;
    setModal(m => ({ ...m, submitting: true }));
    try {
      const res = await fetch(`${API_URL}/api/platform/applications/${modal.app.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          action: modal.action,
          adminNotes: modal.notes || undefined,
          rejectionReason: modal.rejectionReason || undefined,
        }),
      });
      if (res.ok) {
        setModal({ open: false, app: null, action: null, notes: '', rejectionReason: '', submitting: false });
        load();
      }
    } finally {
      setModal(m => ({ ...m, submitting: false }));
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Sponsor Applications</h1>
          <p className="text-white/40 text-sm">{total} total applications</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['', 'submitted', 'email_verified', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              status === s
                ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                : 'border-white/10 text-white/50 hover:text-white hover:border-white/20'
            }`}
          >
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-xl border border-white/[0.06] h-20 animate-pulse" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="glass rounded-xl border border-white/[0.06] p-12 text-center">
          <p className="text-white/30 text-sm">No applications found</p>
        </div>
      ) : (
        <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Name', 'Email', 'Company', 'Role', 'Status', 'Verified', 'Applied', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-white/30 uppercase tracking-wide px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {applications.map(app => (
                <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-white text-sm font-medium">{app.name}</td>
                  <td className="px-4 py-3 text-white/60 text-sm">{app.email}</td>
                  <td className="px-4 py-3 text-white/60 text-sm">{app.company ?? '—'}</td>
                  <td className="px-4 py-3 text-white/60 text-sm">{app.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_STYLES[app.status] ?? 'text-white/40 border-white/10'}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {app.emailVerifiedAt ? new Date(app.emailVerifiedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {['submitted', 'email_verified'].includes(app.status) && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModal({ open: true, app, action: 'approve', notes: '', rejectionReason: '', submitting: false })}
                          className="text-xs px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-300 hover:bg-green-500/20 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setModal({ open: true, app, action: 'reject', notes: '', rejectionReason: '', submitting: false })}
                          className="text-xs px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal.open && modal.app && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass rounded-2xl border border-white/[0.08] p-6 max-w-md w-full">
            <h3 className="font-display text-lg font-bold text-white mb-1">
              {modal.action === 'approve' ? 'Approve application' : 'Reject application'}
            </h3>
            <p className="text-white/40 text-sm mb-5">
              {modal.app.name} — {modal.app.email}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wide mb-1.5">
                  Admin notes (optional)
                </label>
                <textarea
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 resize-none"
                  rows={3}
                  placeholder="Internal notes..."
                  value={modal.notes}
                  onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                />
              </div>
              {modal.action === 'reject' && (
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-1.5">
                    Rejection reason (sent to applicant)
                  </label>
                  <textarea
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 resize-none"
                    rows={3}
                    placeholder="We regret to inform you..."
                    value={modal.rejectionReason}
                    onChange={e => setModal(m => ({ ...m, rejectionReason: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal({ open: false, app: null, action: null, notes: '', rejectionReason: '', submitting: false })}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm hover:text-white hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={modal.submitting}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  modal.action === 'approve'
                    ? 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
                    : 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30'
                }`}
              >
                {modal.submitting ? 'Processing...' : modal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
