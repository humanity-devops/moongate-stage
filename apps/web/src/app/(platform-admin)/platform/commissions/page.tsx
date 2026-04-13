'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Merchant {
  id: string;
  name: string;
  slug: string;
  commissionRate: number | null;
  effectiveRate: number;
}

interface EventOverride {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
  commissionRate: number | null;
  tenant: { name: string };
}

function pctDisplay(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function RateEditor({
  initial,
  onSave,
  onClear,
  saving,
}: {
  initial: number | null;
  onSave: (rate: number) => Promise<void>;
  onClear: () => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial !== null ? String((initial * 100).toFixed(1)) : '');

  async function handleSave() {
    const num = parseFloat(value) / 100;
    if (isNaN(num) || num < 0 || num > 1) return;
    await onSave(num);
    setEditing(false);
  }

  async function handleClear() {
    await onClear();
    setValue('');
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-white">{initial !== null ? pctDisplay(initial) : <span className="text-white/30">—</span>}</span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-16 bg-white/[0.06] border border-indigo-500/40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
          autoFocus
        />
        <span className="text-xs text-white/40 ml-1">%</span>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={handleClear}
        disabled={saving}
        className="text-xs text-red-400/70 hover:text-red-400 disabled:opacity-50"
      >
        Clear
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-white/30 hover:text-white/60">
        Cancel
      </button>
    </div>
  );
}

export default function CommissionsPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [events, setEvents] = useState<EventOverride[]>([]);
  const [defaultRate, setDefaultRate] = useState(0.1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const headers = useCallback((): HeadersInit | null => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
    if (!token) { router.push('/platform/login'); return null; }
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [router]);

  const fetchAll = useCallback(async () => {
    const h = headers();
    if (!h) return;
    setLoading(true);
    try {
      const [defRes, merRes, evtRes] = await Promise.all([
        fetch(`${API_URL}/api/platform/commissions/default`, { headers: h }),
        fetch(`${API_URL}/api/platform/commissions/merchants`, { headers: h }),
        fetch(`${API_URL}/api/platform/commissions/events`, { headers: h }),
      ]);
      if (defRes.status === 401) { router.push('/platform/login'); return; }
      const [def, mer, evt] = await Promise.all([defRes.json(), merRes.json(), evtRes.json()]);
      setDefaultRate(def.data?.commissionRate ?? 0.1);
      setMerchants(mer.data ?? []);
      setEvents(evt.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [headers, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function saveMerchantRate(tenantId: string, rate: number | null) {
    const h = headers();
    if (!h) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/platform/commissions/merchants/${tenantId}`, {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ commissionRate: rate }),
      });
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function saveEventRate(eventId: string, rate: number | null) {
    const h = headers();
    if (!h) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/platform/commissions/events/${eventId}`, {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ commissionRate: rate }),
      });
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#06060a' }}>
      <div className="border-b border-white/[0.06] px-8 py-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-1">Platform Admin</div>
          <h1 className="text-xl font-bold text-white">Commission Rates</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/platform/analytics" className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
            Analytics
          </Link>
          <Link href="/platform/early-access" className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
            Early Access
          </Link>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Default rate banner */}
        <div className="glass rounded-xl px-5 py-4 flex items-center gap-4">
          <div>
            <p className="text-xs text-white/40">Platform default commission rate</p>
            <p className="text-2xl font-bold text-white font-display">{pctDisplay(defaultRate)}</p>
            <p className="text-xs text-white/30 mt-1">Applied when no merchant or event override is set. Non-retroactive — existing paid orders are unaffected.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Merchant overrides */}
            <div className="glass rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-white">Merchant-level Overrides</h2>
                <p className="text-xs text-white/30 mt-1">Set a custom commission for a merchant. Applies to all their events unless an event-level override exists. Clear to fall back to platform default.</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/[0.06]">
                    <th className="text-left pb-2 font-medium">Merchant</th>
                    <th className="text-left pb-2 font-medium">Override Rate</th>
                    <th className="text-left pb-2 font-medium">Effective Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map(m => (
                    <tr key={m.id} className="border-b border-white/[0.04]">
                      <td className="py-3">
                        <p className="text-white">{m.name}</p>
                        <p className="text-white/30">{m.slug}</p>
                      </td>
                      <td className="py-3">
                        <RateEditor
                          initial={m.commissionRate}
                          onSave={rate => saveMerchantRate(m.id, rate)}
                          onClear={() => saveMerchantRate(m.id, null)}
                          saving={saving}
                        />
                      </td>
                      <td className="py-3">
                        <span className={`text-sm font-semibold ${m.commissionRate !== null ? 'text-indigo-300' : 'text-white/40'}`}>
                          {pctDisplay(m.effectiveRate)}
                        </span>
                        {m.commissionRate === null && <span className="text-xs text-white/20 ml-1">(default)</span>}
                      </td>
                    </tr>
                  ))}
                  {merchants.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-white/30">No merchants yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Event overrides */}
            <div className="glass rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-white">Event-level Overrides</h2>
                <p className="text-xs text-white/30 mt-1">Event-level rates take the highest precedence, overriding both merchant and platform defaults.</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/[0.06]">
                    <th className="text-left pb-2 font-medium">Event</th>
                    <th className="text-left pb-2 font-medium">Merchant</th>
                    <th className="text-left pb-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="border-b border-white/[0.04]">
                      <td className="py-3">
                        <p className="text-white">{e.name}</p>
                        <p className="text-white/30">{e.slug}</p>
                      </td>
                      <td className="py-3 text-white/50">{e.tenant.name}</td>
                      <td className="py-3">
                        <RateEditor
                          initial={e.commissionRate}
                          onSave={rate => saveEventRate(e.id, rate)}
                          onClear={() => saveEventRate(e.id, null)}
                          saving={saving}
                        />
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-white/30">No event-level overrides set.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
