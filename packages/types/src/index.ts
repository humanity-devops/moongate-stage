export type { ItemMode, ItemCategory, ItemStatus, BidStatus, OrderStatus, Currency, Permission, OrganizerRole, PlatformRole } from '@moongate/config';

// --- Tenant ---
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  domain?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- User ---
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- Event ---
export interface Event {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  city?: string;
  country?: string;
  timezone?: string;
  websiteUrl?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// --- Sponsorship Item ---
export interface SponsorItem {
  id: string;
  eventId: string;
  tenantId: string;
  slug: string;
  publicTitle: string;
  internalTitle?: string;
  shortDescription?: string;
  longDescription?: string;
  category: string;
  mode: string;
  currency: string;
  listPrice?: number;
  reservePrice?: number;
  minimumBid?: number;
  bidAllowed: boolean;
  quantityTotal?: number;
  quantitySold: number;
  isExclusive: boolean;
  status: string;
  featured: boolean;
  packageTier?: string;
  visibleToPublic: boolean;
  checkoutEnabled: boolean;
  requiresApproval: boolean;
  onRequest: boolean;
  availableFrom?: Date;
  availableTo?: Date;
  createdAt: Date;
  updatedAt: Date;
  benefits?: SponsorItemBenefit[];
}

export interface SponsorItemBenefit {
  id: string;
  itemId: string;
  type: string;
  label: string;
  value?: string;
  quantity?: number;
  sortOrder: number;
}

// --- Bid ---
export interface Bid {
  id: string;
  itemId: string;
  eventId: string;
  tenantId: string;
  status: string;
  companyName: string;
  contactName: string;
  email: string;
  telegram?: string;
  whatsapp?: string;
  proposedBudget: number;
  currency: string;
  notes?: string;
  customAsks?: string;
  internalNotes?: string;
  assignedToId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- Order ---
export interface Order {
  id: string;
  tenantId: string;
  eventId: string;
  sponsorCompanyId?: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  stripePaymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
  lines?: OrderLine[];
}

export interface OrderLine {
  id: string;
  orderId: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// --- API Response shapes ---
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// --- Extraction ---
export interface ExtractionSuggestion {
  id: string;
  jobId: string;
  type: 'event_meta' | 'stats' | 'sponsor_item' | 'upgrade' | 'add_on' | 'contact';
  rawText?: string;
  sourcePageNumbers?: number[];
  confidence: number;
  suggestedData: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected' | 'merged';
  reviewNotes?: string;
}
