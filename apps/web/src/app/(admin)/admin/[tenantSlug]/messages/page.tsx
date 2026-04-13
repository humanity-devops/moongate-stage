'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const ALL_TYPES = ['', 'bid_accepted', 'bid_countered', 'bid_rejected', 'bid_message'];

const TYPE_BADGE: Record<string, string> = {
  bid_accepted: 'text-green-300 bg-green-500/10 border-green-500/30',
  bid_countered: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  bid_rejected: 'text-red-300 bg-red-500/10 border-red-500/30',
  bid_message: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
};

function typeBadgeClass(type: string) {
  return TYPE_BADGE[type] ?? 'text-white/40 bg-white/[0.04] border-white/[0.06]';
}

export default function MerchantMessagesPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function getHeaders(): Record<string, string> {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenantSlug,
    };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (filterUnread) params.set('unreadOnly', 'true');

      const [notiRes, countRes] = await Promise.all([
        fetch(`${API_URL}/api/organizer/notifications?${params}`, { headers: getHeaders() }),
        fetch(`${API_URL}/api/organizer/notifications/unread-count`, { headers: getHeaders() }),
      ]);

      if (notiRes.status === 401 || notiRes.status === 403) {
        router.push('/auth/login');
        return;
      }
      if (!notiRes.ok) throw new Error('Failed to load notifications');

      const notiJson = await notiRes.json();
      const countJson = countRes.ok ? await countRes.json() : { count: 0 };

      setNotifications(notiJson.data ?? []);
      setTotal(notiJson.total ?? 0);
      setUnreadCount(countJson.count ?? 0);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUnread, tenantSlug]);

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    load();
  }, [load, router]);

  function markRead(id: string) {
    fetch(`${API_URL}/api/organizer/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    }).catch(() => {});
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
    );
    setUnreadCount(c => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch(`${API_URL}/api/organizer/notifications/read-all`, {
      method: 'PATCH',
      headers: getHeaders(),
    }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  function handleRowClick(n: Notification) {
    setExpandedId(prev => (prev === n.id ? null : n.id));
    if (!n.readAt) markRead(n.id);
  }

  const displayed = filterType
    ? notifications.filter(n => n.type === filterType)
    : notifications;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-indigo-500 text-[11px] text-white font-bold">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{total} total</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/[0.06]"
          >
            Mark all read
          </button>
        )}
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          <button
            onClick={() => { setFilterUnread(false); }}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              !filterUnread
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                : 'text-white/40 hover:text-white/60 border border-white/[0.06]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setFilterUnread(true); }}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              filterUnread
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                : 'text-white/40 hover:text-white/60 border border-white/[0.06]'
            }`}
          >
            Unread
          </button>
        </div>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1 text-xs text-white/70 focus:outline-none focus:border-indigo-500/40"
        >
          <option value="">All types</option>
          {ALL_TYPES.slice(1).map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-white/[0.03] animate-pulse rounded-xl" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div
          className="rounded-xl border border-white/[0.06] p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <p className="text-white/40 text-sm">
            {filterUnread ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-xs text-white/20 mt-1">
            {filterUnread
              ? 'You are all caught up'
              : 'Notifications appear when bid activity occurs'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayed.map(n => {
            const unread = !n.readAt;
            const expanded = expandedId === n.id;
            return (
              <div
                key={n.id}
                className={`rounded-xl border transition-colors cursor-pointer select-none ${
                  unread
                    ? 'border-indigo-500/20 hover:bg-indigo-500/[0.04]'
                    : 'border-white/[0.04] hover:bg-white/[0.03]'
                }`}
                style={{ background: 'rgba(255,255,255,0.02)' }}
                onClick={() => handleRowClick(n)}
              >
                <div className="px-5 py-3.5 flex items-start gap-3">
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      unread ? 'bg-indigo-400' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border capitalize shrink-0 ${typeBadgeClass(n.type)}`}
                      >
                        {n.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-white/25">{relativeTime(n.createdAt)}</span>
                    </div>
                    <p className={`text-sm leading-snug ${unread ? 'text-white font-medium' : 'text-white/70'}`}>
                      {n.title}
                    </p>
                    {expanded && n.body && (
                      <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{n.body}</p>
                    )}
                  </div>
                  <span className="text-white/20 text-xs shrink-0 mt-0.5">{expanded ? '▲' : '▼'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
