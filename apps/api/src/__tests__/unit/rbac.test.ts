import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '@moongate/config';
import type { OrganizerRole, PlatformRole, Permission } from '@moongate/config';

function hasPermission(role: OrganizerRole | PlatformRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes(permission);
}

describe('RBAC Permission enforcement', () => {
  describe('platform_superadmin', () => {
    it('has all permissions', () => {
      expect(hasPermission('platform_superadmin', 'manage_tenant')).toBe(true);
      expect(hasPermission('platform_superadmin', 'manage_bids')).toBe(true);
      expect(hasPermission('platform_superadmin', 'view_audit_logs')).toBe(true);
    });
  });

  describe('organizer_owner', () => {
    it('can manage events and items', () => {
      expect(hasPermission('organizer_owner', 'manage_event')).toBe(true);
      expect(hasPermission('organizer_owner', 'publish_items')).toBe(true);
    });

    it('can manage tenant (owner has all permissions)', () => {
      expect(hasPermission('organizer_owner', 'manage_tenant')).toBe(true);
    });

    it('can manage bids', () => {
      expect(hasPermission('organizer_owner', 'manage_bids')).toBe(true);
      expect(hasPermission('organizer_owner', 'accept_bids')).toBe(true);
      expect(hasPermission('organizer_owner', 'counter_bids')).toBe(true);
      expect(hasPermission('organizer_owner', 'reject_bids')).toBe(true);
    });
  });

  describe('organizer_sales', () => {
    it('can manage bids', () => {
      expect(hasPermission('organizer_sales', 'manage_bids')).toBe(true);
      expect(hasPermission('organizer_sales', 'accept_bids')).toBe(true);
    });

    it('cannot manage events or publish items', () => {
      expect(hasPermission('organizer_sales', 'manage_event')).toBe(false);
      expect(hasPermission('organizer_sales', 'publish_items')).toBe(false);
    });

    it('cannot upload decks or review AI suggestions', () => {
      expect(hasPermission('organizer_sales', 'upload_deck')).toBe(false);
      expect(hasPermission('organizer_sales', 'review_ai_suggestions')).toBe(false);
    });
  });

  describe('organizer_finance', () => {
    it('can manage orders and payments', () => {
      expect(hasPermission('organizer_finance', 'manage_orders')).toBe(true);
      expect(hasPermission('organizer_finance', 'manage_payments')).toBe(true);
    });

    it('cannot manage bids', () => {
      expect(hasPermission('organizer_finance', 'manage_bids')).toBe(false);
      expect(hasPermission('organizer_finance', 'accept_bids')).toBe(false);
    });
  });

  describe('organizer_viewer', () => {
    it('can only view analytics', () => {
      expect(hasPermission('organizer_viewer', 'view_analytics')).toBe(true);
    });

    it('cannot do anything else', () => {
      expect(hasPermission('organizer_viewer', 'manage_event')).toBe(false);
      expect(hasPermission('organizer_viewer', 'manage_bids')).toBe(false);
      expect(hasPermission('organizer_viewer', 'publish_items')).toBe(false);
      expect(hasPermission('organizer_viewer', 'view_audit_logs')).toBe(false);
    });
  });

  describe('platform_ops', () => {
    it('can view analytics and audit logs', () => {
      expect(hasPermission('platform_ops', 'view_analytics')).toBe(true);
      expect(hasPermission('platform_ops', 'view_audit_logs')).toBe(true);
    });

    it('cannot manage any events or items', () => {
      expect(hasPermission('platform_ops', 'manage_event')).toBe(false);
      expect(hasPermission('platform_ops', 'publish_items')).toBe(false);
      expect(hasPermission('platform_ops', 'manage_bids')).toBe(false);
    });
  });
});
