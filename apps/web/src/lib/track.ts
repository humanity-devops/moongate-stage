const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type AnalyticsEventType =
  | 'page_viewed'
  | 'package_viewed'
  | 'cta_click'
  | 'auth_redirect'
  | 'browse_auth_modal_shown'
  | 'browse_auth_modal_cta_clicked';

interface TrackOptions {
  eventType: AnalyticsEventType;
  tenantId?: string;
  resourceId?: string;
  resourceType?: string;
  metadata?: Record<string, unknown>;
}

let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === 'undefined') return '';
  const key = 'mg_sid';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  sessionId = sid;
  return sid;
}

export function track(options: TrackOptions): void {
  if (typeof window === 'undefined') return;

  const { eventType, tenantId, resourceId, resourceType, metadata } = options;

  fetch(`${API_URL}/api/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType,
      tenantId,
      sessionId: getSessionId(),
      resourceId,
      resourceType,
      metadata,
    }),
    keepalive: true,
  }).catch(() => { /* fire-and-forget */ });
}
