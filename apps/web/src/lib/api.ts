const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  tenantSlug?: string;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, tenantSlug } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = new URL(`${API_URL}${path}`);
  if (tenantSlug) url.searchParams.set('tenantSlug', tenantSlug);

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.message ?? `HTTP ${res.status}`) as Error & { status: number; code?: string };
    err.status = res.status;
    err.code = json.error;
    throw err;
  }
  return json;
}

// Public API helpers
export const publicApi = {
  getEvent: (tenantSlug: string, eventSlug: string, params?: Record<string, string>) => {
    const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<{ data: Record<string, unknown> }>(`/api/public/events/${tenantSlug}/${eventSlug}${qs}`);
  },

  getItems: (tenantSlug: string, eventSlug: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<{ data: unknown[]; total: number; totalPages: number }>(
      `/api/public/events/${tenantSlug}/${eventSlug}/items${qs}`,
    );
  },

  getItem: (tenantSlug: string, eventSlug: string, slug: string) =>
    apiRequest<{ data: Record<string, unknown> }>(
      `/api/public/events/${tenantSlug}/${eventSlug}/items/${slug}`,
    ),

  submitBid: (tenantSlug: string, eventSlug: string, itemSlug: string, body: unknown) =>
    apiRequest(`/api/public/events/${tenantSlug}/${eventSlug}/items/${itemSlug}/bids`, {
      method: 'POST',
      body,
    }),

  startCheckout: (
    tenantSlug: string,
    eventSlug: string,
    itemSlug: string,
    body: {
      companyName: string;
      contactName: string;
      email: string;
      telegram?: string;
      notes?: string;
      termsAccepted: true;
    },
  ) =>
    apiRequest<{
      data: {
        mode: 'stripe_redirect' | 'reserve_only';
        checkoutUrl?: string;
        orderId: string;
        fullAmount?: number;
        dueNow?: number;
        balanceDue?: number;
        finalPaymentDueAt?: string | null;
        message?: string;
      };
    }>(
      `/api/public/events/${tenantSlug}/${eventSlug}/items/${itemSlug}/checkout`,
      { method: 'POST', body },
    ),

  submitLead: (tenantSlug: string, eventSlug: string, body: unknown) =>
    apiRequest(`/api/public/events/${tenantSlug}/${eventSlug}/leads`, {
      method: 'POST',
      body,
    }),

  getCampaigns: (tenantSlug: string, eventSlug: string, itemSlug: string) =>
    apiRequest<{ data: CrowdfundCampaign[] }>(
      `/api/public/events/${tenantSlug}/${eventSlug}/items/${itemSlug}/campaigns`,
    ),

  getCampaign: (tenantSlug: string, eventSlug: string, campaignId: string) =>
    apiRequest<{ data: CrowdfundCampaignDetail }>(
      `/api/public/events/${tenantSlug}/${eventSlug}/campaigns/${campaignId}`,
    ),

  startCampaign: (tenantSlug: string, eventSlug: string, itemSlug: string, body: unknown) =>
    apiRequest<{ data: { id: string; status: string; message: string } }>(
      `/api/public/events/${tenantSlug}/${eventSlug}/items/${itemSlug}/campaigns`,
      { method: 'POST', body },
    ),

  contribute: (tenantSlug: string, eventSlug: string, campaignId: string, body: unknown) =>
    apiRequest<{ data: { id: string; campaignWon: boolean; newRaisedAmount: number; message: string } }>(
      `/api/public/events/${tenantSlug}/${eventSlug}/campaigns/${campaignId}/contribute`,
      { method: 'POST', body },
    ),
};

export interface CrowdfundCampaign {
  id: string;
  entityName: string;
  entityDescription?: string;
  entityWebsite?: string;
  contactName: string;
  goalAmount: string;
  raisedAmount: string;
  currency: string;
  deadline: string;
  status: 'active' | 'won' | 'lost' | 'expired' | 'cancelled';
  wonAt?: string;
  backerCount: number;
  percentFunded: number;
  createdAt: string;
}

export interface CrowdfundCampaignDetail extends CrowdfundCampaign {
  recentContributions: {
    id: string;
    contributorName: string;
    message?: string;
    amount: string;
    currency: string;
    createdAt: string;
  }[];
  item: {
    slug: string;
    publicTitle: string;
    shortDescription?: string;
    category: string;
    listPrice?: string;
    currency: string;
    status: string;
  };
}

// Sponsor API helpers (authenticated)
export const sponsorApi = {
  getOrders: (token: string) =>
    apiRequest<{ data: SponsorOrder[] }>('/api/sponsor/orders', { token }),

  getOrder: (orderId: string, token: string) =>
    apiRequest<{ data: SponsorOrder }>(`/api/sponsor/orders/${orderId}`, { token }),

  payBalance: (orderId: string, token: string) =>
    apiRequest<{ data: { url: string } }>(`/api/sponsor/orders/${orderId}/pay-balance`, {
      method: 'POST',
      token,
    }),

  sendFinalReminder: (orderId: string, token: string) =>
    apiRequest<{ data: { ok: boolean } }>(`/api/organizer/orders/${orderId}/send-final-reminder`, {
      method: 'POST',
      token,
    }),
};

export interface SponsorOrder {
  id: string;
  status: string;
  total: number | string;
  currency: string;
  createdAt: string;
  paymentStage?: string;
  fullAmount?: number | string | null;
  depositAmount?: number | string | null;
  balanceDueAmount?: number | string | null;
  finalPaymentDueAt?: string | null;
  depositPaidAt?: string | null;
  finalReminderSentAt?: string | null;
  event: { name: string; slug: string };
  tenant: { slug: string; name: string };
  lines: { id: string; label?: string | null; item: { publicTitle: string }; quantity: number; unitPrice: number | string }[];
  invoice: { id: string; invoiceNumber: string; issuedAt: string } | null;
}

// Organizer API helpers
export const organizerApi = {
  login: (body: unknown) =>
    apiRequest<{ data: { token: string; user: Record<string, unknown> } }>('/api/auth/login', { method: 'POST', body }),

  me: (token: string) =>
    apiRequest<{ data: Record<string, unknown> }>('/api/auth/me', { token }),

  getEvents: (token: string, tenantSlug: string) =>
    apiRequest<{ data: unknown[] }>('/api/organizer/events', { token, tenantSlug }),

  getEvent: (eventId: string, token: string, tenantSlug: string) =>
    apiRequest<{ data: Record<string, unknown> }>(`/api/organizer/events/${eventId}`, { token, tenantSlug }),

  getEventDashboard: (eventId: string, token: string, tenantSlug: string) =>
    apiRequest<{ data: Record<string, unknown> }>(`/api/organizer/events/${eventId}/dashboard`, { token, tenantSlug }),

  getItems: (eventId: string, token: string, tenantSlug: string) =>
    apiRequest<{ data: unknown[] }>(`/api/organizer/events/${eventId}/items`, { token, tenantSlug }),

  getBids: (eventId: string, token: string, tenantSlug: string, status?: string) =>
    apiRequest<{ data: unknown[] }>(
      `/api/organizer/events/${eventId}/bids${status ? `?status=${status}` : ''}`,
      { token, tenantSlug },
    ),

  acceptBid: (eventId: string, bidId: string, token: string, tenantSlug: string) =>
    apiRequest(`/api/organizer/events/${eventId}/bids/${bidId}/accept`, { method: 'POST', token, tenantSlug }),

  counterBid: (eventId: string, bidId: string, body: unknown, token: string, tenantSlug: string) =>
    apiRequest(`/api/organizer/events/${eventId}/bids/${bidId}/counter`, { method: 'POST', body, token, tenantSlug }),

  rejectBid: (eventId: string, bidId: string, token: string, tenantSlug: string) =>
    apiRequest(`/api/organizer/events/${eventId}/bids/${bidId}`, {
      method: 'PATCH', body: { status: 'rejected' }, token, tenantSlug,
    }),

  getCampaigns: (eventId: string, token: string, tenantSlug: string, approvalStatus?: string) =>
    apiRequest<{ data: unknown[] }>(
      `/api/organizer/events/${eventId}/campaigns${approvalStatus ? `?approvalStatus=${approvalStatus}` : ''}`,
      { token, tenantSlug },
    ),

  reviewCampaign: (
    eventId: string,
    campaignId: string,
    body: { approvalStatus: 'approved' | 'rejected'; rejectionReason?: string },
    token: string,
    tenantSlug: string,
  ) =>
    apiRequest(`/api/organizer/events/${eventId}/campaigns/${campaignId}/review`, {
      method: 'PATCH', body, token, tenantSlug,
    }),
};
