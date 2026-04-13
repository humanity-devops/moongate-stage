'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type AnalyticsData = {
  totalEvents: number;
  byType: { eventType: string; count: number }[];
  byDevice: { device: string; count: number }[];
  byCountry: { country: string; count: number }[];
  byUtmSource: { source: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  page_viewed: 'Page Views',
  package_viewed: 'Package Views',
  deck_viewed: 'Deck Views',
  cta_click: 'CTA Clicks',
  auth_redirect: 'Auth Redirects',
  bid_milestone: 'Bid Milestones',
};

export default function AnalyticsPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }

    fetch(`${API_URL}/api/organizer/analytics`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(json => setData(json.data))
      .catch(() => router.push('/auth/login'))
      .finally(() => setLoading(false));
  }, [tenantSlug, router]);

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading analytics...</div>;
  }

  if (!data) return null;

  const maxDaily = Math.max(...data.dailyTrend.map(d => d.count), 1);

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href={`/admin/${tenantSlug}/events`} className="hover:text-white">Events</Link>
            <span className="mx-2">›</span>
            <span className="text-white">Analytics</span>
          </nav>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Engagement overview across all your events</p>
        </div>

        {/* Total events */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="text-sm text-gray-400 mb-1">Total Events (all time)</div>
          <div className="text-4xl font-bold text-white">{data.totalEvents.toLocaleString()}</div>
        </div>

        {/* Top row: by type + by device */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* By event type */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-bold text-white mb-4">By Event Type</h2>
            <div className="space-y-3">
              {data.byType.map(row => {
                const pct = data.totalEvents > 0 ? Math.round((row.count / data.totalEvents) * 100) : 0;
                return (
                  <div key={row.eventType}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{EVENT_TYPE_LABELS[row.eventType] ?? row.eventType}</span>
                      <span className="text-sm font-mono text-gray-400">{row.count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {data.byType.length === 0 && <p className="text-gray-500 text-sm">No data yet.</p>}
            </div>
          </div>

          {/* By device + top countries */}
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Device Breakdown</h2>
              <div className="flex gap-4">
                {data.byDevice.map(row => (
                  <div key={row.device} className="flex-1 text-center p-4 rounded-lg bg-gray-800">
                    <div className="text-2xl mb-1">{row.device === 'mobile' ? '📱' : '💻'}</div>
                    <div className="text-xl font-bold text-white">{row.count.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 capitalize">{row.device}</div>
                  </div>
                ))}
                {data.byDevice.length === 0 && <p className="text-gray-500 text-sm">No data yet.</p>}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Top Traffic Sources</h2>
              <div className="space-y-2">
                {data.byUtmSource.slice(0, 5).map(row => (
                  <div key={row.source} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 truncate">{row.source}</span>
                    <span className="text-sm font-mono text-gray-400 ml-2">{row.count.toLocaleString()}</span>
                  </div>
                ))}
                {data.byUtmSource.length === 0 && <p className="text-gray-500 text-sm">No UTM data yet.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Daily trend + countries */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily trend bar chart */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Daily Activity (Last 30 Days)</h2>
            {data.dailyTrend.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity.</p>
            ) : (
              <div className="flex items-end gap-0.5 h-32">
                {data.dailyTrend.map(day => (
                  <div
                    key={day.date}
                    className="flex-1 bg-brand-600 rounded-sm transition-all hover:bg-brand-500 cursor-default"
                    style={{ height: `${Math.max(4, (day.count / maxDaily) * 100)}%` }}
                    title={`${day.date}: ${day.count}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Top countries */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Top Countries</h2>
            <div className="space-y-2">
              {data.byCountry.slice(0, 8).map(row => (
                <div key={row.country} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{row.country}</span>
                  <span className="text-sm font-mono text-gray-400">{row.count.toLocaleString()}</span>
                </div>
              ))}
              {data.byCountry.length === 0 && (
                <p className="text-gray-500 text-sm">No geo data yet. Set <code className="text-xs">cf-ipcountry</code> header via CDN.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
