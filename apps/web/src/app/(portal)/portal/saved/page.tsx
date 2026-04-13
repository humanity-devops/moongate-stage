'use client';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type SavedItem = {
  id: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function PortalSavedPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  function loadSaved() {
    fetch(`${API_URL}/api/sponsor/saved`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setItems(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSaved(); }, []);

  async function unsave(id: string) {
    await fetch(`${API_URL}/api/sponsor/saved/${id}`, { method: 'DELETE', headers: getHeaders() });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Saved</h1>
      <p className="text-white/40 text-sm mb-8">Events and packages you've bookmarked</p>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 glass rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center border border-white/[0.06]">
          <p className="text-white/40 text-sm">Nothing saved yet</p>
          <a href="/portal/discover" className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block">Browse events →</a>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="glass rounded-xl px-5 py-4 flex items-center justify-between border border-white/[0.04]">
              <div>
                <div className="text-xs text-white/30 uppercase tracking-widest font-mono mb-0.5">{item.entityType}</div>
                <div className="text-sm text-white font-mono">{item.entityId.slice(0, 8)}…</div>
              </div>
              <button
                onClick={() => unsave(item.id)}
                className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
