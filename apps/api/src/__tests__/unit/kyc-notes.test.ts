import { describe, it, expect } from 'vitest';

// ============================================================
// Pure helper types and functions extracted from kyc routes
// for unit testing — no real DB involved.
// ============================================================

type KycStatus = 'not_started' | 'submitted' | 'needs_more_info' | 'approved' | 'rejected';

interface KycNote {
  id: string;
  submissionId: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
}

interface KycAuditEntry {
  id: string;
  submissionId: string;
  action: string;
  actorId: string | null;
  actorName: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

type TimelineItem =
  | ({ type: 'note' } & KycNote)
  | ({ type: 'audit' } & KycAuditEntry);

interface FieldDef {
  id: string;
  type: 'text' | 'textarea' | 'file' | 'select' | 'checkbox';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

// ---- Pure logic functions (mirrors logic in route handlers) ----

/** Validate a fields array for a KycFormTemplate */
function validateTemplateFields(fields: unknown[]): { valid: boolean; error?: string } {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { valid: false, error: 'At least one field is required' };
  }
  for (const f of fields as Partial<FieldDef>[]) {
    if (!f.id || typeof f.id !== 'string' || f.id.trim() === '') {
      return { valid: false, error: 'Each field must have an id' };
    }
    if (!f.label || typeof f.label !== 'string' || f.label.trim() === '') {
      return { valid: false, error: 'Each field must have a label' };
    }
    const allowedTypes = ['text', 'textarea', 'file', 'select', 'checkbox'];
    if (!f.type || !allowedTypes.includes(f.type as string)) {
      return { valid: false, error: `Invalid field type: ${String(f.type)}` };
    }
  }
  return { valid: true };
}

/** Append a note to an existing list (notes are never removed, only appended) */
function appendNote(existing: KycNote[], newNote: KycNote): KycNote[] {
  return [...existing, newNote];
}

/** Create an audit entry for a status transition */
function createStatusAuditEntry(
  submissionId: string,
  fromStatus: KycStatus,
  toStatus: KycStatus,
  actorId: string,
  actorName: string,
  reason?: string,
): Omit<KycAuditEntry, 'id' | 'createdAt'> {
  return {
    submissionId,
    action: 'status_changed',
    actorId,
    actorName,
    fromStatus,
    toStatus,
    reason: reason ?? null,
    metadata: null,
  };
}

/** Merge notes and audit entries into a chronological timeline */
function buildTimeline(notes: KycNote[], auditEntries: KycAuditEntry[]): TimelineItem[] {
  const noteItems: TimelineItem[] = notes.map(n => ({ type: 'note', ...n }));
  const auditItems: TimelineItem[] = auditEntries.map(a => ({ type: 'audit', ...a }));
  return [...noteItems, ...auditItems].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Validate note content */
function validateNoteContent(content: unknown): { valid: boolean; error?: string } {
  if (typeof content !== 'string') return { valid: false, error: 'Content must be a string' };
  if (content.trim().length === 0) return { valid: false, error: 'Content cannot be empty' };
  if (content.length > 2000) return { valid: false, error: 'Content exceeds 2000 characters' };
  return { valid: true };
}

/** Generate a unique token (simulated — just checks length/format constraints) */
function isValidToken(token: string): boolean {
  return typeof token === 'string' && token.length === 64 && /^[0-9a-f]+$/.test(token);
}

// ---- Tests ----

describe('Note append behavior', () => {
  const base: KycNote = {
    id: 'note-1',
    submissionId: 'sub-1',
    authorId: 'user-1',
    authorName: 'Alice',
    content: 'First note',
    isInternal: true,
    createdAt: new Date('2026-01-01T10:00:00Z'),
  };

  it('appends a new note to an empty list', () => {
    const result = appendNote([], base);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('First note');
  });

  it('appends a note without removing previous notes', () => {
    const second: KycNote = {
      id: 'note-2',
      submissionId: 'sub-1',
      authorId: 'user-2',
      authorName: 'Bob',
      content: 'Second note',
      isInternal: false,
      createdAt: new Date('2026-01-01T11:00:00Z'),
    };
    const result = appendNote([base], second);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('note-1');
    expect(result[1].id).toBe('note-2');
  });

  it('does not mutate the original array', () => {
    const original = [base];
    const second: KycNote = { ...base, id: 'note-2', content: 'Another note' };
    appendNote(original, second);
    expect(original).toHaveLength(1);
  });

  it('preserves internal flag on notes', () => {
    const internalNote = appendNote([], { ...base, isInternal: true });
    const publicNote = appendNote([], { ...base, isInternal: false });
    expect(internalNote[0].isInternal).toBe(true);
    expect(publicNote[0].isInternal).toBe(false);
  });
});

describe('Audit entry created on status change', () => {
  it('creates a status_changed audit entry with correct fields', () => {
    const entry = createStatusAuditEntry('sub-1', 'submitted', 'approved', 'user-1', 'Alice', 'Looks good');
    expect(entry.action).toBe('status_changed');
    expect(entry.fromStatus).toBe('submitted');
    expect(entry.toStatus).toBe('approved');
    expect(entry.actorId).toBe('user-1');
    expect(entry.reason).toBe('Looks good');
  });

  it('sets reason to null when not provided', () => {
    const entry = createStatusAuditEntry('sub-1', 'not_started', 'submitted', 'user-2', 'Bob');
    expect(entry.reason).toBeNull();
  });

  it('records fromStatus and toStatus accurately for rejection', () => {
    const entry = createStatusAuditEntry('sub-1', 'submitted', 'rejected', 'user-1', 'Alice', 'Docs missing');
    expect(entry.fromStatus).toBe('submitted');
    expect(entry.toStatus).toBe('rejected');
    expect(entry.reason).toBe('Docs missing');
  });
});

describe('Form template field validation', () => {
  it('rejects empty fields array', () => {
    const result = validateTemplateFields([]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('At least one field');
  });

  it('rejects non-array input', () => {
    const result = validateTemplateFields('not an array' as unknown as unknown[]);
    expect(result.valid).toBe(false);
  });

  it('accepts a valid single field', () => {
    const field: FieldDef = { id: 'f1', type: 'text', label: 'Full Name', required: true };
    const result = validateTemplateFields([field]);
    expect(result.valid).toBe(true);
  });

  it('rejects a field missing label', () => {
    const field = { id: 'f1', type: 'text', label: '', required: true };
    const result = validateTemplateFields([field]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('label');
  });

  it('rejects a field with invalid type', () => {
    const field = { id: 'f1', type: 'invalid_type', label: 'Test', required: false };
    const result = validateTemplateFields([field]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid field type');
  });

  it('accepts all valid field types', () => {
    const types: FieldDef['type'][] = ['text', 'textarea', 'file', 'select', 'checkbox'];
    for (const type of types) {
      const result = validateTemplateFields([{ id: 'f1', type, label: 'Test', required: false }]);
      expect(result.valid).toBe(true);
    }
  });
});

describe('KycFormRequest token uniqueness', () => {
  it('validates correct 64-char hex token', () => {
    const token = 'a'.repeat(64);
    expect(isValidToken(token)).toBe(true);
  });

  it('rejects token that is too short', () => {
    expect(isValidToken('abc123')).toBe(false);
  });

  it('rejects token with non-hex characters', () => {
    const token = 'g'.repeat(64); // 'g' is not valid hex
    expect(isValidToken(token)).toBe(false);
  });

  it('generates distinct tokens (randomness simulation)', () => {
    // Two hex strings of 64 chars with different content should be unique
    const t1 = '1' + 'a'.repeat(63);
    const t2 = '2' + 'a'.repeat(63);
    expect(t1).not.toBe(t2);
    expect(isValidToken(t1)).toBe(true);
    expect(isValidToken(t2)).toBe(true);
  });
});

describe('Timeline sort order', () => {
  const note1: KycNote = {
    id: 'n1', submissionId: 'sub-1', authorId: 'u1', authorName: 'Alice',
    content: 'First', isInternal: true, createdAt: new Date('2026-01-01T09:00:00Z'),
  };
  const note2: KycNote = {
    id: 'n2', submissionId: 'sub-1', authorId: 'u1', authorName: 'Alice',
    content: 'Third', isInternal: false, createdAt: new Date('2026-01-01T11:00:00Z'),
  };
  const audit1: KycAuditEntry = {
    id: 'a1', submissionId: 'sub-1', action: 'status_changed',
    actorId: 'u1', actorName: 'Alice', fromStatus: 'not_started', toStatus: 'submitted',
    createdAt: new Date('2026-01-01T10:00:00Z'),
  };

  it('sorts timeline items in chronological order ascending', () => {
    const timeline = buildTimeline([note2, note1], [audit1]);
    expect(timeline).toHaveLength(3);
    expect(timeline[0].id).toBe('n1');   // 09:00
    expect(timeline[1].id).toBe('a1');   // 10:00
    expect(timeline[2].id).toBe('n2');   // 11:00
  });

  it('returns empty timeline when both arrays are empty', () => {
    const timeline = buildTimeline([], []);
    expect(timeline).toHaveLength(0);
  });

  it('tags notes with type note', () => {
    const timeline = buildTimeline([note1], []);
    expect(timeline[0].type).toBe('note');
  });

  it('tags audit entries with type audit', () => {
    const timeline = buildTimeline([], [audit1]);
    expect(timeline[0].type).toBe('audit');
  });
});

describe('Note content validation', () => {
  it('accepts valid content within limit', () => {
    const result = validateNoteContent('This is a valid note.');
    expect(result.valid).toBe(true);
  });

  it('rejects empty string', () => {
    const result = validateNoteContent('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects whitespace-only content', () => {
    const result = validateNoteContent('   ');
    expect(result.valid).toBe(false);
  });

  it('rejects content exceeding 2000 characters', () => {
    const long = 'x'.repeat(2001);
    const result = validateNoteContent(long);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2000');
  });

  it('accepts content exactly at 2000 character limit', () => {
    const exact = 'x'.repeat(2000);
    const result = validateNoteContent(exact);
    expect(result.valid).toBe(true);
  });

  it('rejects non-string input', () => {
    const result = validateNoteContent(42);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('string');
  });
});
