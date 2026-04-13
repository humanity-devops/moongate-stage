import { prisma } from '@moongate/db';
import type { FastifyRequest } from 'fastify';

export type AnalyticsEventType =
  | 'page_viewed'
  | 'package_viewed'
  | 'deck_viewed'
  | 'cta_click'
  | 'auth_redirect'
  | 'bid_milestone'
  | 'signup_submitted'
  | 'email_verified'
  | 'application_approved'
  | 'account_activated'
  | 'merchant_onboarding_started'
  | 'tenant_created'
  | 'first_event_created'
  | 'campaign_viewed'
  | 'contribution_started'
  | 'contribution_succeeded'
  | 'contribution_failed'
  // M1
  | 'inbox_opened'
  | 'notification_read'
  // M2A
  | 'package_access_policy_updated'
  // M2B/2C
  | 'kyc_note_added'
  | 'kyc_status_changed'
  | 'kyc_form_sent'
  | 'kyc_form_submitted'
  // M3A
  | 'contacts_import_started'
  | 'contacts_import_completed'
  | 'contacts_import_failed'
  // M4A
  | 'browse_auth_modal_shown'
  | 'browse_auth_modal_cta_clicked'
  // M4B
  | 'deal_member_added'
  | 'deal_member_removed'
  // M4C/4D
  | 'referral_link_shared'
  | 'referral_code_generated_bulk'
  // M5
  | 'auth_method_used'
  // M6
  | 'crowdfunding_submission_created'
  | 'crowdfunding_verification_requested'
  | 'crowdfunding_approved'
  | 'crowdfunding_rejected';

export interface TrackParams {
  eventType: AnalyticsEventType;
  tenantId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  resourceId?: string | null;
  resourceType?: string | null;
  metadata?: Record<string, unknown>;
  request?: FastifyRequest;
}

const DEVICE_RE = /mobile|android|iphone|ipad/i;

function parseDevice(ua: string | undefined): string | null {
  if (!ua) return null;
  return DEVICE_RE.test(ua) ? 'mobile' : 'desktop';
}

/**
 * Fire-and-forget analytics write. Never throws.
 */
export function trackEvent(params: TrackParams): void {
  const {
    eventType, tenantId, userId, sessionId,
    resourceId, resourceType, metadata, request,
  } = params;

  const ua = request?.headers['user-agent'];
  const referrer = (request?.headers['referer'] as string | undefined) ?? null;
  const rawQuery = request?.query as Record<string, string> | undefined;

  prisma.analyticsEvent
    .create({
      data: {
        eventType,
        tenantId: tenantId ?? null,
        userId: userId ?? null,
        sessionId: sessionId ?? null,
        resourceId: resourceId ?? null,
        resourceType: resourceType ?? null,
        referrer,
        utmSource: rawQuery?.utm_source ?? null,
        utmMedium: rawQuery?.utm_medium ?? null,
        utmCampaign: rawQuery?.utm_campaign ?? null,
        device: parseDevice(ua),
        // Country would come from a geo-IP header set by a CDN in production
        country: (request?.headers['cf-ipcountry'] as string | undefined) ?? null,
        metadata: metadata ?? undefined,
      },
    })
    .catch((err) => {
      console.error('[analytics] Failed to write event:', err?.message);
    });
}
