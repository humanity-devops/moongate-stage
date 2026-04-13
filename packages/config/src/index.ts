export const APP_NAME = 'Moongate Sponsor Marketplace';
export const APP_VERSION = '0.1.0';

export const ITEM_MODES = ['fixed_price', 'sealed_bid', 'hybrid', 'request_only'] as const;
export type ItemMode = typeof ITEM_MODES[number];

export const ITEM_CATEGORIES = [
  'title_sponsorship',
  'sponsor_pack',
  'booth',
  'stage',
  'branding',
  'media',
  'food_beverage',
  'badge',
  'ad_placement',
  'side_event',
  'custom',
  'other',
] as const;
export type ItemCategory = typeof ITEM_CATEGORIES[number];

export const ITEM_STATUSES = [
  'draft',
  'review_required',
  'published',
  'reserved',
  'sold_out',
  'archived',
] as const;
export type ItemStatus = typeof ITEM_STATUSES[number];

export const BID_STATUSES = [
  'submitted',
  'under_review',
  'countered',
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
] as const;
export type BidStatus = typeof BID_STATUSES[number];

export const ORDER_STATUSES = [
  'pending',
  'payment_pending',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'USDC', 'ETH'] as const;
export type Currency = typeof CURRENCIES[number];

export const PLATFORM_ROLES = ['platform_superadmin', 'platform_ops'] as const;
export type PlatformRole = typeof PLATFORM_ROLES[number];

export const ORGANIZER_ROLES = [
  'organizer_owner',
  'organizer_admin',
  'organizer_sales',
  'organizer_finance',
  'organizer_viewer',
  'organizer_ops',
  'organizer_growth',
  'organizer_analytics',
  'organizer_compliance',
] as const;
export type OrganizerRole = typeof ORGANIZER_ROLES[number];

export const PERMISSIONS = [
  'manage_tenant',
  'manage_event',
  'manage_branding',
  'upload_deck',
  'review_ai_suggestions',
  'publish_items',
  'manage_inventory',
  'manage_bids',
  'accept_bids',
  'counter_bids',
  'reject_bids',
  'manage_orders',
  'manage_payments',
  'manage_assets',
  'view_analytics',
  'export_data',
  'view_audit_logs',
  'manage_kyc',
  'approve_fundraising',
  'create_one_time_links',
  'send_outreach_campaigns',
  'manage_membership_early_access',
  'view_user_profiles',
  'edit_user_profiles',
  'manage_roles',
  'manage_settings',
  'view_pii_analytics',
  'view_access',
  'manage_proposals',
] as const;
export type Permission = typeof PERMISSIONS[number];

export const ROLE_PERMISSIONS: Record<OrganizerRole | PlatformRole, Permission[]> = {
  platform_superadmin: PERMISSIONS as unknown as Permission[],
  platform_ops: ['view_analytics', 'view_audit_logs', 'export_data'],
  organizer_owner: PERMISSIONS as unknown as Permission[],
  organizer_admin: [
    'manage_event', 'manage_branding', 'upload_deck', 'review_ai_suggestions',
    'publish_items', 'manage_inventory', 'manage_bids', 'accept_bids',
    'counter_bids', 'reject_bids', 'manage_orders', 'manage_payments',
    'manage_assets', 'view_analytics', 'export_data', 'view_audit_logs',
    'approve_fundraising', 'create_one_time_links', 'manage_kyc',
    'view_access', 'view_user_profiles', 'edit_user_profiles',
    'manage_settings', 'view_pii_analytics', 'manage_proposals',
  ],
  organizer_sales: [
    'manage_bids', 'accept_bids', 'counter_bids', 'reject_bids',
    'manage_orders', 'view_analytics',
  ],
  organizer_finance: ['manage_orders', 'manage_payments', 'view_analytics', 'export_data'],
  organizer_viewer: ['view_analytics'],
  organizer_ops: [
    'manage_event', 'manage_branding', 'publish_items', 'manage_inventory',
    'manage_bids', 'accept_bids', 'counter_bids', 'reject_bids',
    'manage_orders', 'view_analytics', 'export_data', 'view_audit_logs',
    'approve_fundraising', 'create_one_time_links', 'manage_kyc',
    'view_access', 'view_user_profiles', 'manage_settings', 'view_pii_analytics', 'manage_proposals',
  ],
  organizer_growth: [
    'manage_bids', 'accept_bids', 'counter_bids', 'reject_bids',
    'view_analytics', 'export_data',
    'send_outreach_campaigns', 'manage_proposals', 'view_user_profiles',
  ],
  organizer_analytics: [
    'view_analytics', 'export_data', 'view_pii_analytics',
  ],
  organizer_compliance: [
    'manage_kyc', 'view_audit_logs', 'view_user_profiles',
    'edit_user_profiles', 'view_pii_analytics',
  ],
};

export const EXTRACTION_JOB_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;
export type ExtractionJobStatus = typeof EXTRACTION_JOB_STATUSES[number];

export const PAGE_CLASSIFICATIONS = [
  'cover',
  'stats',
  'value_proposition',
  'sponsor_package',
  'upgrade',
  'add_on',
  'contact',
  'other',
] as const;
export type PageClassification = typeof PAGE_CLASSIFICATIONS[number];
