'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Contact = {
  id: string;
  name: string;
  email: string;
  company?: string;
  title?: string;
  status: string;
  tags: string[];
  inviteCode?: string;
  inviteSentAt?: string;
  convertedAt?: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  new: 'text-white/50 bg-white/[0.06] border-white/10',
  contacted: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  responded: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  converted: 'text-green-300 bg-green-500/10 border-green-500/20',
  archived: 'text-white/20 bg-white/[0.03] border-white/[0.06]',
};

const STATUSES = ['new', 'contacted', 'responded', 'converted', 'archived'];

type AddForm = { name: string; email: string; company: string; title: string; notes: string };

export default function OutreachPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ name: '', email: '', company: '', title: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;

  const loadContacts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`${API_URL}/api/organizer/outreach?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
      });
      if (!res.ok) { if (res.status === 401) router.push('/auth/login'); return; }
      const json = await res.json();
      setContacts(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug, statusFilter, search, router]);

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    const timer = setTimeout(loadContacts, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadContacts, token, router, search]);

  async function addContact() {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/outreach`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug, 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddForm({ name: '', email: '', company: '', title: '', notes: '' });
        loadContacts();
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(contactId: string) {
    if (!token) return;
    await fetch(`${API_URL}/api/organizer/outreach/${contactId}/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
    });
    loadContacts();
  }

  async function updateStatus(contactId: string, status: string) {
    if (!token) return;
    await fetch(`${API_URL}/api/organizer/outreach/${contactId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadContacts();
  }

  async function handleExport() {
    const res = await fetch(`${API_URL}/api/organizer/outreach/export`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch(`${API_URL}/api/organizer/outreach/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug, 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importText }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data.data);
        setImportText('');
        loadContacts();
      } else {
        setImportResult({ created: 0, skipped: 0, errors: [data.error ?? 'Import failed'] });
      }
    } catch {
      setImportResult({ created: 0, skipped: 0, errors: ['Network error'] });
    }
    setImporting(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }

  async function deleteContact(contactId: string) {
    if (!token || !confirm('Delete this contact?')) return;
    await fetch(`${API_URL}/api/organizer/outreach/${contactId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug },
    });
    loadContacts();
  }

  const stats = {
    total,
    converted: contacts.filter(c => c.status === 'converted').length,
    contacted: contacts.filter(c => c.status === 'contacted' || c.status === 'responded').length,
  };

  return (
    <div className="min-h-screen" style={{ background: '#06060a', color: 'white' }}>
      {/* Nav */}
      <nav className="border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0d0d14' }}>
        <div className="flex items-center gap-4">
          <Link href={`/admin/${tenantSlug}/events`} className="text-sm text-white/40 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <span className="text-white/10">|</span>
          <h1 className="text-sm font-semibold text-white">Outreach Pipeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => setShowImport(s => !s)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary text-xs px-4 py-2"
          >
            + Add contact
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total contacts', value: stats.total },
            { label: 'In pipeline', value: stats.contacted },
            { label: 'Converted', value: stats.converted },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl px-5 py-4">
              <div className="text-2xl font-bold text-white font-mono">{value}</div>
              <div className="text-xs text-white/40 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search by name, email, company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/40 transition-all"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex gap-1">
            {['', ...STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize border transition-all ${
                  statusFilter === s
                    ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                    : 'border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Import panel */}
        {showImport && (
          <div className="glass rounded-xl border border-white/[0.06] p-5 mb-6">
            <h3 className="text-sm font-semibold text-white mb-3">Import Contacts from CSV</h3>
            <p className="text-xs text-white/40 mb-3">Required columns: <code className="text-indigo-300">name</code>, <code className="text-indigo-300">email</code>. Optional: company, title, notes, status, tags (semicolon-separated).</p>
            <div className="mb-3">
              <label className="block text-xs text-white/40 mb-1">Upload CSV file</label>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="text-xs text-white/60" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-white/40 mb-1">Or paste CSV text</label>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={5}
                placeholder={"name,email,company\nJohn Doe,john@acme.com,Acme Corp"}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 font-mono"
              />
            </div>
            {importResult && (
              <div className={`mb-3 p-3 rounded-lg text-xs ${importResult.errors.length > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
                <div className="text-white/70 mb-1">Created: {importResult.created} · Skipped (duplicates): {importResult.skipped}</div>
                {importResult.errors.length > 0 && (
                  <ul className="text-red-400/80 space-y-0.5">
                    {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {importResult.errors.length > 5 && <li>...and {importResult.errors.length - 5} more</li>}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
              <button onClick={() => { setShowImport(false); setImportResult(null); setImportText(''); }} className="px-4 py-2 text-xs text-white/40 hover:text-white/70 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass rounded-xl p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/30 text-sm mb-4">No contacts yet.</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-5 py-2.5">
              Add your first contact
            </button>
          </div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Contact', 'Company', 'Status', 'Invite', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs text-white/30 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact, idx) => (
                  <tr
                    key={contact.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${idx === contacts.length - 1 ? 'border-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{contact.name}</div>
                      <div className="text-xs text-white/35 mt-0.5">{contact.email}</div>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">{contact.company ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={contact.status}
                        onChange={e => updateStatus(contact.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-md border bg-transparent focus:outline-none capitalize cursor-pointer ${STATUS_COLORS[contact.status] ?? 'text-white/40'}`}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s} className="bg-[#0d0d14] capitalize">{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {contact.convertedAt ? (
                        <span className="text-xs text-green-400">Converted</span>
                      ) : contact.inviteSentAt ? (
                        <span className="text-xs text-white/30">Sent {new Date(contact.inviteSentAt).toLocaleDateString()}</span>
                      ) : (
                        <button
                          onClick={() => sendInvite(contact.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Send invite
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteContact(contact.id)}
                        className="text-xs text-white/20 hover:text-red-400 transition-colors"
                        aria-label="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 3.5H12M5 3.5V2.5H9V3.5M5.5 6V10M8.5 6V10M3 3.5L4 11.5H10L11 3.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add contact modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glass rounded-2xl p-8 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-bold text-white">Add contact</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/30 hover:text-white transition-colors text-xl leading-none">×</button>
            </div>

            {(['name', 'email', 'company', 'title'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs text-white/40 mb-1 uppercase tracking-wide">
                  {field}{field === 'name' || field === 'email' ? ' *' : ''}
                </label>
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  value={addForm[field]}
                  onChange={e => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
                  placeholder={field === 'name' ? 'Full name' : field === 'email' ? 'email@company.com' : field === 'company' ? 'Company name' : 'Job title'}
                />
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="text-sm text-white/40 hover:text-white px-4 py-2 transition-colors">Cancel</button>
              <button
                onClick={addContact}
                disabled={saving || !addForm.name || !addForm.email}
                className="btn-primary text-sm px-5 py-2.5 disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Add contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
