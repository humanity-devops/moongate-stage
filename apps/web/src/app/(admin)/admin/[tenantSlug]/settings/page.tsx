'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type FeatureFlag = { key: string; enabled: boolean; description?: string };

type OrgSettings = {
  name?: string;
  logoUrl?: string;
  websiteUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  timezone?: string;
  currency?: string;
  featureFlags?: FeatureFlag[];
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'USDC', 'ETH'];

export default function SettingsPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [settings, setSettings] = useState<OrgSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUrlError, setLogoUrlError] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteUrlError, setWebsiteUrlError] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4361ee');
  const [accentColor, setAccentColor] = useState('#7c3aed');
  const [timezone, setTimezone] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Feature flags
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagSaving, setFlagSaving] = useState<string | null>(null);

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      'Content-Type': 'application/json',
    };
  }

  async function loadSettings() {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/settings`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const s: OrgSettings = json.data ?? {};
      setSettings(s);
      setName(s.name ?? '');
      setLogoUrl(s.logoUrl ?? '');
      setWebsiteUrl(s.websiteUrl ?? '');
      setPrimaryColor(s.primaryColor ?? '#4361ee');
      setAccentColor(s.accentColor ?? '#7c3aed');
      setTimezone(s.timezone ?? '');
      setCurrency(s.currency ?? 'USD');
      setFlags(s.featureFlags ?? []);
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function isValidUrl(value: string): boolean {
    if (!value) return true; // optional
    try { new URL(value); return true; } catch { return false; }
  }

  function validateWebsiteUrl() {
    if (websiteUrl && !isValidUrl(websiteUrl)) {
      setWebsiteUrlError('Must be a valid URL (e.g. https://yourconference.com)');
    } else {
      setWebsiteUrlError('');
    }
  }

  function validateLogoUrl() {
    if (logoUrl && !isValidUrl(logoUrl)) {
      setLogoUrlError('Must be a valid URL (e.g. https://cdn.example.com/logo.png)');
    } else {
      setLogoUrlError('');
    }
  }

  async function saveSettings() {
    // Validate URLs before submitting
    const websiteValid = !websiteUrl || isValidUrl(websiteUrl);
    const logoValid = !logoUrl || isValidUrl(logoUrl);
    if (!websiteValid) { setWebsiteUrlError('Must be a valid URL'); return; }
    if (!logoValid) { setLogoUrlError('Must be a valid URL'); return; }

    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/settings`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ name, logoUrl: logoUrl || undefined, websiteUrl: websiteUrl || undefined, primaryColor, accentColor, timezone, currency }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaveMsg('Settings saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFlag(key: string, enabled: boolean) {
    setFlagSaving(key);
    try {
      const res = await fetch(`${API_URL}/api/organizer/settings/feature-flags/${key}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed');
      setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
    } catch {
      setError('Failed to update feature flag');
    } finally {
      setFlagSaving(null);
    }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white/[0.03] animate-pulse rounded-xl" />)}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white">General Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Configure your organization</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* General form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Organization</h2>

        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Organization Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Website URL</label>
          <input
            type="url"
            value={websiteUrl}
            onChange={e => { setWebsiteUrl(e.target.value); setWebsiteUrlError(''); }}
            onBlur={validateWebsiteUrl}
            placeholder="https://yourconference.com"
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none ${
              websiteUrlError ? 'border-red-500/50' : 'border-gray-700'
            }`}
          />
          {websiteUrlError && <p className="text-red-400 text-[10px] mt-1">{websiteUrlError}</p>}
        </div>

        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Logo URL <span className="normal-case text-gray-600">(optional)</span></label>
          <input
            type="url"
            value={logoUrl}
            onChange={e => { setLogoUrl(e.target.value); setLogoUrlError(''); }}
            onBlur={validateLogoUrl}
            placeholder="https://cdn.example.com/logo.png"
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none ${
              logoUrlError ? 'border-red-500/50' : 'border-gray-700'
            }`}
          />
          {logoUrlError && <p className="text-red-400 text-[10px] mt-1">{logoUrlError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={e => setAccentColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                value={accentColor}
                onChange={e => setAccentColor(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Timezone</label>
            <input
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saveMsg && (
            <span className={`text-xs ${saveMsg === 'Settings saved!' ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Feature flags */}
      {flags.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Feature Flags</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {flags.map(flag => (
              <div key={flag.key} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-xs font-mono text-gray-300">{flag.key}</div>
                  {flag.description && <div className="text-[10px] text-gray-500 mt-0.5">{flag.description}</div>}
                </div>
                <button
                  onClick={() => toggleFlag(flag.key, !flag.enabled)}
                  disabled={flagSaving === flag.key}
                  className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
                    flag.enabled ? 'bg-indigo-600' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    flag.enabled ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
