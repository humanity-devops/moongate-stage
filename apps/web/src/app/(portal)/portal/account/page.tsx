'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type UserProfile = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
};

type ContactProfile = {
  id: string;
  name: string;
  phone?: string;
  telegram?: string;
  title?: string;
  company?: { id: string; name: string; website?: string; industry?: string } | null;
};

function getHeaders(json = false) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('moongate_token') : null;
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export default function PortalAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', telegram: '', title: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/sponsor/profile`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => {
        setUser(d.data?.user ?? null);
        setContact(d.data?.contact ?? null);
        const u = d.data?.user;
        const c = d.data?.contact;
        setForm({
          name: u?.name ?? c?.name ?? '',
          phone: c?.phone ?? '',
          telegram: c?.telegram ?? '',
          title: c?.title ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaveMsg('');
    const res = await fetch(`${API_URL}/api/sponsor/profile`, {
      method: 'PATCH',
      headers: getHeaders(true),
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSaveMsg('Saved!');
    } else {
      setSaveMsg('Failed to save');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 2000);
  }

  function logout() {
    localStorage.removeItem('moongate_token');
    router.push('/auth/login');
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Account</h1>
      <p className="text-white/40 text-sm mb-8">Manage your profile and settings</p>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* Profile */}
          <div className="glass rounded-xl p-6 border border-white/[0.06] space-y-4">
            <h2 className="text-sm font-semibold text-white">Profile</h2>

            <div>
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1">Email</label>
              <div className="text-sm text-white/60">{user?.email}</div>
            </div>

            {[
              ['name', 'Full Name'],
              ['title', 'Job Title'],
              ['phone', 'Phone'],
              ['telegram', 'Telegram'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1">{label}</label>
                <input
                  type="text"
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            ))}

            {contact?.company && (
              <div>
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1">Company</label>
                <div className="text-sm text-white/60">{contact.company.name}</div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              {saveMsg && (
                <span className={`text-xs ${saveMsg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{saveMsg}</span>
              )}
            </div>
          </div>

          {/* Account actions */}
          <div className="glass rounded-xl p-6 border border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white mb-4">Account Actions</h2>
            <div className="text-xs text-white/30 mb-3">
              Member since {user ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 text-sm rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
