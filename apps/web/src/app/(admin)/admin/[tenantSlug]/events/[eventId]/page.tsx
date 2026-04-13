'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { organizerApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Dashboard {
  totalItems: number;
  publishedItems: number;
  soldOutItems: number;
  totalBids: number;
  pendingBids: number;
  totalOrders: number;
  paidOrders: number;
  revenue: number;
  pipelineValue: number;
  recentActivity: Array<{ id: string; type: string; title: string; body?: string; createdAt: string }>;
}

export default function EventDashboardPage() {
  const { tenantSlug, eventId } = useParams() as { tenantSlug: string; eventId: string };
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  async function togglePublish() {
    const token = localStorage.getItem('moongate_token');
    if (!token || !event) return;
    setPublishing(true);
    const newStatus = event.status === 'published' ? 'draft' : 'published';
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setEvent(e => e ? { ...e, status: newStatus } : e);
    } finally {
      setPublishing(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }

    Promise.all([
      organizerApi.getEvent(eventId, token, tenantSlug),
      organizerApi.getEventDashboard(eventId, token, tenantSlug),
    ])
      .then(([eventRes, dashRes]) => {
        setEvent(eventRes.data);
        setDashboard(dashRes.data as unknown as Dashboard);
      })
      .catch(() => router.push('/auth/login'))
      .finally(() => setLoading(false));
  }, [eventId, tenantSlug, router]);

  if (loading || !dashboard || !event) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(dashboard.revenue), sub: `${dashboard.paidOrders} paid orders`, color: 'text-green-400' },
    { label: 'Pipeline Value', value: formatCurrency(dashboard.pipelineValue), sub: `${dashboard.pendingBids} pending bids`, color: 'text-brand-400' },
    { label: 'Items Published', value: `${dashboard.publishedItems}`, sub: `${dashboard.soldOutItems} sold out`, color: 'text-white' },
    { label: 'Total Bids', value: `${dashboard.totalBids}`, sub: `${dashboard.pendingBids} need review`, color: 'text-accent-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <nav className="text-sm text-gray-500 mb-2">
              <Link href={`/admin/${tenantSlug}/events`} className="hover:text-white">Events</Link>
              <span className="mx-2">›</span>
              <span className="text-white">{event.name as string}</span>
            </nav>
            <h1 className="text-3xl font-bold text-white">{event.name as string}</h1>
            <p className="text-gray-400 mt-1">
              {event.city as string}{event.country ? `, ${event.country}` : ''}
              {event.startDate ? ` · ${new Date(event.startDate as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              event.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {event.status as string}
            </span>
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                event.status === 'published'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {publishing ? '...' : event.status === 'published' ? 'Unpublish' : 'Publish Event'}
            </button>
            <Link
              href={`/${tenantSlug}/${event.slug}/sponsor`}
              target="_blank"
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-gray-700"
            >
              View Public Page ↗
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(stat => (
            <div key={stat.label} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="text-sm text-gray-400 mb-1">{stat.label}</div>
              <div className={`text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Manage Items', href: 'items', icon: '📦' },
            { label: 'View Bids', href: 'bids', icon: '💼' },
            { label: 'Campaigns', href: 'campaigns', icon: '🤝' },
            { label: 'Upload Deck', href: 'decks', icon: '📄' },
          ].map(action => (
            <Link
              key={action.label}
              href={`/admin/${tenantSlug}/events/${eventId}/${action.href}`}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex items-center gap-3 transition-all"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-white font-medium text-sm">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Recent activity */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
          {dashboard.recentActivity.length === 0 ? (
            <p className="text-gray-400 text-sm">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {dashboard.recentActivity.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-white font-medium">{entry.title}</span>
                    {entry.body && <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{entry.body}</p>}
                    <p className="text-gray-600 text-xs mt-0.5">
                      {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
