import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, PERMISSIONS } from '@moongate/config';
import type { OrganizerRole, PlatformRole, Permission } from '@moongate/config';

function hasPermission(role: OrganizerRole | PlatformRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes(permission);
}

// ============================================================
// New organizer roles — permission correctness
// ============================================================

describe('organizer_ops', () => {
  it('can manage events and inventory', () => {
    expect(hasPermission('organizer_ops', 'manage_event')).toBe(true);
    expect(hasPermission('organizer_ops', 'manage_inventory')).toBe(true);
    expect(hasPermission('organizer_ops', 'publish_items')).toBe(true);
  });

  it('can approve fundraising campaigns', () => {
    expect(hasPermission('organizer_ops', 'approve_fundraising')).toBe(true);
  });

  it('can manage KYC', () => {
    expect(hasPermission('organizer_ops', 'manage_kyc')).toBe(true);
  });

  it('can view access controls', () => {
    expect(hasPermission('organizer_ops', 'view_access')).toBe(true);
  });

  it('can manage settings', () => {
    expect(hasPermission('organizer_ops', 'manage_settings')).toBe(true);
  });

  it('can view user profiles but NOT edit them', () => {
    expect(hasPermission('organizer_ops', 'view_user_profiles')).toBe(true);
    expect(hasPermission('organizer_ops', 'edit_user_profiles')).toBe(false);
  });

  it('cannot manage tenant-level config', () => {
    expect(hasPermission('organizer_ops', 'manage_tenant')).toBe(false);
  });

  it('cannot manage membership early access (staff-only)', () => {
    expect(hasPermission('organizer_ops', 'manage_membership_early_access')).toBe(false);
  });

  it('cannot manage roles', () => {
    expect(hasPermission('organizer_ops', 'manage_roles')).toBe(false);
  });
});

describe('organizer_growth', () => {
  it('can manage bids and view analytics', () => {
    expect(hasPermission('organizer_growth', 'manage_bids')).toBe(true);
    expect(hasPermission('organizer_growth', 'view_analytics')).toBe(true);
    expect(hasPermission('organizer_growth', 'export_data')).toBe(true);
  });

  it('can send outreach campaigns', () => {
    expect(hasPermission('organizer_growth', 'send_outreach_campaigns')).toBe(true);
  });

  it('can manage proposals', () => {
    expect(hasPermission('organizer_growth', 'manage_proposals')).toBe(true);
  });

  it('can view user profiles', () => {
    expect(hasPermission('organizer_growth', 'view_user_profiles')).toBe(true);
  });

  it('cannot manage events, publish items, or manage inventory', () => {
    expect(hasPermission('organizer_growth', 'manage_event')).toBe(false);
    expect(hasPermission('organizer_growth', 'publish_items')).toBe(false);
    expect(hasPermission('organizer_growth', 'manage_inventory')).toBe(false);
  });

  it('cannot approve fundraising', () => {
    expect(hasPermission('organizer_growth', 'approve_fundraising')).toBe(false);
  });

  it('cannot edit user profiles or manage roles', () => {
    expect(hasPermission('organizer_growth', 'edit_user_profiles')).toBe(false);
    expect(hasPermission('organizer_growth', 'manage_roles')).toBe(false);
  });

  it('cannot access PII analytics', () => {
    expect(hasPermission('organizer_growth', 'view_pii_analytics')).toBe(false);
  });

  it('cannot manage membership early access (staff-only)', () => {
    expect(hasPermission('organizer_growth', 'manage_membership_early_access')).toBe(false);
  });
});

describe('organizer_analytics', () => {
  it('can view analytics and export data', () => {
    expect(hasPermission('organizer_analytics', 'view_analytics')).toBe(true);
    expect(hasPermission('organizer_analytics', 'export_data')).toBe(true);
  });

  it('can view PII analytics', () => {
    expect(hasPermission('organizer_analytics', 'view_pii_analytics')).toBe(true);
  });

  it('cannot manage anything operational', () => {
    expect(hasPermission('organizer_analytics', 'manage_event')).toBe(false);
    expect(hasPermission('organizer_analytics', 'manage_bids')).toBe(false);
    expect(hasPermission('organizer_analytics', 'publish_items')).toBe(false);
    expect(hasPermission('organizer_analytics', 'manage_orders')).toBe(false);
    expect(hasPermission('organizer_analytics', 'manage_kyc')).toBe(false);
    expect(hasPermission('organizer_analytics', 'approve_fundraising')).toBe(false);
  });

  it('cannot view or edit user profiles', () => {
    expect(hasPermission('organizer_analytics', 'view_user_profiles')).toBe(false);
    expect(hasPermission('organizer_analytics', 'edit_user_profiles')).toBe(false);
  });

  it('cannot manage membership early access (staff-only)', () => {
    expect(hasPermission('organizer_analytics', 'manage_membership_early_access')).toBe(false);
  });
});

describe('organizer_compliance', () => {
  it('can manage KYC', () => {
    expect(hasPermission('organizer_compliance', 'manage_kyc')).toBe(true);
  });

  it('can view audit logs', () => {
    expect(hasPermission('organizer_compliance', 'view_audit_logs')).toBe(true);
  });

  it('can view and edit user profiles', () => {
    expect(hasPermission('organizer_compliance', 'view_user_profiles')).toBe(true);
    expect(hasPermission('organizer_compliance', 'edit_user_profiles')).toBe(true);
  });

  it('can view PII analytics', () => {
    expect(hasPermission('organizer_compliance', 'view_pii_analytics')).toBe(true);
  });

  it('cannot manage events, bids, or inventory', () => {
    expect(hasPermission('organizer_compliance', 'manage_event')).toBe(false);
    expect(hasPermission('organizer_compliance', 'manage_bids')).toBe(false);
    expect(hasPermission('organizer_compliance', 'manage_inventory')).toBe(false);
  });

  it('cannot approve fundraising', () => {
    expect(hasPermission('organizer_compliance', 'approve_fundraising')).toBe(false);
  });

  it('cannot manage roles or settings', () => {
    expect(hasPermission('organizer_compliance', 'manage_roles')).toBe(false);
    expect(hasPermission('organizer_compliance', 'manage_settings')).toBe(false);
  });

  it('cannot manage membership early access (staff-only)', () => {
    expect(hasPermission('organizer_compliance', 'manage_membership_early_access')).toBe(false);
  });
});

// ============================================================
// manage_membership_early_access is staff-only
// ============================================================

describe('manage_membership_early_access permission', () => {
  // organizer_owner has ALL permissions by design (PERMISSIONS as unknown as Permission[]).
  // The actual staff-only restriction is enforced by requireStaff (platformRole check) at the
  // route level in merchantMembership.ts — not by a permission map lookup.
  const nonOwnerOrganizerRoles: OrganizerRole[] = [
    'organizer_admin', 'organizer_sales', 'organizer_finance',
    'organizer_viewer', 'organizer_ops', 'organizer_growth', 'organizer_analytics',
    'organizer_compliance',
  ];

  it('is granted to platform_superadmin', () => {
    expect(hasPermission('platform_superadmin', 'manage_membership_early_access')).toBe(true);
  });

  it('is NOT granted to platform_ops', () => {
    expect(hasPermission('platform_ops', 'manage_membership_early_access')).toBe(false);
  });

  it('is NOT granted to non-owner organizer roles', () => {
    for (const role of nonOwnerOrganizerRoles) {
      expect(hasPermission(role, 'manage_membership_early_access')).toBe(false);
    }
  });

  it('organizer_owner has it because owner has all permissions — route uses requireStaff guard', () => {
    // The permission being present does NOT grant access to the staff-only route.
    // merchantMembership.ts enforces platformRole === 'platform_superadmin' independently.
    expect(hasPermission('organizer_owner', 'manage_membership_early_access')).toBe(true);
  });
});

// ============================================================
// organizer_owner has all permissions
// ============================================================

describe('organizer_owner', () => {
  it('has every defined permission', () => {
    for (const perm of PERMISSIONS) {
      expect(hasPermission('organizer_owner', perm)).toBe(true);
    }
  });
});

// ============================================================
// organizer_admin has the extended permission set
// ============================================================

describe('organizer_admin', () => {
  it('has approve_fundraising', () => {
    expect(hasPermission('organizer_admin', 'approve_fundraising')).toBe(true);
  });

  it('has manage_kyc', () => {
    expect(hasPermission('organizer_admin', 'manage_kyc')).toBe(true);
  });

  it('has view_user_profiles and edit_user_profiles', () => {
    expect(hasPermission('organizer_admin', 'view_user_profiles')).toBe(true);
    expect(hasPermission('organizer_admin', 'edit_user_profiles')).toBe(true);
  });

  it('has manage_settings', () => {
    expect(hasPermission('organizer_admin', 'manage_settings')).toBe(true);
  });

  it('cannot manage tenant-level config', () => {
    expect(hasPermission('organizer_admin', 'manage_tenant')).toBe(false);
  });

  it('cannot manage roles (only owner can)', () => {
    expect(hasPermission('organizer_admin', 'manage_roles')).toBe(false);
  });

  it('cannot manage membership early access (staff-only)', () => {
    expect(hasPermission('organizer_admin', 'manage_membership_early_access')).toBe(false);
  });
});

// ============================================================
// Role isolation — distinct capability boundaries
// ============================================================

describe('Role isolation', () => {
  it('organizer_viewer has no capabilities beyond view_analytics', () => {
    const viewerPerms = ROLE_PERMISSIONS['organizer_viewer'];
    expect(viewerPerms).toHaveLength(1);
    expect(viewerPerms[0]).toBe('view_analytics');
  });

  it('organizer_finance cannot manage bids', () => {
    expect(hasPermission('organizer_finance', 'manage_bids')).toBe(false);
    expect(hasPermission('organizer_finance', 'accept_bids')).toBe(false);
  });

  it('organizer_sales cannot manage orders or payments', () => {
    expect(hasPermission('organizer_sales', 'manage_payments')).toBe(false);
  });

  it('no two non-owner, non-admin roles share the same permission set', () => {
    const specialRoles: OrganizerRole[] = [
      'organizer_sales', 'organizer_finance', 'organizer_viewer',
      'organizer_ops', 'organizer_growth', 'organizer_analytics', 'organizer_compliance',
    ];
    const sets = specialRoles.map(r => JSON.stringify([...ROLE_PERMISSIONS[r]].sort()));
    const unique = new Set(sets);
    expect(unique.size).toBe(specialRoles.length);
  });
});
