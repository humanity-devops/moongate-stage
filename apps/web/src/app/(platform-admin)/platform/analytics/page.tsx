'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Overview {
  grossVolume: number;
  platformFees: number;
  platformFeesDefault: number;
  paidOrderCount: number;
  totalOrderCount: number;
  totalBidCount: number;
  acceptedBidCount: number;
  conversionRate: number;
  paymentConversionRate: number;
}

interface PeriodRow {
  period: string;
  grossVolume: number;
  platformFees: number;
  merchantNet: number;
  count: number;
}

interface TopMerchant {
  tenantId: string;
  name: string;
  slug: string;
  grossVolume: number;
  platformFees: number;
  orderCount: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function PlatformAnalyticsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [merchants, setMerchants] = useState<TopMerchant[]>([]);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const authHeader = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
    if (!token) { router.push('/platform/login'); return null; }
    return { Authorization: `Bearer ${token}` };
  }, [router]);

  const fetchAll = useCallback(async () => {
    const headers = authHeader();
    if (!headers) return;
    setLoading(true);

    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
      const [ovRes, periodRes, merchantRes] = await Promise.all([
        fetch(`${API_URL}/api/platform/analytics/overview?${params}`, { headers }),
        fetch(`${API_URL}/api/platform/analytics/income-by-period?${params}&granularity=${granularity}`, { headers }),
        fetch(`${API_URL}/api/platform/analytics/top-merchants?${params}&limit=10`, { headers }),
      ]);

      if (ovRes.status === 401 || ovRes.status === 403) { router.push('/platform/login'); return; }

      const [ov, pd, mer] = await Promise.all([ovRes.json(), periodRes.json(), merchantRes.json()]);
      setOverview(ov.data);
      setPeriods(pd.data ?? []);
      setMerchants(mer.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authHeader, from, to, granularity, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="min-h-screen" style={{ background: '#06060a' }}>
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-1">Platform Admin</div>
          <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/platform/commissions" className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
            Commission Rates
          </Link>
          <Link href="/platform/early-access" className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
            Early Access
          </Link>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40">From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40">To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  granularity === g
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAll}
            className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
          >
            Apply
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Gross Volume', value: fmt(overview?.grossVolume ?? 0) },
                { label: 'Platform Fees', value: fmt(overview?.platformFees ?? 0), sub: `Default rate: ${pct(overview?.platformFeesDefault ?? 0.1)}` },
                { label: 'Paid Orders', value: String(overview?.paidOrderCount ?? 0), sub: `of ${overview?.totalOrderCount ?? 0} total` },
                { label: 'Bid → Payment', value: pct(overview?.paymentConversionRate ?? 0), sub: `Bid acceptance: ${pct(overview?.conversionRate ?? 0)}` },
              ].map(kpi => (
                <div key={kpi.label} className="glass rounded-xl px-5 py-4">
                  <p className="text-xs text-white/40 mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white font-display">{kpi.value}</p>
                  {kpi.sub && <p className="text-xs text-white/30 mt-1">{kpi.sub}</p>}
                </div>
              ))}
            </div>

            {/* Income by period table */}
            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Revenue by {granularity}</h2>
              {periods.length === 0 ? (
                <p className="text-sm text-white/30 py-6 text-center">No paid orders in this range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/30 border-b border-white/[0.06]">
                        <th className="text-left pb-2 font-medium">Period</th>
                        <th className="text-right pb-2 font-medium">Gross Volume</th>
                        <th className="text-right pb-2 font-medium">Platform Fees</th>
                        <th className="text-right pb-2 font-medium">Merchant Net</th>
                        <th className="text-right pb-2 font-medium">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map(row => (
                        <tr key={row.period} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="py-2 text-white/70">{row.period}</td>
                          <td className="py-2 text-right text-white">{fmt(row.grossVolume)}</td>
                          <td className="py-2 text-right text-indigo-300">{fmt(row.platformFees)}</td>
                          <td className="py-2 text-right text-white/60">{fmt(row.merchantNet)}</td>
                          <td className="py-2 text-right text-white/50">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/[0.08]">
                        <td className="py-2 text-white/40 font-semibold">Total</td>
                        <td className="py-2 text-right text-white font-semibold">{fmt(periods.reduce((s, r) => s + r.grossVolume, 0))}</td>
                        <td className="py-2 text-right text-indigo-300 font-semibold">{fmt(periods.reduce((s, r) => s + r.platformFees, 0))}</td>
                        <td className="py-2 text-right text-white/60 font-semibold">{fmt(periods.reduce((s, r) => s + r.merchantNet, 0))}</td>
                        <td className="py-2 text-right text-white/50 font-semibold">{periods.reduce((s, r) => s + r.count, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Top merchants */}
            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Top Merchants by Volume</h2>
              {merchants.length === 0 ? (
                <p className="text-sm text-white/30 py-6 text-center">No data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/30 border-b border-white/[0.06]">
                        <th className="text-left pb-2 font-medium">Merchant</th>
                        <th className="text-right pb-2 font-medium">Gross Volume</th>
                        <th className="text-right pb-2 font-medium">Platform Fees</th>
                        <th className="text-right pb-2 font-medium">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {merchants.map(m => (
                        <tr key={m.tenantId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="py-2">
                            <p className="text-white">{m.name}</p>
                            <p className="text-white/30">{m.slug}</p>
                          </td>
                          <td className="py-2 text-right text-white">{fmt(m.grossVolume)}</td>
                          <td className="py-2 text-right text-indigo-300">{fmt(m.platformFees)}</td>
                          <td className="py-2 text-right text-white/50">{m.orderCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
