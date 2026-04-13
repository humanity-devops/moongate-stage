'use client';

import { useState, useCallback } from 'react';
import { PackageBuilder, type PackageItem } from './PackageBuilder';
import { track } from '@/lib/track';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ProposalWizardProps {
  tenantSlug: string;
  eventSlug: string;
  eventName: string;
}

type Step = 'contact' | 'builder' | 'review' | 'submitted';

interface ContactInfo {
  contactName: string;
  contactEmail: string;
  companyName: string;
  notes: string;
}

const DRAFT_KEY = (t: string, e: string) => `mg_proposal_draft_${t}_${e}`;

function loadDraft(tenantSlug: string, eventSlug: string): Partial<ContactInfo & { items: PackageItem[] }> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(tenantSlug, eventSlug));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDraft(tenantSlug: string, eventSlug: string, data: object) {
  try {
    localStorage.setItem(DRAFT_KEY(tenantSlug, eventSlug), JSON.stringify(data));
  } catch { /* ignore */ }
}

export function ProposalWizard({ tenantSlug, eventSlug, eventName }: ProposalWizardProps) {
  const draft = loadDraft(tenantSlug, eventSlug);

  const [step, setStep] = useState<Step>('contact');
  const [contact, setContact] = useState<ContactInfo>({
    contactName: draft.contactName ?? '',
    contactEmail: draft.contactEmail ?? '',
    companyName: draft.companyName ?? '',
    notes: draft.notes ?? '',
  });
  const [items, setItems] = useState<PackageItem[]>(draft.items ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [proposalId, setProposalId] = useState('');

  const updateContact = useCallback((field: keyof ContactInfo, value: string) => {
    setContact(prev => {
      const next = { ...prev, [field]: value };
      saveDraft(tenantSlug, eventSlug, { ...next, items });
      return next;
    });
  }, [tenantSlug, eventSlug, items]);

  const handleItemsChange = useCallback((newItems: PackageItem[]) => {
    setItems(newItems);
    saveDraft(tenantSlug, eventSlug, { ...contact, items: newItems });
  }, [tenantSlug, eventSlug, contact]);

  async function handleSubmit(status: 'draft' | 'submitted') {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/public/events/${tenantSlug}/${eventSlug}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contact,
          status,
          items: items.map((item, i) => ({
            label: item.label,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            sortOrder: i,
          })),
          packageData: { items },
          currency: 'USD',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Submission failed');

      // Clear draft
      try { localStorage.removeItem(DRAFT_KEY(tenantSlug, eventSlug)); } catch { /* ignore */ }
      track({ eventType: 'cta_click', metadata: { action: `proposal_${status}`, eventSlug, tenantSlug, total } });
      setProposalId(json.data.id);
      setStep('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const fmtUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  // ── Submitted ──────────────────────────────────────────────
  if (step === 'submitted') {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 12L10 17L19 7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Proposal submitted!</h2>
        <p className="text-white/50 mb-6 max-w-sm mx-auto">
          The {eventName} team will review your proposal and respond within 48 hours.
        </p>
        <p className="text-xs text-white/30 font-mono mb-6">Reference: {proposalId}</p>
        <p className="text-sm text-white/40">
          You&apos;ll receive updates at <strong className="text-white">{contact.contactEmail}</strong>
        </p>
      </div>
    );
  }

  // ── Step indicator ─────────────────────────────────────────
  const STEPS: Array<{ key: Step; label: string }> = [
    { key: 'contact', label: 'Contact info' },
    { key: 'builder', label: 'Build package' },
    { key: 'review', label: 'Review & submit' },
  ];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map(({ key, label }, idx) => {
          const active = step === key;
          const done = STEPS.findIndex(s => s.key === step) > idx;
          return (
            <div key={key} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${active ? 'text-white' : done ? 'text-indigo-400' : 'text-white/30'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                  active ? 'bg-indigo-600 border-indigo-500 text-white' :
                  done ? 'bg-indigo-900/40 border-indigo-500/50 text-indigo-400' :
                  'border-white/10 text-white/30'
                }`}>
                  {done ? '✓' : idx + 1}
                </div>
                <span className="text-sm hidden sm:block">{label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${done ? 'bg-indigo-500/40' : 'bg-white/[0.06]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Contact ── */}
      {step === 'contact' && (
        <div className="glass rounded-2xl p-8 space-y-5">
          <h2 className="font-display text-xl font-bold text-white">Your contact information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wide">Full name *</label>
              <input
                type="text"
                value={contact.contactName}
                onChange={e => updateContact('contactName', e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wide">Email *</label>
              <input
                type="email"
                value={contact.contactEmail}
                onChange={e => updateContact('contactEmail', e.target.value)}
                placeholder="jane@company.com"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wide">Company *</label>
              <input
                type="text"
                value={contact.companyName}
                onChange={e => updateContact('companyName', e.target.value)}
                placeholder="Acme Corp"
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
              <textarea
                value={contact.notes}
                onChange={e => updateContact('notes', e.target.value)}
                placeholder="Tell the organizer about your sponsorship goals..."
                rows={3}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setStep('builder')}
              disabled={!contact.contactName || !contact.contactEmail || !contact.companyName}
              className="btn-primary px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next: Build your package
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Builder ── */}
      {step === 'builder' && (
        <div className="space-y-4">
          <PackageBuilder items={items} onChange={handleItemsChange} />
          <div className="flex items-center justify-between">
            <button onClick={() => setStep('contact')} className="btn-ghost text-sm px-4 py-2 border border-white/10">
              Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={items.length === 0}
              className="btn-primary px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Review proposal ({fmtUSD(total)})
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-8">
            <h2 className="font-display text-xl font-bold text-white mb-6">Review your proposal</h2>

            {/* Contact summary */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 mb-4">
              <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">Contact</h3>
              <p className="font-medium text-white">{contact.contactName} · {contact.companyName}</p>
              <p className="text-sm text-white/50">{contact.contactEmail}</p>
              {contact.notes && <p className="text-sm text-white/40 mt-2 italic">{contact.notes}</p>}
            </div>

            {/* Package summary */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
              <h3 className="text-xs text-white/40 uppercase tracking-widest mb-3">Package ({items.length} item{items.length !== 1 ? 's' : ''})</h3>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{item.label} {item.quantity > 1 && <span className="text-white/30">×{item.quantity}</span>}</span>
                    <span className="text-white font-mono">{fmtUSD(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-3 border-t border-white/[0.06]">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-bold text-indigo-300 font-mono text-base">{fmtUSD(total)}</span>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep('builder')} className="btn-ghost text-sm px-4 py-2 border border-white/10">
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSubmit('draft')}
                disabled={submitting}
                className="text-sm text-white/50 hover:text-white transition-colors px-4 py-2.5 border border-white/10 rounded-lg disabled:opacity-40"
              >
                Save as draft
              </button>
              <button
                onClick={() => handleSubmit('submitted')}
                disabled={submitting}
                className="btn-primary px-6 py-2.5 text-sm disabled:opacity-40"
              >
                {submitting ? 'Submitting...' : 'Submit proposal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
