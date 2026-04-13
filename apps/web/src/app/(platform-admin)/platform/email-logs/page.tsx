'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type EmailLog = {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: string;
  provider: string | null;
  providerId: string | null;
  error: string | null;
  retryCount: number;
  sentAt: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  sent: 'text-green-300 bg-green-500/10 border-green-500/20',
  failed: 'text-red-300 bg-red-500/10 border-red-500/20',
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
  return { Authorization: `Bearer ${token}` };
}

export default function PlatformEmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [template, setTemplate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (status) params.set('status', status);
      if (template) params.set('template', template);
      const res = await fetch(`${API_URL}/api/platform/email-logs?${params}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, template, page]);

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Email Delivery Log</h1>
          <p className="text-white/40 text-sm">{total} total emails tracked</p>
        </div>
        <button
          onClick={load}
          className="text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex gap-2">
          {['', 'pending', 'sent', 'failed'].map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                status === s
                  ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                  : 'border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
            >
              {s === '' ? 'All statuses' : s}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Filter by template..."
          className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors"
          value={template}
          onChange={e => { setTemplate(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass rounded-xl border border-white/[0.06] h-14 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="glass rounded-xl border border-white/[0.06] p-12 text-center">
          <p className="text-white/30 text-sm">No email logs found</p>
        </div>
      ) : (
        <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['To', 'Template', 'Subject', 'Status', 'Retries', 'Sent At', 'Created'].map(h => (
                  <th key={h} className="text-left text-xs text-white/30 uppercase tracking-wide px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {logs.map(log => (
                <>
                  <tr
                    key={log.id}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-white/80 font-mono text-xs">{log.to}</td>
                    <td className="px-4 py-3">
                      <code className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">
                        {log.template}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs max-w-xs truncate">{log.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_STYLES[log.status] ?? 'text-white/40 border-white/10'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs text-center">
                      {log.retryCount > 0 ? (
                        <span className="text-yellow-400">{log.retryCount}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {log.sentAt ? new Date(log.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="bg-white/[0.01]">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-2 text-xs">
                          {log.providerId && (
                            <div className="flex gap-2">
                              <span className="text-white/30">Provider ID:</span>
                              <code className="text-white/60">{log.providerId}</code>
                            </div>
                          )}
                          {log.error && (
                            <div className="flex gap-2">
                              <span className="text-white/30">Error:</span>
                              <code className="text-red-300 bg-red-500/10 px-2 py-0.5 rounded">{log.error}</code>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-white/30 text-sm">Page {page}</span>
          <button
            disabled={page * 50 >= total}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
