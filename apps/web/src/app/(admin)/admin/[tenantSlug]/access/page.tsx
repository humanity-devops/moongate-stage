'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Event = { id: string; name: string; accessMode?: string };
type Grant = {
  id: string;
  grantType: 'email' | 'token';
  email?: string;
  token?: string;
  expiresAt?: string;
  usedAt?: string;
  createdAt: string;
  revokedAt?: string;
};

type AccessMode = 'public' | 'whitelist' | 'invite_only';

type ItemAccessMode = 'public' | 'whitelist_only' | 'invite_only' | null;
type SponsorItem = { id: string; publicTitle: string; itemAccessMode: ItemAccessMode };
type ItemGrant = { id: string; email?: string; createdAt: string };

const ITEM_MODE_OPTIONS: { value: ItemAccessMode; label: string }[] = [
  { value: null, label: 'Inherit event' },
  { value: 'public', label: 'Public' },
  { value: 'whitelist_only', label: 'Whitelist only' },
  { value: 'invite_only', label: 'Invite only' },
];

const MODE_LABELS: { key: AccessMode; label: string; desc: string }[] = [
  { key: 'public', label: 'Public', desc: 'Anyone can view' },
  { key: 'whitelist', label: 'Whitelist', desc: 'Only approved emails' },
  { key: 'invite_only', label: 'Invite Only', desc: 'Token required' },
];

export default function AccessPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [accessMode, setAccessMode] = useState<AccessMode>('public');
  const [modeLoading, setModeLoading] = useState(false);

  const [tab, setTab] = useState<'email' | 'token'>('email');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [emailAdding, setEmailAdding] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [expiresAt, setExpiresAt] = useState('');
  const [tokenGenerating, setTokenGenerating] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Package-level access state
  const [items, setItems] = useState<SponsorItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemGrants, setItemGrants] = useState<Record<string, ItemGrant[]>>({});
  const [itemGrantsLoading, setItemGrantsLoading] = useState<Record<string, boolean>>({});
  const [itemModeUpdating, setItemModeUpdating] = useState<Record<string, boolean>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [itemEmailInput, setItemEmailInput] = useState<Record<string, string>>({});
  const [itemBulkInput, setItemBulkInput] = useState<Record<string, string>>({});
  const [itemBulkMode, setItemBulkMode] = useState<Record<string, boolean>>({});
  const [itemGrantAdding, setItemGrantAdding] = useState<Record<string, boolean>>({});

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      'Content-Type': 'application/json',
    };
  }

  // Load events
  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    fetch(`${API_URL}/api/organizer/events`, { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => {
        const list: Event[] = j.data ?? [];
        setEvents(list);
        if (list.length > 0) setSelectedEventId(list[0].id);
      })
      .catch(e => { if (e === 401 || e === 403) router.push('/auth/login'); });
  }, [tenantSlug, router]);

  // Load items when event changes
  const loadItems = useCallback(async () => {
    if (!selectedEventId) return;
    setItemsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/items?eventId=${selectedEventId}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      setError('Failed to load items');
    } finally {
      setItemsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, tenantSlug]);

  const loadItemGrants = useCallback(async (itemId: string) => {
    setItemGrantsLoading(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/organizer/access/items/${itemId}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setItemGrants(prev => ({ ...prev, [itemId]: json.data?.grants ?? [] }));
    } catch {
      setError('Failed to load item grants');
    } finally {
      setItemGrantsLoading(prev => ({ ...prev, [itemId]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // Load grants when event changes
  const loadGrants = useCallback(async () => {
    if (!selectedEventId) return;
    setGrantsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${selectedEventId}/access/grants`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setGrants(json.data ?? []);
    } catch {
      setError('Failed to load grants');
    } finally {
      setGrantsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, tenantSlug]);

  useEffect(() => {
    if (selectedEventId) {
      const ev = events.find(e => e.id === selectedEventId);
      if (ev?.accessMode) setAccessMode(ev.accessMode as AccessMode);
      loadGrants();
      loadItems();
    }
  }, [selectedEventId, events, loadGrants, loadItems]);

  async function changeMode(mode: AccessMode) {
    setModeLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${selectedEventId}/access`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ accessMode: mode }),
      });
      if (!res.ok) throw new Error('Failed');
      setAccessMode(mode);
      setEvents(prev => prev.map(e => e.id === selectedEventId ? { ...e, accessMode: mode } : e));
    } catch {
      setError('Failed to update access mode');
    } finally {
      setModeLoading(false);
    }
  }

  async function addEmail() {
    if (!emailInput.trim()) { setEmailError('Email is required'); return; }
    setEmailAdding(true);
    setEmailError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${selectedEventId}/access/grants`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ grantType: 'email', email: emailInput.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      setEmailInput('');
      loadGrants();
    } catch {
      setEmailError('Failed to add email');
    } finally {
      setEmailAdding(false);
    }
  }

  async function generateToken() {
    setTokenGenerating(true);
    try {
      const body: Record<string, string> = { grantType: 'token' };
      if (expiresAt) body.expiresAt = expiresAt;
      const res = await fetch(`${API_URL}/api/organizer/events/${selectedEventId}/access/grants`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      setExpiresAt('');
      loadGrants();
    } catch {
      setError('Failed to generate token');
    } finally {
      setTokenGenerating(false);
    }
  }

  async function revokeGrant(grantId: string) {
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${selectedEventId}/access/grants/${grantId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      loadGrants();
    } catch {
      setError('Failed to revoke grant');
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function updateItemMode(itemId: string, mode: ItemAccessMode) {
    setItemModeUpdating(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/organizer/access/items/${itemId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error('Failed');
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, itemAccessMode: mode } : it));
    } catch {
      setError('Failed to update item access mode');
    } finally {
      setItemModeUpdating(prev => ({ ...prev, [itemId]: false }));
    }
  }

  async function addItemEmail(itemId: string) {
    const email = (itemEmailInput[itemId] ?? '').trim();
    if (!email) return;
    setItemGrantAdding(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/organizer/access/items/${itemId}/grants`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ emails: [email] }),
      });
      if (!res.ok) throw new Error('Failed');
      setItemEmailInput(prev => ({ ...prev, [itemId]: '' }));
      loadItemGrants(itemId);
    } catch {
      setError('Failed to add email grant');
    } finally {
      setItemGrantAdding(prev => ({ ...prev, [itemId]: false }));
    }
  }

  async function addItemBulkEmails(itemId: string) {
    const raw = (itemBulkInput[itemId] ?? '').trim();
    const emails = raw.split(/[\n,]+/).map(e => e.trim()).filter(e => e.length > 0);
    if (emails.length === 0) return;
    setItemGrantAdding(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/organizer/access/items/${itemId}/grants`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ emails }),
      });
      if (!res.ok) throw new Error('Failed');
      setItemBulkInput(prev => ({ ...prev, [itemId]: '' }));
      setItemBulkMode(prev => ({ ...prev, [itemId]: false }));
      loadItemGrants(itemId);
    } catch {
      setError('Failed to bulk import emails');
    } finally {
      setItemGrantAdding(prev => ({ ...prev, [itemId]: false }));
    }
  }

  async function deleteItemGrant(itemId: string, grantId: string) {
    try {
      const res = await fetch(`${API_URL}/api/organizer/access/items/${itemId}/grants/${grantId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      setItemGrants(prev => ({ ...prev, [itemId]: (prev[itemId] ?? []).filter(g => g.id !== grantId) }));
    } catch {
      setError('Failed to delete grant');
    }
  }

  function toggleItemExpand(itemId: string) {
    if (expandedItem === itemId) {
      setExpandedItem(null);
    } else {
      setExpandedItem(itemId);
      if (!itemGrants[itemId]) loadItemGrants(itemId);
    }
  }

  const emailGrants = grants.filter(g => g.grantType === 'email');
  const tokenGrants = grants.filter(g => g.grantType === 'token');

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-white">Access Control</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage who can access your events</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-xs text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-white">×</button>
        </div>
      )}

      {/* Event selector */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <label className="block text-xs text-gray-400 mb-2">Select Event</label>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full max-w-md"
        >
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {selectedEventId && (
        <>
          {/* Access mode */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Access Mode</h2>
            <div className="flex gap-3">
              {MODE_LABELS.map(m => (
                <button
                  key={m.key}
                  onClick={() => changeMode(m.key)}
                  disabled={modeLoading || accessMode === m.key}
                  className={`flex-1 py-3 px-4 rounded-xl border text-xs font-medium transition-all ${
                    accessMode === m.key
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Package-Level Access Controls */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Package-Level Access Controls</h2>
              <p className="text-[10px] text-gray-500 mt-1">Override the event access mode per package. Leave as &quot;Inherit event&quot; to use the event default.</p>
            </div>

            {itemsLoading ? (
              <div className="p-5 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] animate-pulse rounded-lg" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="p-5 text-xs text-gray-500 text-center">No packages for this event</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {items.map(item => (
                  <div key={item.id}>
                    {/* Item row */}
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white truncate">{item.publicTitle}</div>
                      </div>
                      <select
                        value={item.itemAccessMode ?? 'null'}
                        onChange={e => {
                          const val = e.target.value === 'null' ? null : e.target.value as ItemAccessMode;
                          updateItemMode(item.id, val);
                        }}
                        disabled={itemModeUpdating[item.id]}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none disabled:opacity-50"
                      >
                        {ITEM_MODE_OPTIONS.map(opt => (
                          <option key={String(opt.value)} value={opt.value ?? 'null'}>{opt.label}</option>
                        ))}
                      </select>
                      {item.itemAccessMode === 'whitelist_only' && (
                        <button
                          onClick={() => toggleItemExpand(item.id)}
                          className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                            expandedItem === item.id
                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                              : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                          }`}
                        >
                          Manage whitelist
                        </button>
                      )}
                    </div>

                    {/* Expanded whitelist panel */}
                    {expandedItem === item.id && item.itemAccessMode === 'whitelist_only' && (
                      <div className="px-5 pb-4 bg-gray-950/40 space-y-3">
                        {/* Add single email */}
                        {!itemBulkMode[item.id] && (
                          <div className="flex gap-2 pt-3">
                            <input
                              type="email"
                              value={itemEmailInput[item.id] ?? ''}
                              onChange={e => setItemEmailInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && addItemEmail(item.id)}
                              placeholder="user@example.com"
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                            />
                            <button
                              onClick={() => addItemEmail(item.id)}
                              disabled={itemGrantAdding[item.id]}
                              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                            >
                              {itemGrantAdding[item.id] ? 'Adding...' : 'Add'}
                            </button>
                            <button
                              onClick={() => setItemBulkMode(prev => ({ ...prev, [item.id]: true }))}
                              className="px-3 py-2 border border-gray-700 text-gray-400 hover:text-white text-xs rounded-lg transition-colors"
                            >
                              Bulk import
                            </button>
                          </div>
                        )}

                        {/* Bulk import textarea */}
                        {itemBulkMode[item.id] && (
                          <div className="pt-3 space-y-2">
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest">
                              Paste emails (one per line)
                            </label>
                            <textarea
                              value={itemBulkInput[item.id] ?? ''}
                              onChange={e => setItemBulkInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                              rows={4}
                              placeholder="alice@example.com&#10;bob@example.com&#10;carol@example.com"
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => addItemBulkEmails(item.id)}
                                disabled={itemGrantAdding[item.id]}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                              >
                                {itemGrantAdding[item.id] ? 'Importing...' : 'Import'}
                              </button>
                              <button
                                onClick={() => setItemBulkMode(prev => ({ ...prev, [item.id]: false }))}
                                className="px-3 py-2 border border-gray-700 text-gray-400 hover:text-white text-xs rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Grant list */}
                        {itemGrantsLoading[item.id] ? (
                          <div className="space-y-1">
                            {[...Array(2)].map((_, i) => <div key={i} className="h-8 bg-white/[0.03] animate-pulse rounded" />)}
                          </div>
                        ) : (itemGrants[item.id] ?? []).length === 0 ? (
                          <div className="text-[10px] text-gray-600 py-2">No whitelist entries yet</div>
                        ) : (
                          <div className="divide-y divide-gray-800/60">
                            {(itemGrants[item.id] ?? []).map(g => (
                              <div key={g.id} className="flex items-center justify-between py-2">
                                <span className="text-xs text-gray-300">{g.email}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-gray-600">{new Date(g.createdAt).toLocaleDateString()}</span>
                                  <button
                                    onClick={() => deleteItemGrant(item.id, g.id)}
                                    className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grants tabs */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex border-b border-gray-800">
              {(['email', 'token'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-3 text-xs font-medium transition-colors ${
                    tab === t ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'email' ? 'Email Whitelist' : 'One-Time Links'}
                  <span className="ml-1.5 text-[10px] text-gray-600">
                    ({t === 'email' ? emailGrants.length : tokenGrants.length})
                  </span>
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'email' && (
                <div className="space-y-4">
                  {/* Add email */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
                        onKeyDown={e => e.key === 'Enter' && addEmail()}
                        placeholder="user@example.com"
                        className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none ${
                          emailError ? 'border-red-500/50' : 'border-gray-700'
                        }`}
                      />
                      {emailError && <p className="text-red-400 text-[10px] mt-1">{emailError}</p>}
                    </div>
                    <button
                      onClick={addEmail}
                      disabled={emailAdding}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      {emailAdding ? 'Adding...' : 'Add'}
                    </button>
                  </div>

                  {/* Email list */}
                  {grantsLoading ? (
                    <div className="space-y-1">
                      {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-white/[0.03] animate-pulse rounded-lg" />)}
                    </div>
                  ) : emailGrants.length === 0 ? (
                    <div className="text-xs text-gray-500 py-4 text-center">No email grants yet</div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {emailGrants.map(g => (
                        <div key={g.id} className="flex items-center justify-between py-2.5">
                          <span className="text-xs text-gray-300">{g.email}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-gray-500">{new Date(g.createdAt).toLocaleDateString()}</span>
                            {g.revokedAt ? (
                              <span className="text-[10px] text-red-400/60">Revoked</span>
                            ) : (
                              <button
                                onClick={() => revokeGrant(g.id)}
                                className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'token' && (
                <div className="space-y-4">
                  {/* Generate token */}
                  <div className="flex gap-2 items-end">
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Expiry (optional)</label>
                      <input
                        type="date"
                        value={expiresAt}
                        onChange={e => setExpiresAt(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={generateToken}
                      disabled={tokenGenerating}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      {tokenGenerating ? 'Generating...' : 'Generate Link'}
                    </button>
                  </div>

                  {/* Token list */}
                  {grantsLoading ? (
                    <div className="space-y-1">
                      {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] animate-pulse rounded-lg" />)}
                    </div>
                  ) : tokenGrants.length === 0 ? (
                    <div className="text-xs text-gray-500 py-4 text-center">No links generated yet</div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      <div className="grid grid-cols-5 text-[10px] text-gray-500 pb-2">
                        <span>Token</span>
                        <span>Created</span>
                        <span>Expires</span>
                        <span>Used</span>
                        <span></span>
                      </div>
                      {tokenGrants.map(g => (
                        <div key={g.id} className="grid grid-cols-5 items-center py-2.5 gap-2">
                          <span className="font-mono text-[10px] text-gray-400">
                            {g.token ? g.token.slice(0, 12) + '...' : '—'}
                          </span>
                          <span className="text-[10px] text-gray-500">{new Date(g.createdAt).toLocaleDateString()}</span>
                          <span className="text-[10px] text-gray-500">
                            {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : 'Never'}
                          </span>
                          <span className={`text-[10px] ${g.usedAt ? 'text-green-400' : 'text-gray-600'}`}>
                            {g.usedAt ? 'Yes' : 'No'}
                          </span>
                          <div className="flex items-center gap-2 justify-end">
                            {g.token && (
                              <button
                                onClick={() => copyLink(g.token!)}
                                className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                              >
                                {copied === g.token ? 'Copied!' : 'Copy'}
                              </button>
                            )}
                            {g.revokedAt ? (
                              <span className="text-[10px] text-red-400/60">Revoked</span>
                            ) : (
                              <button
                                onClick={() => revokeGrant(g.id)}
                                className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
