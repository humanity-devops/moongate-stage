'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type TemplateItem = { label: string; type: string; price: number };

type Template = {
  id: string;
  name: string;
  description?: string;
  items?: TemplateItem[];
  createdAt: string;
};

const ITEM_TYPES = ['logo', 'booth', 'talk', 'panel', 'workshop', 'digital', 'custom'];

export default function PackageTemplatesPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New template modal
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [modalItems, setModalItems] = useState<TemplateItem[]>([
    { label: '', type: 'logo', price: 0 },
  ]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Archive
  const [archiving, setArchiving] = useState<string | null>(null);

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      'Content-Type': 'application/json',
    };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/package-templates`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setTemplates(json.data ?? []);
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    load();
  }, [load, router]);

  async function archive(id: string) {
    setArchiving(id);
    try {
      const res = await fetch(`${API_URL}/api/organizer/package-templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to archive template');
    } finally {
      setArchiving(null);
    }
  }

  function addItem() {
    setModalItems(prev => [...prev, { label: '', type: 'logo', price: 0 }]);
  }

  function removeItem(i: number) {
    setModalItems(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, updates: Partial<TemplateItem>) {
    setModalItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...updates } : item));
  }

  function resetModal() {
    setModalName('');
    setModalDesc('');
    setModalItems([{ label: '', type: 'logo', price: 0 }]);
    setCreateError('');
  }

  async function createTemplate() {
    if (!modalName.trim()) { setCreateError('Name is required'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/package-templates`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: modalName.trim(),
          description: modalDesc.trim(),
          items: modalItems.filter(i => i.label.trim()),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setShowModal(false);
      resetModal();
      load();
    } catch {
      setCreateError('Failed to create template');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Package Templates</h1>
          <p className="text-xs text-gray-400 mt-0.5">Reusable sponsorship package configurations</p>
        </div>
        <button
          onClick={() => { resetModal(); setShowModal(true); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
        >
          + New Template
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-white/[0.03] animate-pulse rounded-xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <div className="text-4xl mb-3">📦</div>
          <div className="text-sm">No templates yet. Create your first package template.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{t.name}</h3>
                  {t.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
                <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {t.items?.length ?? 0} items
                </span>
              </div>

              {t.items && t.items.length > 0 && (
                <div className="space-y-1">
                  {t.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-400 truncate">{item.label || item.type}</span>
                      <span className="text-gray-500 font-mono ml-2">${Number(item.price).toLocaleString()}</span>
                    </div>
                  ))}
                  {t.items.length > 3 && (
                    <div className="text-[10px] text-gray-600">+{t.items.length - 3} more</div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800">
                <span className="text-[10px] text-gray-600">{new Date(t.createdAt).toLocaleDateString()}</span>
                <button
                  onClick={() => archive(t.id)}
                  disabled={archiving === t.id}
                  className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {archiving === t.id ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-white">New Package Template</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Name *</label>
                <input
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="e.g. Gold Sponsor Package"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Description</label>
                <textarea
                  value={modalDesc}
                  onChange={e => setModalDesc(e.target.value)}
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest">Items</label>
                  <button
                    onClick={addItem}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {modalItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={item.label}
                        onChange={e => updateItem(i, { label: e.target.value })}
                        placeholder="Label"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <select
                        value={item.type}
                        onChange={e => updateItem(i, { type: e.target.value })}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      >
                        {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="number"
                        value={item.price}
                        onChange={e => updateItem(i, { price: Number(e.target.value) })}
                        placeholder="Price"
                        className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                      {modalItems.length > 1 && (
                        <button
                          onClick={() => removeItem(i)}
                          className="text-red-400/60 hover:text-red-400 text-sm transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {createError && <div className="text-red-400 text-xs">{createError}</div>}
            </div>

            <div className="px-6 py-4 border-t border-gray-800 flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-700 text-xs text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTemplate}
                disabled={creating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
