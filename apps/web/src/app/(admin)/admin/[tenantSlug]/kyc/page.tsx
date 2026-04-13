'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type KycStatus = 'not_started' | 'submitted' | 'needs_more_info' | 'approved' | 'rejected';

type Submission = {
  id: string;
  referenceType?: string;
  referenceId?: string;
  status: KycStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  data?: Record<string, unknown>;
};

type KycNote = {
  id: string;
  submissionId: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
};

type KycAuditEntry = {
  id: string;
  submissionId: string;
  action: string;
  actorId: string | null;
  actorName: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type TimelineItem =
  | ({ type: 'note' } & KycNote)
  | ({ type: 'audit' } & KycAuditEntry);

type KycField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'file' | 'select' | 'url' | 'email';
  required: boolean;
};

type FieldDef = {
  id: string;
  type: 'text' | 'textarea' | 'file' | 'select' | 'checkbox';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helperNote?: string;
  exampleImageUrl?: string;
};

type KycFileEntry = {
  fieldKey: string;
  fieldLabel: string;
  fileAssetId: string | null;
  value: unknown;
  asset: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    publicUrl: string | null;
    storagePath: string;
    createdAt: string;
  } | null;
};

type KycTemplate = {
  id: string;
  name: string;
  description?: string | null;
  fields: FieldDef[];
  isActive: boolean;
  createdAt: string;
  _sentCount?: number;
};

const STATUS_STYLES: Record<KycStatus, string> = {
  not_started: 'text-gray-400 bg-gray-800 border-gray-700',
  submitted: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  needs_more_info: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  approved: 'text-green-300 bg-green-500/10 border-green-500/30',
  rejected: 'text-red-300 bg-red-500/10 border-red-500/30',
};

const STATUS_LABELS: Record<KycStatus, string> = {
  not_started: 'Not Started',
  submitted: 'Submitted',
  needs_more_info: 'Needs More Info',
  approved: 'Approved',
  rejected: 'Rejected',
};

const ALL_STATUSES: KycStatus[] = ['not_started', 'submitted', 'needs_more_info', 'approved', 'rejected'];

const ACTION_LABELS: Record<string, string> = {
  status_changed: 'Status Changed',
  note_added: 'Note Added',
  form_submitted: 'Form Submitted',
};

const ACTION_COLORS: Record<string, string> = {
  status_changed: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
  note_added: 'text-gray-300 bg-gray-500/10 border-gray-500/30',
  form_submitted: 'text-green-300 bg-green-500/10 border-green-500/30',
};

function StatusChip({ status }: { status: KycStatus }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'text-gray-400 bg-gray-800 border-gray-700';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

export default function KycPage() {
  const { tenantSlug } = useParams() as { tenantSlug: string };
  const router = useRouter();

  const [tab, setTab] = useState<'submissions' | 'config' | 'templates'>('submissions');

  // Submissions tab
  const [statusFilter, setStatusFilter] = useState<KycStatus | ''>('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subLoading, setSubLoading] = useState(true);
  const [subError, setSubError] = useState('');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'needs_more_info' | 'rejected' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Timeline state
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Files panel state
  const [files, setFiles] = useState<KycFileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Config tab
  const [fields, setFields] = useState<KycField[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [editingConfig, setEditingConfig] = useState(false);
  const [editFields, setEditFields] = useState<KycField[]>([]);
  const [configSaving, setConfigSaving] = useState(false);

  // Templates tab
  const [templates, setTemplates] = useState<KycTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateFields, setTemplateFields] = useState<FieldDef[]>([{ id: 'f1', type: 'text', label: '', required: true }]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateBuilderError, setTemplateBuilderError] = useState('');
  const [sendModal, setSendModal] = useState<KycTemplate | null>(null);
  const [sendBidId, setSendBidId] = useState('');
  const [sendEmail, setSendEmail] = useState('');
  const [sendName, setSendName] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  function getHeaders() {
    const token = localStorage.getItem('moongate_token');
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      'Content-Type': 'application/json',
    };
  }

  const loadSubmissions = useCallback(async () => {
    setSubLoading(true);
    setSubError('');
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API_URL}/api/organizer/kyc/submissions${params}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setSubmissions(json.data ?? []);
    } catch {
      setSubError('Failed to load submissions');
    } finally {
      setSubLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, tenantSlug]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc/config`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setFields(json.data?.fields ?? []);
    } catch {
      setConfigError('Failed to load config');
    } finally {
      setConfigLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc-templates`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setTemplates(json.data ?? []);
    } catch {
      setTemplatesError('Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const loadTimeline = useCallback(async (submissionId: string) => {
    setTimelineLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc/submissions/${submissionId}/timeline`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setTimeline(json.data?.timeline ?? []);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const loadFiles = useCallback(async (submissionId: string) => {
    setFilesLoading(true);
    setFilesError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc/submissions/${submissionId}/files`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setFiles(json.data ?? []);
    } catch {
      setFilesError('Failed to load files');
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  useEffect(() => {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return; }
    loadSubmissions();
  }, [loadSubmissions, router]);

  useEffect(() => {
    if (tab === 'config') loadConfig();
    if (tab === 'templates') loadTemplates();
  }, [tab, loadConfig, loadTemplates]);

  function openDrawer(s: Submission) {
    setSelected(s);
    setReviewAction(null);
    setReviewNotes('');
    setNoteContent('');
    setNoteError('');
    setFiles([]);
    setFilesError('');
    loadTimeline(s.id);
    loadFiles(s.id);
  }

  async function submitReview() {
    if (!selected || !reviewAction) return;
    setReviewing(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc/submissions/${selected.id}/review`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: reviewAction, reviewNotes }),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setSelected(json.data ?? null);
      setReviewAction(null);
      setReviewNotes('');
      loadSubmissions();
      if (selected) loadTimeline(selected.id);
    } catch {
      setSubError('Failed to submit review');
    } finally {
      setReviewing(false);
    }
  }

  async function submitNote() {
    if (!selected || !noteContent.trim()) return;
    setAddingNote(true);
    setNoteError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc/submissions/${selected.id}/notes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: noteContent.trim(), isInternal: noteInternal }),
      });
      if (!res.ok) throw new Error('Failed');
      setNoteContent('');
      loadTimeline(selected.id);
    } catch {
      setNoteError('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  }

  function openConfigEdit() {
    setEditFields(fields.map(f => ({ ...f })));
    setEditingConfig(true);
  }

  function addField() {
    setEditFields(prev => [...prev, { key: '', label: '', type: 'text', required: false }]);
  }

  function removeField(i: number) {
    setEditFields(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateField(i: number, updates: Partial<KycField>) {
    setEditFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...updates } : f));
  }

  async function saveConfig() {
    setConfigSaving(true);
    setConfigError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc/config`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ fields: editFields }),
      });
      if (!res.ok) throw new Error('Failed');
      setFields(editFields);
      setEditingConfig(false);
    } catch {
      setConfigError('Failed to save config');
    } finally {
      setConfigSaving(false);
    }
  }

  // Template builder helpers
  function addTemplateField() {
    const newId = `f${Date.now()}`;
    setTemplateFields(prev => [...prev, { id: newId, type: 'text', label: '', required: false }]);
  }

  function removeTemplateField(idx: number) {
    setTemplateFields(prev => prev.filter((_, i) => i !== idx));
  }

  function updateTemplateField(idx: number, updates: Partial<FieldDef>) {
    setTemplateFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  }

  async function saveTemplate() {
    if (!templateName.trim()) { setTemplateBuilderError('Name is required'); return; }
    if (templateFields.length === 0) { setTemplateBuilderError('At least one field is required'); return; }
    if (templateFields.some(f => !f.label.trim())) { setTemplateBuilderError('All fields need a label'); return; }

    setTemplateSaving(true);
    setTemplateBuilderError('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc-templates`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: templateName.trim(), description: templateDesc.trim() || undefined, fields: templateFields }),
      });
      if (!res.ok) throw new Error('Failed');
      setShowTemplateBuilder(false);
      setTemplateName('');
      setTemplateDesc('');
      setTemplateFields([{ id: 'f1', type: 'text', label: '', required: true }]);
      loadTemplates();
    } catch {
      setTemplateBuilderError('Failed to save template');
    } finally {
      setTemplateSaving(false);
    }
  }

  async function deactivateTemplate(id: string) {
    try {
      await fetch(`${API_URL}/api/organizer/kyc-templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      loadTemplates();
    } catch { /* ignore */ }
  }

  async function sendTemplate() {
    if (!sendModal) return;
    if (!sendBidId.trim() || !sendEmail.trim()) { setSendError('Bid ID and email are required'); return; }
    setSending(true);
    setSendError('');
    setSendSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/organizer/kyc-templates/${sendModal.id}/send`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bidId: sendBidId.trim(), sentToEmail: sendEmail.trim(), sentToName: sendName.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setSendSuccess(json.data?.shareUrl ?? 'Sent!');
    } catch {
      setSendError('Failed to send form');
    } finally {
      setSending(false);
    }
  }

  async function downloadFile(submissionId: string, fileAssetId: string, fileName: string) {
    try {
      const res = await fetch(
        `${API_URL}/api/organizer/kyc/submissions/${submissionId}/files/${fileAssetId}/download`,
        { headers: getHeaders() },
      );
      if (!res.ok) throw new Error('Failed');
      // If the response was a redirect we'd get text, otherwise JSON with a URL
      const json = await res.json().catch(() => null);
      const url = json?.data?.url;
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      }
    } catch { /* silently ignore */ }
  }

  function downloadAllFiles(submissionId: string) {
    const token = localStorage.getItem('moongate_token');
    if (!token || !submissionId) return;
    // Use fetch with auth header since we can't set headers on a direct link
    const url = `${API_URL}/api/organizer/kyc/submissions/${submissionId}/files/download-all`;
    setDownloadingAll(true);
    fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug } })
      .then(r => {
        if (!r.ok) throw new Error('Failed');
        return r.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kyc-${submissionId.slice(-8)}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => {/* ignore */})
      .finally(() => setDownloadingAll(false));
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800" style={{ background: '#0a0a12' }}>
          <h1 className="text-xl font-bold text-white mb-1">KYC & Onboarding</h1>
          <p className="text-xs text-gray-400">Manage compliance submissions and configuration</p>
          <div className="flex gap-1 mt-4">
            {(['submissions', 'config', 'templates'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelected(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  tab === t
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {t === 'templates' ? 'Form Templates' : t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {tab === 'submissions' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setStatusFilter('')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    statusFilter === '' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  All
                </button>
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                      statusFilter === s ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {subError && <div className="text-red-400 text-xs">{subError}</div>}

              {subLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] animate-pulse rounded-xl" />)}
                </div>
              ) : submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                  <div className="text-4xl mb-3">🛂</div>
                  <div className="text-sm">No submissions found</div>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500">
                        <th className="text-left px-4 py-3">ID</th>
                        <th className="text-left px-3 py-3">Reference</th>
                        <th className="text-left px-3 py-3">Status</th>
                        <th className="text-left px-3 py-3">Created</th>
                        <th className="text-left px-3 py-3">Reviewed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {submissions.map(s => (
                        <tr
                          key={s.id}
                          onClick={() => openDrawer(s)}
                          className={`cursor-pointer transition-colors ${
                            selected?.id === s.id ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-gray-400">{s.id.slice(0, 8)}</td>
                          <td className="px-3 py-3 text-gray-400">
                            {s.referenceType && s.referenceId
                              ? `${s.referenceType}:${s.referenceId.slice(0, 8)}`
                              : '—'}
                          </td>
                          <td className="px-3 py-3"><StatusChip status={s.status} /></td>
                          <td className="px-3 py-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                          <td className="px-3 py-3 text-gray-500">{s.reviewedBy ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'config' && (
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">KYC Fields Configuration</h2>
                {!editingConfig && (
                  <button
                    onClick={openConfigEdit}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                  >
                    Edit Config
                  </button>
                )}
              </div>

              {configError && <div className="text-red-400 text-xs">{configError}</div>}

              {configLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] animate-pulse rounded-xl" />)}
                </div>
              ) : !editingConfig ? (
                fields.length === 0 ? (
                  <div className="text-gray-500 text-sm">No fields configured. Click Edit Config to add fields.</div>
                ) : (
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-500">
                          <th className="text-left px-4 py-3">Key</th>
                          <th className="text-left px-3 py-3">Label</th>
                          <th className="text-left px-3 py-3">Type</th>
                          <th className="text-left px-3 py-3">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {fields.map((f, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3 font-mono text-gray-400">{f.key}</td>
                            <td className="px-3 py-3 text-gray-300">{f.label}</td>
                            <td className="px-3 py-3 text-gray-400">{f.type}</td>
                            <td className="px-3 py-3">
                              <span className={f.required ? 'text-green-400' : 'text-gray-600'}>
                                {f.required ? 'Yes' : 'No'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  {editFields.map((f, i) => (
                    <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Key</label>
                          <input
                            value={f.key}
                            onChange={e => updateField(i, { key: e.target.value })}
                            placeholder="field_key"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Label</label>
                          <input
                            value={f.label}
                            onChange={e => updateField(i, { label: e.target.value })}
                            placeholder="Display Label"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 items-center">
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Type</label>
                          <select
                            value={f.type}
                            onChange={e => updateField(i, { type: e.target.value as KycField['type'] })}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                          >
                            {['text', 'textarea', 'file', 'select', 'url', 'email'].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <input
                            type="checkbox"
                            id={`req-${i}`}
                            checked={f.required}
                            onChange={e => updateField(i, { required: e.target.checked })}
                            className="accent-indigo-500"
                          />
                          <label htmlFor={`req-${i}`} className="text-xs text-gray-300">Required</label>
                        </div>
                        <button
                          onClick={() => removeField(i)}
                          className="ml-auto mt-4 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addField}
                    className="w-full py-2.5 border border-dashed border-gray-700 text-xs text-gray-500 hover:text-white hover:border-gray-500 rounded-xl transition-colors"
                  >
                    + Add Field
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingConfig(false)}
                      className="px-4 py-2 border border-gray-700 text-xs text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveConfig}
                      disabled={configSaving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      {configSaving ? 'Saving...' : 'Save Config'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'templates' && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Form Templates</h2>
                <button
                  onClick={() => { setShowTemplateBuilder(true); setTemplateBuilderError(''); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                >
                  + New Template
                </button>
              </div>

              {templatesError && <div className="text-red-400 text-xs">{templatesError}</div>}

              {templatesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white/[0.03] animate-pulse rounded-xl" />)}
                </div>
              ) : templates.length === 0 && !showTemplateBuilder ? (
                <div className="text-gray-500 text-sm">No templates yet. Create one to send to sponsors.</div>
              ) : (
                <div className="space-y-3">
                  {templates.map(t => (
                    <div key={t.id} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">{t.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.isActive ? 'text-green-300 bg-green-500/10 border-green-500/30' : 'text-gray-500 bg-gray-800 border-gray-700'}`}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {t.fields?.length ?? 0} field{(t.fields?.length ?? 0) !== 1 ? 's' : ''}{t.description ? ` — ${t.description}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setSendModal(t); setSendBidId(''); setSendEmail(''); setSendName(''); setSendError(''); setSendSuccess(''); }}
                          className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                        >
                          Send to Sponsor
                        </button>
                        {t.isActive && (
                          <button
                            onClick={() => deactivateTemplate(t.id)}
                            className="px-3 py-1.5 text-xs border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/40 rounded-lg transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Template Builder */}
              {showTemplateBuilder && (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">New Template</h3>
                    <button onClick={() => setShowTemplateBuilder(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Name *</label>
                      <input
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="KYC — Identity Verification"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Description</label>
                      <input
                        value={templateDesc}
                        onChange={e => setTemplateDesc(e.target.value)}
                        placeholder="Optional description..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Fields</div>
                    <div className="space-y-2">
                      {templateFields.map((f, idx) => (
                        <div key={f.id} className="bg-gray-800/60 border border-gray-700/60 rounded-lg p-3 space-y-2">
                          <div className="flex gap-3 items-center">
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <input
                                value={f.label}
                                onChange={e => updateTemplateField(idx, { label: e.target.value })}
                                placeholder="Field label"
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              />
                              <select
                                value={f.type}
                                onChange={e => updateTemplateField(idx, { type: e.target.value as FieldDef['type'] })}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              >
                                {['text', 'textarea', 'file', 'select', 'checkbox'].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`tf-req-${idx}`}
                                  checked={f.required}
                                  onChange={e => updateTemplateField(idx, { required: e.target.checked })}
                                  className="accent-indigo-500"
                                />
                                <label htmlFor={`tf-req-${idx}`} className="text-[10px] text-gray-400">Required</label>
                              </div>
                            </div>
                            <button
                              onClick={() => removeTemplateField(idx)}
                              disabled={templateFields.length <= 1}
                              className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-30 transition-colors shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-0.5">Helper note</label>
                              <input
                                value={f.helperNote ?? ''}
                                onChange={e => updateTemplateField(idx, { helperNote: e.target.value || undefined })}
                                placeholder="Short hint shown below the field…"
                                maxLength={500}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-0.5">Example image URL</label>
                              <input
                                value={f.exampleImageUrl ?? ''}
                                onChange={e => updateTemplateField(idx, { exampleImageUrl: e.target.value || undefined })}
                                placeholder="https://…"
                                type="url"
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addTemplateField}
                      className="mt-2 w-full py-2 border border-dashed border-gray-700 text-xs text-gray-500 hover:text-white hover:border-gray-500 rounded-lg transition-colors"
                    >
                      + Add Field
                    </button>
                  </div>

                  {templateBuilderError && <div className="text-red-400 text-xs">{templateBuilderError}</div>}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTemplateBuilder(false)}
                      className="px-4 py-2 border border-gray-700 text-xs text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveTemplate}
                      disabled={templateSaving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      {templateSaving ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drawer (submissions only) */}
      {tab === 'submissions' && (
        selected ? (
          <div className="w-96 border-l border-gray-800 flex flex-col overflow-hidden" style={{ background: '#0d0d14' }}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-400 mb-1">{selected.id.slice(0, 8)}</div>
                <StatusChip status={selected.status} />
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {selected.referenceType && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Reference</div>
                  <div className="text-xs text-gray-300 font-mono">{selected.referenceType}: {selected.referenceId}</div>
                </div>
              )}

              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Created</div>
                <div className="text-xs text-gray-300">{new Date(selected.createdAt).toLocaleString()}</div>
              </div>

              {selected.reviewedBy && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Reviewed By</div>
                  <div className="text-xs text-gray-300">{selected.reviewedBy}</div>
                  {selected.reviewedAt && <div className="text-[10px] text-gray-500">{new Date(selected.reviewedAt).toLocaleString()}</div>}
                </div>
              )}

              {selected.reviewNotes && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Review Notes</div>
                  <div className="text-xs text-gray-300 leading-relaxed">{selected.reviewNotes}</div>
                </div>
              )}

              {selected.data && Object.keys(selected.data).length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Submission Data</div>
                  <div className="space-y-2">
                    {Object.entries(selected.data).map(([k, v]) => (
                      <div key={k}>
                        <div className="text-[10px] text-gray-600">{k}</div>
                        <div className="text-xs text-gray-300 break-all">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files section */}
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">Attached Files</div>
                  {files.some(f => f.asset) && (
                    <button
                      onClick={() => downloadAllFiles(selected.id)}
                      disabled={downloadingAll}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                    >
                      {downloadingAll ? 'Preparing...' : 'Download All'}
                    </button>
                  )}
                </div>

                {filesLoading ? (
                  <div className="space-y-1.5">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-10 bg-white/[0.03] animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filesError ? (
                  <div className="text-[10px] text-red-400">{filesError}</div>
                ) : files.length === 0 ? (
                  <div className="text-[10px] text-gray-600">No file fields in this submission</div>
                ) : (
                  <div className="space-y-1.5">
                    {files.map(f => (
                      <div
                        key={f.fieldKey}
                        className="bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2 flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 truncate">{f.fieldLabel}</div>
                          {f.asset ? (
                            <>
                              <div className="text-xs text-gray-300 truncate">{f.asset.originalName}</div>
                              <div className="text-[10px] text-gray-600">
                                {f.asset.mimeType} &middot; {(f.asset.sizeBytes / 1024).toFixed(1)} KB
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-600 italic">No file uploaded</div>
                          )}
                        </div>
                        {f.asset && (
                          <button
                            onClick={() => downloadFile(selected.id, f.asset!.id, f.asset!.originalName)}
                            className="shrink-0 text-[10px] px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-md transition-colors"
                          >
                            Download
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Review actions */}
              <div className="pt-2 border-t border-gray-800 space-y-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">Review Action</div>
                <div className="flex gap-2">
                  {(['approved', 'needs_more_info', 'rejected'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setReviewAction(a)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                        reviewAction === a
                          ? a === 'approved' ? 'bg-green-500/20 text-green-300 border-green-500/40'
                          : a === 'rejected' ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'border-gray-700 text-gray-500 hover:text-white'
                      }`}
                    >
                      {a === 'approved' ? 'Approve' : a === 'needs_more_info' ? 'Needs Info' : 'Reject'}
                    </button>
                  ))}
                </div>

                {reviewAction && (
                  <>
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Notes</label>
                      <textarea
                        value={reviewNotes}
                        onChange={e => setReviewNotes(e.target.value)}
                        rows={3}
                        placeholder="Add review notes..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={submitReview}
                      disabled={reviewing}
                      className={`w-full py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                        reviewAction === 'approved' ? 'bg-green-600 hover:bg-green-500'
                        : reviewAction === 'rejected' ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-amber-600 hover:bg-amber-500'
                      }`}
                    >
                      {reviewing ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </>
                )}
              </div>

              {/* Timeline */}
              <div className="pt-2 border-t border-gray-800 space-y-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">Timeline</div>

                {timelineLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-white/[0.03] animate-pulse rounded-lg" />)}
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="text-[10px] text-gray-600">No activity yet</div>
                ) : (
                  <div className="space-y-2 relative">
                    {/* vertical line */}
                    <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-800" />
                    {timeline.map((item) => (
                      <div key={item.id} className="pl-6 relative">
                        <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border border-gray-700 bg-gray-900" />
                        <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center gap-2">
                            {item.type === 'note' ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border text-gray-300 bg-gray-700/50 border-gray-600">Note</span>
                            ) : (
                              <ActionBadge action={item.type === 'audit' ? item.action : 'note_added'} />
                            )}
                            <span className="text-[10px] text-gray-500 ml-auto">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {item.type === 'note' ? item.authorName : item.actorName}
                          </div>
                          {item.type === 'note' && (
                            <>
                              <div className="text-xs text-gray-200 leading-relaxed">{item.content}</div>
                              {item.isInternal && (
                                <div className="text-[10px] text-indigo-400/70">Internal note</div>
                              )}
                            </>
                          )}
                          {item.type === 'audit' && (
                            <>
                              {item.fromStatus && item.toStatus && (
                                <div className="text-[10px] text-gray-400">
                                  <span className="text-gray-500">{item.fromStatus}</span>
                                  <span className="mx-1 text-gray-600">→</span>
                                  <span className="text-gray-300">{item.toStatus}</span>
                                </div>
                              )}
                              {item.reason && (
                                <div className="text-xs text-gray-300 leading-relaxed">{item.reason}</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add note form */}
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">Add Note</div>
                  <textarea
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    rows={3}
                    placeholder="Write a note..."
                    maxLength={2000}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="note-internal"
                        checked={noteInternal}
                        onChange={e => setNoteInternal(e.target.checked)}
                        className="accent-indigo-500"
                      />
                      <label htmlFor="note-internal" className="text-[10px] text-gray-400">Internal note</label>
                    </div>
                    <button
                      onClick={submitNote}
                      disabled={addingNote || !noteContent.trim()}
                      className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {addingNote ? 'Adding...' : 'Add Note'}
                    </button>
                  </div>
                  {noteError && <div className="text-red-400 text-[10px]">{noteError}</div>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-96 border-l border-gray-800 flex items-center justify-center" style={{ background: '#0d0d14' }}>
            <p className="text-xs text-gray-600">Select a submission</p>
          </div>
        )
      )}

      {/* Send to Sponsor Modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Send Form to Sponsor</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{sendModal.name}</p>
              </div>
              <button onClick={() => setSendModal(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {sendSuccess ? (
              <div className="space-y-3">
                <div className="text-xs text-green-400">Form request created successfully!</div>
                <div className="bg-gray-800 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500 mb-1">Share URL</div>
                  <div className="text-xs text-indigo-300 break-all font-mono">{sendSuccess}</div>
                </div>
                <button
                  onClick={() => { setSendModal(null); setSendSuccess(''); }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Bid ID *</label>
                    <input
                      value={sendBidId}
                      onChange={e => setSendBidId(e.target.value)}
                      placeholder="bid_..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Sponsor Email *</label>
                    <input
                      type="email"
                      value={sendEmail}
                      onChange={e => setSendEmail(e.target.value)}
                      placeholder="sponsor@company.com"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Sponsor Name</label>
                    <input
                      value={sendName}
                      onChange={e => setSendName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {sendError && <div className="text-red-400 text-xs">{sendError}</div>}

                <div className="flex gap-2">
                  <button
                    onClick={() => setSendModal(null)}
                    className="flex-1 py-2 border border-gray-700 text-xs text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendTemplate}
                    disabled={sending}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Form'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
