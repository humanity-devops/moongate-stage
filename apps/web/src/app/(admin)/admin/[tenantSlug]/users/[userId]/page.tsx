'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type HistoryEntry = {
  id: string;
  eventType: string;
  createdAt: string;
  actor?: { email?: string; name?: string };
};

type UserDetail = {
  id: string;
  email: string;
  name?: string;
  membership?: {
    role: string;
    status: string;
    isActive: boolean;
  };
  profile?: {
    bio?: string;
    phone?: string;
    telegram?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
    company?: string;
    jobTitle?: string;
    location?: string;
    timezone?: string;
    segment?: string;
    tags?: string[];
  };
  history?: HistoryEntry[];
};

const ALL_ROLES = [
  'organizer_owner',
  'organizer_admin',
  'organizer_ops',
  'organizer_growth',
  'organizer_analytics',
  'organizer_compliance',
  'organizer_sales',
  'organizer_finance',
  'organizer_viewer',
];

const ROLE_STYLES: Record<string, string> = {
  organizer_owner: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  organizer_admin: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  organizer_ops: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  organizer_growth: 'text-green-300 bg-green-500/10 border-green-500/30',
  organizer_analytics: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
  organizer_compliance: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  organizer_sales: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  organizer_finance: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30',
  organizer_viewer: 'text-gray-400 bg-gray-800 border-gray-700',
};

const SEGMENTS = ['investor', 'builder', 'protocol', 'enterprise', 'community'];

export default function UserProfilePage() {
  const params = useParams() as { tenantSlug: string; userId: string };
  const { tenantSlug, userId } = params;
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Profile form
  const [profile, setProfile] = useState({
    bio: '', phone: '', telegram: '', twitter: '', linkedin: '',
    website: '', company: '', jobTitle: '', location: '', timezone: '',
    segment: '', tags: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Membership form
  const [role, setRole] = useState('');
  const [membershipSaving, setMembershipSaving] = useState(false);
  const [membershipMsg, setMembershipMsg] = useState('');

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      'Content-Type': 'application/json',
    };
  }

  async function loadUser() {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/users/${userId}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const u: UserDetail = json.data ?? json;
      setUser(u);
      setRole(u.membership?.role ?? '');
      const p = u.profile ?? {};
      setProfile({
        bio: p.bio ?? '',
        phone: p.phone ?? '',
        telegram: p.telegram ?? '',
        twitter: p.twitter ?? '',
        linkedin: p.linkedin ?? '',
        website: p.website ?? '',
        company: p.company ?? '',
        jobTitle: p.jobTitle ?? '',
        location: p.location ?? '',
        timezone: p.timezone ?? '',
        segment: p.segment ?? '',
        tags: (p.tags ?? []).join(', '),
      });
    } catch {
      setError('Failed to load user');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUser(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const body = {
        ...profile,
        tags: profile.tags ? profile.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      const res = await fetch(`${API_URL}/api/organizer/users/${userId}/profile`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      setProfileMsg('Saved!');
      setTimeout(() => setProfileMsg(''), 2000);
    } catch {
      setProfileMsg('Failed to save');
    } finally {
      setProfileSaving(false);
    }
  }

  async function updateRole() {
    setMembershipSaving(true);
    setMembershipMsg('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/users/${userId}/membership`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed');
      setMembershipMsg('Role updated!');
      setTimeout(() => setMembershipMsg(''), 2000);
      loadUser();
    } catch {
      setMembershipMsg('Failed to update role');
    } finally {
      setMembershipSaving(false);
    }
  }

  async function toggleStatus() {
    if (!user?.membership) return;
    const isActive = !user.membership.isActive;
    const status = isActive ? 'active' : 'suspended';
    setMembershipSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/users/${userId}/membership`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status, isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      loadUser();
    } catch {
      setMembershipMsg('Failed to update status');
    } finally {
      setMembershipSaving(false);
    }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white/[0.03] animate-pulse rounded-xl" />)}
    </div>
  );

  if (error || !user) return (
    <div className="p-6">
      <div className="text-red-400 text-sm">{error || 'User not found'}</div>
    </div>
  );

  const membership = user.membership;
  const currentRoleStyle = ROLE_STYLES[membership?.role ?? ''] ?? 'text-gray-400 bg-gray-800 border-gray-700';

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Back */}
      <Link href={`/admin/${tenantSlug}/users`} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
        ← Back to Directory
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-lg shrink-0">
          {(user.name ?? user.email ?? '?')[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{user.name ?? user.email}</h1>
          <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
          {membership && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${currentRoleStyle}`}>
                {membership.role.replace('organizer_', '')}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                membership.isActive
                  ? 'text-green-300 bg-green-500/10 border-green-500/30'
                  : 'text-red-300 bg-red-500/10 border-red-500/30'
              }`}>{membership.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Profile section */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Profile</h2>

        <div className="grid grid-cols-2 gap-4">
          {([
            ['bio', 'Bio', 'textarea'],
            ['company', 'Company', 'text'],
            ['jobTitle', 'Job Title', 'text'],
            ['phone', 'Phone', 'text'],
            ['telegram', 'Telegram', 'text'],
            ['twitter', 'Twitter', 'text'],
            ['linkedin', 'LinkedIn', 'text'],
            ['website', 'Website', 'text'],
            ['location', 'Location', 'text'],
            ['timezone', 'Timezone', 'text'],
            ['tags', 'Tags (comma-separated)', 'text'],
          ] as [keyof typeof profile, string, string][]).map(([key, label, type]) => (
            <div key={key} className={type === 'textarea' || key === 'tags' ? 'col-span-2' : ''}>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</label>
              {type === 'textarea' ? (
                <textarea
                  value={profile[key]}
                  onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={profile[key]}
                  onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              )}
            </div>
          ))}

          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Segment</label>
            <select
              value={profile.segment}
              onChange={e => setProfile(p => ({ ...p, segment: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">Select segment</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
          {profileMsg && <span className={`text-xs ${profileMsg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{profileMsg}</span>}
        </div>
      </div>

      {/* Membership section */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Membership</h2>

        {membership ? (
          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace('organizer_', '')}</option>)}
                </select>
              </div>
              <button
                onClick={updateRole}
                disabled={membershipSaving || role === membership.role}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                Update Role
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleStatus}
                disabled={membershipSaving}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  membership.isActive
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                    : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                }`}
              >
                {membership.isActive ? 'Suspend User' : 'Reactivate User'}
              </button>
              {membershipMsg && <span className={`text-xs ${membershipMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{membershipMsg}</span>}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500">No membership record found</div>
        )}

        {/* History timeline */}
        {user.history && user.history.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 pt-2 border-t border-gray-800">History</h3>
            <div className="space-y-3">
              {user.history.map(h => (
                <div key={h.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-300">{h.eventType}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
                      {h.actor && (
                        <span className="text-[10px] text-gray-600">by {h.actor.name ?? h.actor.email}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
