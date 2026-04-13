'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type AuditLog = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  ip?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export default function AuditLogsPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  // Filters
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
    };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (action.trim()) params.set('action', action.trim());
      if (resource.trim()) params.set('resource', resource.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`${API_URL}/api/organizer/audit-logs?${params}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setLogs(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, resource, dateFrom, dateTo, page, tenantSlug]);

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    load();
  }, [load, router]);

  function handleSearch() {
    setPage(1);
    load();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Audit Logs</h1>
        <p className="text-xs text-gray-400 mt-0.5">{total.toLocaleString()} total entries</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Action</label>
          <input
            value={action}
            onChange={e => setAction(e.target.value)}
            placeholder="e.g. event.created"
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none w-44"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Resource</label>
          <input
            value={resource}
            onChange={e => setResource(e.target.value)}
            placeholder="e.g. event"
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none w-36"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
        >
          Filter
        </button>
        <button
          onClick={() => { setAction(''); setResource(''); setDateFrom(''); setDateTo(''); setPage(1); }}
          className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white text-xs rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] animate-pulse rounded-xl" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <div className="text-4xl mb-3">📜</div>
          <div className="text-sm">No audit logs found</div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-3 py-3">Resource</th>
                <th className="text-left px-3 py-3">Resource ID</th>
                <th className="text-left px-3 py-3">User ID</th>
                <th className="text-left px-3 py-3">IP</th>
                <th className="text-left px-3 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-indigo-300">{log.action}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{log.resource}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-500">
                    {log.resourceId ? log.resourceId.slice(0, 10) + (log.resourceId.length > 10 ? '...' : '') : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-gray-500">
                    {log.userId ? log.userId.slice(0, 10) + (log.userId.length > 10 ? '...' : '') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 font-mono">{log.ip ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 justify-end">
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-700 text-xs text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-gray-700 text-xs text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
