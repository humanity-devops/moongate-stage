'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────
type Suggestion = {
  id: string;
  type: string;
  confidence: number;
  status: string;
  suggestedData: Record<string, unknown>;
  sourcePageNumbers?: number[];
};

type ExtractionJob = {
  id: string;
  status: string;
  errorMessage?: string | null;
  completedAt?: string | null;
  createdAt: string;
  aiProvider?: string | null;
  suggestions?: Suggestion[];
};

type Deck = {
  id: string;
  name: string;
  status: string;
  pageCount?: number | null;
  createdAt: string;
  extractionJobs: ExtractionJob[];
};

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  event_meta: { label: 'Event Info', color: '#7b93f8', order: 0 },
  stats:       { label: 'Audience Stats', color: '#4ade80', order: 1 },
  sponsor_item: { label: 'Sponsor Package', color: '#c9a227', order: 2 },
  upgrade:     { label: 'Upgrade', color: '#fb923c', order: 3 },
  add_on:      { label: 'Add-On', color: '#a78bfa', order: 4 },
  contact:     { label: 'Contact', color: '#67e8f9', order: 5 },
};

const DECK_STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  pending:    { label: 'Pending',    dot: '#6b7280' },
  processing: { label: 'Processing', dot: '#fbbf24' },
  completed:  { label: 'Completed',  dot: '#4ade80' },
  failed:     { label: 'Failed',     dot: '#f87171' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? '#4ade80' : pct >= 70 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[10px]" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DecksPage() {
  const { tenantSlug, eventId } = useParams() as { tenantSlug: string; eventId: string };
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  // List state
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review state
  const [reviewDeck, setReviewDeck] = useState<Deck | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  function getToken() {
    const token = localStorage.getItem('moongate_token');
    if (!token) { router.push('/auth/login'); return null; }
    return token;
  }

  function headers(token: string, extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': tenantSlug, ...extra };
  }

  // ── Load deck list ──────────────────────────────────────────────────────────
  const loadDecks = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/decks`, {
        headers: headers(token),
      });
      if (res.ok) {
        const data = await res.json();
        setDecks(data.data ?? []);
      }
    } finally {
      setDecksLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, tenantSlug]);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  // ── Select a deck & load suggestions ───────────────────────────────────────
  async function selectDeck(deckId: string) {
    setSelectedDeckId(deckId);
    setShowUpload(false);
    setReviewLoading(true);
    setBulkSelected(new Set());
    setActiveTab('all');

    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/decks/${deckId}/suggestions`, {
        headers: headers(token),
      });
      if (res.ok) {
        const data = await res.json();
        setReviewDeck(data.data);
        // If still processing, start polling
        const job = data.data?.extractionJobs?.[0];
        if (job?.status === 'pending' || job?.status === 'processing') {
          startPolling(deckId);
        }
      }
    } finally {
      setReviewLoading(false);
    }
  }

  // ── Polling for job completion ──────────────────────────────────────────────
  function startPolling(deckId: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const token = getToken();
      if (!token) { clearInterval(pollingRef.current!); return; }
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/decks/${deckId}/suggestions`, {
        headers: headers(token),
      });
      if (res.ok) {
        const data = await res.json();
        const deck = data.data as Deck;
        setReviewDeck(deck);
        setDecks(prev => prev.map(d => d.id === deckId ? { ...d, status: deck.status, extractionJobs: deck.extractionJobs } : d));
        const job = deck.extractionJobs?.[0];
        if (job?.status !== 'pending' && job?.status !== 'processing') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        }
      }
    }, 2000);
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // ── File upload ─────────────────────────────────────────────────────────────
  function handleFileChange(file: File | null) {
    if (!file) return;
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadError('Only PDF files are accepted.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File must be under 50MB.');
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    if (!deckName.trim()) setDeckName(file.name.replace(/\.pdf$/i, ''));
  }

  async function handleUpload() {
    const token = getToken();
    if (!token || !deckName.trim()) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('name', deckName.trim());
      if (selectedFile) formData.append('file', selectedFile);

      setUploadProgress(30);

      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/decks`, {
        method: 'POST',
        // For multipart, don't set Content-Type — browser sets it with boundary
        // For JSON (no file), set Content-Type manually
        headers: selectedFile ? headers(token) : headers(token, { 'Content-Type': 'application/json' }),
        body: selectedFile ? formData : JSON.stringify({ name: deckName.trim() }),
      });

      setUploadProgress(80);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message ?? 'Upload failed');
      }

      setUploadProgress(100);
      const newDeck = data.data as Deck;

      // Add to list and select
      setDecks(prev => [{ ...newDeck, extractionJobs: [{ id: 'new', status: 'pending', createdAt: newDeck.createdAt }] }, ...prev]);
      setShowUpload(false);
      setDeckName('');
      setSelectedFile(null);

      // Select the new deck
      await selectDeck(newDeck.id);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  // ── Mock demo upload (no file) ──────────────────────────────────────────────
  async function handleDemoUpload() {
    const token = getToken();
    if (!token || !deckName.trim()) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(20);

    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/decks`, {
        method: 'POST',
        headers: headers(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: deckName.trim() }),
      });
      setUploadProgress(60);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? 'Failed');
      setUploadProgress(100);
      const newDeck = data.data as Deck;
      setDecks(prev => [{ ...newDeck, extractionJobs: [{ id: 'new', status: 'pending', createdAt: newDeck.createdAt }] }, ...prev]);
      setShowUpload(false);
      setDeckName('');
      await selectDeck(newDeck.id);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  // ── Review actions ──────────────────────────────────────────────────────────
  async function reviewSuggestion(suggestionId: string, status: 'accepted' | 'rejected') {
    const token = getToken();
    if (!token || !reviewDeck) return;
    setUpdating(suggestionId);
    try {
      await fetch(`${API_URL}/api/organizer/events/${eventId}/decks/${reviewDeck.id}/suggestions/${suggestionId}`, {
        method: 'PATCH',
        headers: headers(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status }),
      });
      setReviewDeck(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          extractionJobs: prev.extractionJobs.map(job => ({
            ...job,
            suggestions: job.suggestions?.map(s => s.id === suggestionId ? { ...s, status } : s),
          })),
        };
      });
      if (status === 'accepted') {
        setBulkSelected(prev => new Set(Array.from(prev).concat(suggestionId)));
      } else {
        setBulkSelected(prev => { const n = new Set(Array.from(prev)); n.delete(suggestionId); return n; });
      }
    } finally {
      setUpdating(null);
    }
  }

  async function updateSuggestionData(suggestionId: string, suggestedData: Record<string, unknown>) {
    const token = getToken();
    if (!token || !reviewDeck) return;
    setUpdating(suggestionId);
    try {
      await fetch(`${API_URL}/api/organizer/events/${eventId}/decks/${reviewDeck.id}/suggestions/${suggestionId}`, {
        method: 'PATCH',
        headers: headers(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ suggestedData }),
      });
      setReviewDeck(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          extractionJobs: prev.extractionJobs.map(job => ({
            ...job,
            suggestions: job.suggestions?.map(s => s.id === suggestionId ? { ...s, suggestedData } : s),
          })),
        };
      });
    } finally {
      setUpdating(null);
    }
  }

  async function bulkCreateItems() {
    const token = getToken();
    if (!token || !reviewDeck || bulkSelected.size === 0) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/decks/${reviewDeck.id}/suggestions/bulk-create-items`, {
        method: 'POST',
        headers: headers(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ suggestionIds: Array.from(bulkSelected) }),
      });
      const data = await res.json();
      if (data.data?.created > 0) {
        router.push(`/admin/${tenantSlug}/events/${eventId}/items`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function reExtract() {
    const token = getToken();
    if (!token || !reviewDeck) return;
    await fetch(`${API_URL}/api/organizer/events/${eventId}/decks/${reviewDeck.id}/re-extract`, {
      method: 'POST',
      headers: headers(token, { 'Content-Type': 'application/json' }),
    });
    setReviewDeck(prev => prev ? {
      ...prev,
      status: 'pending',
      extractionJobs: [{ id: 'polling', status: 'pending', createdAt: new Date().toISOString() }, ...(prev.extractionJobs ?? [])],
    } : prev);
    startPolling(reviewDeck.id);
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const suggestions = reviewDeck?.extractionJobs?.[0]?.suggestions ?? [];
  const jobStatus = reviewDeck?.extractionJobs?.[0]?.status ?? 'pending';
  const isProcessing = jobStatus === 'pending' || jobStatus === 'processing';
  const isFailed = jobStatus === 'failed';

  const acceptedCount = suggestions.filter(s => s.status === 'accepted').length;
  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  const allTypes = Array.from(new Set(suggestions.map(s => s.type))).sort(
    (a, b) => (TYPE_CONFIG[a]?.order ?? 99) - (TYPE_CONFIG[b]?.order ?? 99),
  );

  const filteredSuggestions = activeTab === 'all'
    ? suggestions
    : suggestions.filter(s => s.type === activeTab);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#06060a', color: 'white' }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="flex h-screen overflow-hidden">

        {/* ── Left Sidebar ── */}
        <aside className="w-72 flex-shrink-0 flex flex-col" style={{ background: '#0d0d14', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Header */}
          <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <nav className="font-mono text-[10px] tracking-widest uppercase mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <Link href={`/admin/${tenantSlug}/events`} className="hover:text-white transition-colors">Events</Link>
              <span className="mx-2 opacity-40">/</span>
              <Link href={`/admin/${tenantSlug}/events/${eventId}`} className="hover:text-white transition-colors">Dashboard</Link>
            </nav>
            <h1 className="font-display text-lg font-bold text-white">AI Extraction</h1>
            <p className="font-sans text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Upload a sponsorship PDF to extract packages
            </p>
          </div>

          {/* Upload button */}
          <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => { setShowUpload(true); setSelectedDeckId(null); setReviewDeck(null); }}
              className="w-full py-2.5 font-mono text-[11px] tracking-widest uppercase font-semibold transition-all"
              style={{
                background: showUpload ? 'rgba(67,97,238,0.2)' : 'rgba(67,97,238,0.12)',
                border: '1px solid rgba(67,97,238,0.3)',
                color: '#7b93f8',
              }}
            >
              + Upload Deck
            </button>
          </div>

          {/* Deck list */}
          <div className="flex-1 overflow-y-auto">
            {decksLoading ? (
              <div className="p-5 font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Loading...
              </div>
            ) : decks.length === 0 ? (
              <div className="p-5 text-center">
                <p className="font-sans text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  No decks uploaded yet.
                </p>
              </div>
            ) : (
              decks.map(deck => {
                const cfg = DECK_STATUS_CONFIG[deck.status] ?? DECK_STATUS_CONFIG.pending;
                const isSelected = selectedDeckId === deck.id;
                return (
                  <button
                    key={deck.id}
                    onClick={() => selectDeck(deck.id)}
                    className="w-full text-left px-4 py-3.5 transition-all"
                    style={{
                      background: isSelected ? 'rgba(67,97,238,0.1)' : 'transparent',
                      borderLeft: isSelected ? '2px solid #4361ee' : '2px solid transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-sans text-sm font-medium text-white truncate pr-2">
                        {deck.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                        <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: cfg.dot }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {fmtDate(deck.createdAt)}
                      {deck.pageCount ? ` · ${deck.pageCount}pp` : ''}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Main Area ── */}
        <main className="flex-1 overflow-y-auto">

          {/* ── Upload Panel ── */}
          {showUpload && (
            <UploadPanel
              deckName={deckName}
              onDeckNameChange={setDeckName}
              selectedFile={selectedFile}
              onFileChange={handleFileChange}
              dragOver={dragOver}
              onDragOver={setDragOver}
              uploading={uploading}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              onUpload={handleUpload}
              onDemoUpload={handleDemoUpload}
              fileInputRef={fileInputRef}
            />
          )}

          {/* ── No selection ── */}
          {!showUpload && !selectedDeckId && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm">
                <div className="mb-6" style={{ fontSize: '3rem' }}>📄</div>
                <h2 className="font-display text-2xl font-bold text-white mb-3">Upload a Sponsorship Deck</h2>
                <p className="font-sans text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Upload your PDF sponsorship deck and AI will extract structured package suggestions for your review.
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="px-8 py-3 font-mono text-[11px] tracking-widest uppercase font-semibold transition-all"
                  style={{
                    background: '#4361ee',
                    color: 'white',
                    clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                  }}
                >
                  Upload PDF
                </button>
              </div>
            </div>
          )}

          {/* ── Review loading ── */}
          {selectedDeckId && reviewLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
            </div>
          )}

          {/* ── Processing state ── */}
          {selectedDeckId && !reviewLoading && reviewDeck && isProcessing && (
            <ProcessingPanel deck={reviewDeck} />
          )}

          {/* ── Failed state ── */}
          {selectedDeckId && !reviewLoading && reviewDeck && isFailed && (
            <FailedPanel
              deck={reviewDeck}
              onReExtract={reExtract}
            />
          )}

          {/* ── Review state ── */}
          {selectedDeckId && !reviewLoading && reviewDeck && !isProcessing && !isFailed && (
            <ReviewPanel
              deck={reviewDeck}
              suggestions={suggestions}
              filteredSuggestions={filteredSuggestions}
              allTypes={allTypes}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              acceptedCount={acceptedCount}
              pendingCount={pendingCount}
              bulkSelected={bulkSelected}
              updating={updating}
              creating={creating}
              onReview={reviewSuggestion}
              onUpdateData={updateSuggestionData}
              onBulkCreate={bulkCreateItems}
              onReExtract={reExtract}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ── Upload Panel Component ─────────────────────────────────────────────────────
function UploadPanel({
  deckName, onDeckNameChange, selectedFile, onFileChange,
  dragOver, onDragOver, uploading, uploadProgress, uploadError,
  onUpload, onDemoUpload, fileInputRef,
}: {
  deckName: string;
  onDeckNameChange: (v: string) => void;
  selectedFile: File | null;
  onFileChange: (f: File | null) => void;
  dragOver: boolean;
  onDragOver: (v: boolean) => void;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  onUpload: () => void;
  onDemoUpload: () => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
  };

  return (
    <div className="max-w-2xl mx-auto p-10">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold text-white mb-2">Upload Sponsorship Deck</h2>
        <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Upload a PDF and AI will extract structured sponsorship packages, stats, and contact info.
        </p>
      </div>

      <div className="space-y-5">
        {/* Deck name */}
        <div>
          <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Deck Name *
          </label>
          <input
            type="text"
            value={deckName}
            onChange={e => onDeckNameChange(e.target.value)}
            placeholder="e.g. ETHMilan 2025 Sponsorship Deck"
            className="w-full px-4 py-3 font-sans text-sm outline-none transition-colors"
            style={inputStyle}
          />
        </div>

        {/* Drop zone */}
        <div>
          <label className="block font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            PDF File
          </label>
          <div
            className="relative p-8 text-center cursor-pointer transition-all"
            style={{
              border: dragOver
                ? '2px dashed rgba(67,97,238,0.6)'
                : selectedFile
                ? '2px dashed rgba(74,222,128,0.4)'
                : '2px dashed rgba(255,255,255,0.1)',
              background: dragOver
                ? 'rgba(67,97,238,0.06)'
                : selectedFile
                ? 'rgba(74,222,128,0.04)'
                : 'rgba(255,255,255,0.02)',
            }}
            onDragEnter={e => { e.preventDefault(); onDragOver(true); }}
            onDragOver={e => { e.preventDefault(); onDragOver(true); }}
            onDragLeave={() => onDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              onDragOver(false);
              onFileChange(e.dataTransfer.files[0] ?? null);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => onFileChange(e.target.files?.[0] ?? null)}
            />
            {selectedFile ? (
              <div>
                <div className="font-mono text-2xl mb-2">✓</div>
                <p className="font-sans text-sm font-semibold" style={{ color: '#4ade80' }}>{selectedFile.name}</p>
                <p className="font-mono text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div>
                <div className="font-mono text-3xl mb-3 opacity-30">PDF</div>
                <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Drag & drop your PDF or <span style={{ color: '#7b93f8' }}>browse</span>
                </p>
                <p className="font-mono text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  PDF files up to 50MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload progress */}
        {uploading && (
          <div>
            <div className="flex justify-between font-mono text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, background: '#4361ee' }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <p className="font-sans text-sm" style={{ color: 'rgba(252,165,165,0.8)' }}>{uploadError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onUpload}
            disabled={uploading || !deckName.trim() || !selectedFile}
            className="flex-1 py-3.5 font-mono text-[11px] tracking-widest uppercase font-semibold transition-all disabled:opacity-40"
            style={{
              background: '#4361ee',
              color: 'white',
              clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
              cursor: uploading || !deckName.trim() || !selectedFile ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading...' : 'Upload & Extract'}
          </button>
        </div>

        {/* Demo divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>

        <div className="p-4" style={{ background: 'rgba(67,97,238,0.06)', border: '1px solid rgba(67,97,238,0.15)' }}>
          <p className="font-mono text-[10px] tracking-widest uppercase mb-2" style={{ color: 'rgba(123,147,248,0.7)' }}>
            Demo Mode
          </p>
          <p className="font-sans text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No PDF? Run a mock extraction with sample ETHMilan 2025 data to explore the workflow.
          </p>
          <button
            onClick={onDemoUpload}
            disabled={uploading || !deckName.trim()}
            className="w-full py-2.5 font-mono text-[11px] tracking-widest uppercase font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'rgba(67,97,238,0.15)',
              border: '1px solid rgba(67,97,238,0.3)',
              color: '#7b93f8',
              cursor: uploading || !deckName.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Run Demo Extraction
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Processing Panel ───────────────────────────────────────────────────────────
const PROCESSING_STAGES = [
  { minS: 0,  label: 'PDF uploaded and queued for extraction',     detail: 'File saved to storage' },
  { minS: 2,  label: 'Parsing document text',                      detail: 'Extracting readable content from PDF pages' },
  { minS: 7,  label: 'Sending to AI for analysis',                 detail: 'Transmitting deck text to Claude' },
  { minS: 14, label: 'AI is extracting sponsorship packages',      detail: 'Identifying tiers, pricing, benefits, and add-ons' },
  { minS: 35, label: 'AI is finalising the extraction',            detail: 'Compiling contact info and audience stats' },
];

function ProcessingPanel({ deck }: { deck: Deck }) {
  const [elapsed, setElapsed] = useState(0);
  const job = deck.extractionJobs?.[0];
  const startRef = useRef(job?.createdAt ? new Date(job.createdAt).getTime() : Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, []);

  const stage = [...PROCESSING_STAGES].reverse().find(s => elapsed >= s.minS) ?? PROCESSING_STAGES[0];

  return (
    <div className="max-w-2xl mx-auto p-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative w-10 h-10 flex-shrink-0">
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{ border: '2px solid rgba(67,97,238,0.15)', borderTopColor: '#4361ee' }}
          />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold text-white">{deck.name}</h3>
          <p className="font-mono text-[10px] tracking-widest uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {elapsed}s elapsed
          </p>
        </div>
      </div>

      {/* Stage log */}
      <div className="space-y-0" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Extraction Log
          </span>
        </div>
        {PROCESSING_STAGES.map((s, i) => {
          const done = elapsed > s.minS && s !== stage;
          const active = s === stage;
          const pending = !done && !active;
          return (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < PROCESSING_STAGES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined, opacity: pending ? 0.3 : 1 }}
            >
              <div className="flex-shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center">
                {done && <span className="font-mono text-[10px]" style={{ color: '#4ade80' }}>✓</span>}
                {active && (
                  <div className="w-2 h-2 rounded-full" style={{ background: '#7b93f8', boxShadow: '0 0 6px #7b93f8', animation: 'pulse 1s ease infinite' }} />
                )}
                {pending && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />}
              </div>
              <div>
                <p className="font-mono text-xs" style={{ color: done ? '#4ade80' : active ? 'white' : 'rgba(255,255,255,0.4)' }}>
                  {s.label}
                </p>
                {(done || active) && (
                  <p className="font-sans text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{s.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Skeleton rows hinting at upcoming results */}
      <div className="mt-6">
        <p className="font-mono text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Extracted suggestions will appear here
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex gap-3">
                <div className="h-4 rounded" style={{ width: `${60 + i * 15}px`, background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-4 rounded flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Failed Panel ───────────────────────────────────────────────────────────────
function FailedPanel({ deck, onReExtract }: { deck: Deck; onReExtract: () => void }) {
  const job = deck.extractionJobs?.[0];
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">⚠️</div>
        <h3 className="font-display text-2xl font-bold text-white mb-2">{deck.name}</h3>
        <p className="font-sans text-sm mb-2" style={{ color: 'rgba(252,165,165,0.8)' }}>
          Extraction failed
        </p>
        {job?.errorMessage && (
          <p className="font-mono text-xs mb-6 p-3" style={{ background: 'rgba(252,165,165,0.06)', border: '1px solid rgba(252,165,165,0.15)', color: 'rgba(252,165,165,0.6)' }}>
            {job.errorMessage}
          </p>
        )}
        <button
          onClick={onReExtract}
          className="px-6 py-2.5 font-mono text-[11px] tracking-widest uppercase font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
        >
          Retry Extraction
        </button>
      </div>
    </div>
  );
}

// ── Review Panel ───────────────────────────────────────────────────────────────
function ReviewPanel({
  deck, suggestions, filteredSuggestions, allTypes, activeTab, onTabChange,
  acceptedCount, pendingCount, bulkSelected, updating, creating,
  onReview, onUpdateData, onBulkCreate, onReExtract,
}: {
  deck: Deck;
  suggestions: Suggestion[];
  filteredSuggestions: Suggestion[];
  allTypes: string[];
  activeTab: string;
  onTabChange: (t: string) => void;
  acceptedCount: number;
  pendingCount: number;
  bulkSelected: Set<string>;
  updating: string | null;
  creating: boolean;
  onReview: (id: string, status: 'accepted' | 'rejected') => void;
  onUpdateData: (id: string, data: Record<string, unknown>) => void;
  onBulkCreate: () => void;
  onReExtract: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Review header */}
      <div className="px-8 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-white">{deck.name}</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: '#4ade80' }}>
                {acceptedCount} accepted
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {pendingCount} pending
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {suggestions.length} total
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onReExtract}
              className="px-4 py-2 font-mono text-[10px] tracking-widest uppercase transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
            >
              Re-extract
            </button>
            {acceptedCount > 0 && (
              <button
                onClick={onBulkCreate}
                disabled={creating}
                className="px-5 py-2 font-mono text-[10px] tracking-widest uppercase font-semibold transition-all disabled:opacity-50"
                style={{
                  background: '#4361ee',
                  color: 'white',
                  clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                }}
              >
                {creating ? 'Creating...' : `Create ${acceptedCount} Items`}
              </button>
            )}
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto">
          <TabButton active={activeTab === 'all'} onClick={() => onTabChange('all')} color="rgba(255,255,255,0.5)">
            All ({suggestions.length})
          </TabButton>
          {allTypes.map(type => {
            const cfg = TYPE_CONFIG[type];
            const count = suggestions.filter(s => s.type === type).length;
            return (
              <TabButton key={type} active={activeTab === type} onClick={() => onTabChange(type)} color={cfg?.color ?? '#fff'}>
                {cfg?.label ?? type} ({count})
              </TabButton>
            );
          })}
        </div>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-8 space-y-3">
        {filteredSuggestions.length === 0 && (
          <div className="text-center py-16">
            <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No suggestions in this category.</p>
          </div>
        )}
        {filteredSuggestions.map((suggestion, idx) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            index={idx}
            updating={updating === suggestion.id}
            onReview={onReview}
            onUpdateData={onUpdateData}
          />
        ))}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, color, children }: {
  active: boolean; onClick: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase whitespace-nowrap transition-all flex-shrink-0"
      style={{
        background: active ? 'rgba(67,97,238,0.15)' : 'transparent',
        border: active ? '1px solid rgba(67,97,238,0.3)' : '1px solid transparent',
        color: active ? color : 'rgba(255,255,255,0.3)',
      }}
    >
      {children}
    </button>
  );
}

// ── Suggestion Card ────────────────────────────────────────────────────────────
const EDITABLE_TYPES = new Set(['sponsor_item', 'add_on']);
const EDITABLE_FIELDS = ['publicTitle', 'listPrice', 'quantityTotal', 'visibleToPublic'];

function SuggestionCard({
  suggestion, index, updating, onReview, onUpdateData,
}: {
  suggestion: Suggestion;
  index: number;
  updating: boolean;
  onReview: (id: string, status: 'accepted' | 'rejected') => void;
  onUpdateData: (id: string, data: Record<string, unknown>) => void;
}) {
  const cfg = TYPE_CONFIG[suggestion.type] ?? { label: suggestion.type, color: '#fff', order: 99 };
  const isAccepted = suggestion.status === 'accepted';
  const isRejected = suggestion.status === 'rejected';
  const canEdit = EDITABLE_TYPES.has(suggestion.type);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  function startEdit() {
    setEditData({ ...suggestion.suggestedData });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditData({});
  }

  function saveEdit() {
    onUpdateData(suggestion.id, { ...suggestion.suggestedData, ...editData });
    setEditing(false);
    setEditData({});
  }

  const dataEntries = Object.entries(suggestion.suggestedData).filter(
    ([k]) => !['benefits'].includes(k),
  );
  const benefits = Array.isArray(suggestion.suggestedData.benefits)
    ? suggestion.suggestedData.benefits as Record<string, unknown>[]
    : [];

  const inputStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(123,147,248,0.4)',
    color: 'white',
    outline: 'none',
    width: '100%',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: 'inherit',
  };

  return (
    <div
      className="p-5 transition-all"
      style={{
        background: isAccepted
          ? 'rgba(74,222,128,0.04)'
          : isRejected
          ? 'rgba(255,255,255,0.01)'
          : 'rgba(255,255,255,0.03)',
        border: isAccepted
          ? '1px solid rgba(74,222,128,0.2)'
          : isRejected
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.07)',
        animation: isRejected ? undefined : `fadeInUp 0.35s ease both`,
        animationDelay: isRejected ? undefined : `${Math.min(index * 60, 600)}ms`,
        opacity: isRejected ? 0.45 : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span
              className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5"
              style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}25` }}
            >
              {cfg.label}
            </span>
            <ConfidenceBar value={suggestion.confidence} />
            {suggestion.sourcePageNumbers && suggestion.sourcePageNumbers.length > 0 && (
              <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                p.{suggestion.sourcePageNumbers.join(', ')}
              </span>
            )}
            {canEdit && !isRejected && !editing && (
              <button
                onClick={startEdit}
                className="font-mono text-[9px] tracking-widest uppercase transition-all ml-auto"
                style={{ color: 'rgba(123,147,248,0.6)', border: '1px solid rgba(123,147,248,0.2)', padding: '2px 8px' }}
              >
                Edit
              </button>
            )}
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="space-y-2 mb-3">
              {EDITABLE_FIELDS.map(field => {
                const val = editData[field] ?? suggestion.suggestedData[field];
                const label = field.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
                if (field === 'visibleToPublic') {
                  return (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editData[field] ?? suggestion.suggestedData[field])}
                        onChange={e => setEditData(d => ({ ...d, [field]: e.target.checked }))}
                        style={{ accentColor: '#7b93f8', width: '14px', height: '14px' }}
                      />
                      <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Visible to public
                      </span>
                    </label>
                  );
                }
                return (
                  <div key={field}>
                    <div className="font-mono text-[9px] tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {label}
                    </div>
                    <input
                      type={field === 'listPrice' || field === 'quantityTotal' ? 'number' : 'text'}
                      value={String(editData[field] ?? val ?? '')}
                      onChange={e => setEditData(d => ({
                        ...d,
                        [field]: (field === 'listPrice' || field === 'quantityTotal') ? Number(e.target.value) : e.target.value,
                      }))}
                      style={inputStyle}
                    />
                  </div>
                );
              })}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={saveEdit}
                  disabled={updating}
                  className="px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(123,147,248,0.15)', border: '1px solid rgba(123,147,248,0.4)', color: '#7b93f8' }}
                >
                  {updating ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Data grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {dataEntries.map(([key, value]) => (
                  <div key={key} className="p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="font-mono text-[9px] tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                    </div>
                    <div className="font-sans text-xs text-white font-medium truncate">
                      {Array.isArray(value)
                        ? (value as string[]).join(', ')
                        : typeof value === 'number' && key.toLowerCase().includes('price')
                        ? `$${value.toLocaleString()}`
                        : typeof value === 'boolean'
                        ? (value ? 'Yes' : 'No')
                        : String(value ?? '—')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Benefits */}
              {benefits.length > 0 && (
                <div className="mt-3">
                  <p className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>Benefits</p>
                  <div className="flex flex-wrap gap-1.5">
                    {benefits.map((b, i) => (
                      <span
                        key={i}
                        className="font-mono text-[10px] px-2.5 py-1"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                      >
                        {b.label as string}{b.value ? `: ${b.value}` : ''}{b.quantity ? ` ×${b.quantity}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          {suggestion.status === 'pending' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onReview(suggestion.id, 'accepted')}
                disabled={updating || editing}
                className="px-4 py-2 font-mono text-[10px] tracking-widest uppercase font-semibold transition-all disabled:opacity-50"
                style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
              >
                Accept
              </button>
              <button
                onClick={() => onReview(suggestion.id, 'rejected')}
                disabled={updating || editing}
                className="px-4 py-2 font-mono text-[10px] tracking-widest uppercase font-semibold transition-all disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
              >
                Reject
              </button>
            </div>
          )}
          {isAccepted && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px]" style={{ color: '#4ade80' }}>✓ Accepted</span>
              <button
                onClick={() => onReview(suggestion.id, 'rejected')}
                className="font-mono text-[9px] tracking-widest uppercase transition-colors"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                Undo
              </button>
            </div>
          )}
          {isRejected && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>✗ Rejected</span>
              <button
                onClick={() => onReview(suggestion.id, 'accepted')}
                className="font-mono text-[9px] tracking-widest uppercase transition-colors"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                Undo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
