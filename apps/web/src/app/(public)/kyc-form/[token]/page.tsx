'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

type FormData = {
  template: {
    name: string;
    fields: FieldDef[];
  };
  request: {
    sentToEmail: string;
    sentToName?: string | null;
    status: string;
    bidId?: string | null;
  };
};

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [showExample, setShowExample] = useState(false);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1.5">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {field.type === 'text' && (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          required={field.required}
          className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          required={field.required}
          rows={4}
          className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors resize-none"
        />
      )}

      {field.type === 'select' && field.options && (
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          required={field.required}
          className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
        >
          <option value="">Select an option...</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === 'checkbox' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`field-${field.id}`}
            checked={(value as boolean) ?? false}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 accent-indigo-500"
          />
          <label htmlFor={`field-${field.id}`} className="text-xs text-gray-400">
            {field.placeholder ?? 'Yes'}
          </label>
        </div>
      )}

      {field.type === 'file' && (
        <div className="w-full bg-gray-800/60 border border-dashed border-gray-700 rounded-xl px-4 py-6 text-center">
          <svg className="w-6 h-6 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-xs text-gray-500">File upload — please contact the organizer to share files directly</p>
        </div>
      )}

      {field.helperNote && (
        <p className="text-xs text-white/40 mt-1">{field.helperNote}</p>
      )}

      {field.exampleImageUrl && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setShowExample(prev => !prev)}
            className="text-xs text-indigo-400/70 hover:text-indigo-400 transition-colors underline underline-offset-2"
          >
            {showExample ? 'Hide example' : 'View example'}
          </button>
          {showExample && (
            <div className="mt-2 rounded-xl overflow-hidden border border-gray-700/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={field.exampleImageUrl}
                alt={`Example for ${field.label}`}
                className="w-full max-h-64 object-contain bg-gray-800/40"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KycFormPage() {
  const { token } = useParams() as { token: string };

  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/public/kyc-form/${token}`);
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setFormData(json.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  function setValue(fieldId: string, value: unknown) {
    setValues(prev => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData) return;

    // Check required fields
    for (const field of formData.template.fields) {
      if (field.required && !values[field.id]) {
        setSubmitError(`"${field.label}" is required`);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_URL}/api/public/kyc-form/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: values }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Submission failed');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
        <div className="flex gap-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a12' }}>
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Form Not Available</h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            This form link has expired, already been submitted, or does not exist. Please contact the organizer for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a12' }}>
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Submitted Successfully</h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your information has been submitted. The organizer will review it shortly.
          </p>
        </div>
      </div>
    );
  }

  const { template, request } = formData;

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: '#0a0a12' }}>
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header card */}
        <div className="bg-white/[0.03] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">{template.name}</h1>
              {request.sentToName && (
                <p className="text-xs text-gray-500">For {request.sentToName}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Please fill out the information below. All fields marked with * are required.
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white/[0.03] border border-gray-800 rounded-2xl p-6 space-y-5">
            {template.fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={v => setValue(field.id, v)}
              />
            ))}
          </div>

          {submitError && (
            <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Information'}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-600">
          This form was sent to {request.sentToEmail}. Your information is handled securely.
        </p>
      </div>
    </div>
  );
}
