'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type TeamMember = {
  id: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  user: { id: string; email: string; name?: string };
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

// Hardcoded permission matrix
const PERMISSIONS: { key: string; label: string; roles: string[] }[] = [
  { key: 'manage_events', label: 'Manage Events', roles: ['organizer_owner', 'organizer_admin', 'organizer_ops'] },
  { key: 'manage_proposals', label: 'Manage Proposals', roles: ['organizer_owner', 'organizer_admin', 'organizer_ops', 'organizer_sales'] },
  { key: 'manage_approvals', label: 'Manage Approvals', roles: ['organizer_owner', 'organizer_admin'] },
  { key: 'manage_access', label: 'Manage Access', roles: ['organizer_owner', 'organizer_admin', 'organizer_ops'] },
  { key: 'manage_kyc', label: 'Manage KYC', roles: ['organizer_owner', 'organizer_admin', 'organizer_compliance'] },
  { key: 'view_analytics', label: 'View Analytics', roles: ['organizer_owner', 'organizer_admin', 'organizer_ops', 'organizer_analytics', 'organizer_growth'] },
  { key: 'manage_users', label: 'Manage Users', roles: ['organizer_owner', 'organizer_admin'] },
  { key: 'manage_settings', label: 'Manage Settings', roles: ['organizer_owner', 'organizer_admin'] },
  { key: 'manage_roles', label: 'Manage Roles', roles: ['organizer_owner'] },
  { key: 'view_audit_logs', label: 'View Audit Logs', roles: ['organizer_owner', 'organizer_admin', 'organizer_compliance'] },
  { key: 'outreach', label: 'Outreach', roles: ['organizer_owner', 'organizer_admin', 'organizer_growth', 'organizer_sales'] },
  { key: 'manage_finance', label: 'Manage Finance', roles: ['organizer_owner', 'organizer_admin', 'organizer_finance'] },
  { key: 'view_only', label: 'View Only', roles: ALL_ROLES },
];

const ROLE_SHORT: Record<string, string> = {
  organizer_owner: 'Owner',
  organizer_admin: 'Admin',
  organizer_ops: 'Ops',
  organizer_growth: 'Growth',
  organizer_analytics: 'Analytics',
  organizer_compliance: 'Compliance',
  organizer_sales: 'Sales',
  organizer_finance: 'Finance',
  organizer_viewer: 'Viewer',
};

export default function RolesPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      'Content-Type': 'application/json',
    };
  }

  async function loadMembers() {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/settings/members`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const items: TeamMember[] = json.data ?? [];
      setMembers(items);
      const initial: Record<string, string> = {};
      items.forEach(m => { initial[m.id] = m.role; });
      setPendingRoles(initial);
    } catch {
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMembers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeRole(memberId: string, userId: string) {
    setSaving(memberId);
    try {
      const res = await fetch(`${API_URL}/api/organizer/users/${userId}/membership`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ role: pendingRoles[memberId] }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaveMsg(prev => ({ ...prev, [memberId]: 'Updated!' }));
      setTimeout(() => setSaveMsg(prev => ({ ...prev, [memberId]: '' })), 2000);
      loadMembers();
    } catch {
      setSaveMsg(prev => ({ ...prev, [memberId]: 'Failed' }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-white">Roles & Permissions</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage team roles and see permission matrix</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Team members table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Team Members</h2>
        </div>
        {loading ? (
          <div className="space-y-px p-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] animate-pulse rounded-lg" />)}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left px-4 py-3">Name / Email</th>
                <th className="text-left px-3 py-3">Role</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-left px-3 py-3">Last Login</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{m.user.name ?? '—'}</div>
                    <div className="text-gray-500">{m.user.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={pendingRoles[m.id] ?? m.role}
                      onChange={e => setPendingRoles(prev => ({ ...prev, [m.id]: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_SHORT[r] ?? r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      m.status === 'active' ? 'text-green-300 bg-green-500/10 border-green-500/30' : 'text-gray-400 bg-gray-800 border-gray-700'
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeRole(m.id, m.user.id)}
                        disabled={saving === m.id || pendingRoles[m.id] === m.role}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] rounded transition-colors disabled:opacity-40"
                      >
                        {saving === m.id ? '...' : 'Change'}
                      </button>
                      {saveMsg[m.id] && (
                        <span className={`text-[10px] ${saveMsg[m.id] === 'Updated!' ? 'text-green-400' : 'text-red-400'}`}>
                          {saveMsg[m.id]}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Permission matrix */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Permission Matrix</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Read-only reference</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2 text-gray-500 min-w-[140px]">Permission</th>
                {ALL_ROLES.map(r => (
                  <th key={r} className="text-center px-2 py-2 text-gray-500 min-w-[70px]">
                    {ROLE_SHORT[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {PERMISSIONS.map(p => (
                <tr key={p.key} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-gray-300">{p.label}</td>
                  {ALL_ROLES.map(r => (
                    <td key={r} className="px-2 py-2 text-center">
                      {p.roles.includes(r) ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
