'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type OrgMember = {
  id: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
};

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

function RoleChip({ role }: { role: string }) {
  const styles = ROLE_STYLES[role] ?? 'text-gray-400 bg-gray-800 border-gray-700';
  const label = role.replace('organizer_', '');
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${styles}`}>{label}</span>
  );
}

export default function UsersPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
    };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`${API_URL}/api/organizer/users?${params}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const items: OrgMember[] = json.data ?? [];
      setMembers(items);
      setTotal(json.total ?? items.length);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, tenantSlug]);

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    load();
  }, [load, router]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">User Directory</h1>
        <p className="text-xs text-gray-400 mt-0.5">{total} members in your organization</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none w-64"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
        >
          <option value="">All roles</option>
          {ALL_ROLES.map(r => (
            <option key={r} value={r}>{r.replace('organizer_', '')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-white/[0.03] animate-pulse rounded-xl" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <div className="text-4xl mb-3">👥</div>
          <div className="text-sm">No users found</div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left px-4 py-3">Name / Email</th>
                <th className="text-left px-3 py-3">Role</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-left px-3 py-3">Last Login</th>
                <th className="text-left px-3 py-3">Joined</th>
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
                  <td className="px-3 py-3"><RoleChip role={m.role} /></td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      m.status === 'active'
                        ? 'text-green-300 bg-green-500/10 border-green-500/30'
                        : m.status === 'suspended'
                        ? 'text-red-300 bg-red-500/10 border-red-500/30'
                        : 'text-gray-400 bg-gray-800 border-gray-700'
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/${tenantSlug}/users/${m.user.id}`}
                      className="text-indigo-400 hover:text-indigo-300 text-[10px] transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
