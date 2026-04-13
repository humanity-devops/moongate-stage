/**
 * Payment processing fee profiles.
 * Applied on top of the platform commission.
 *
 * Profiles:
 *   stripe  — Stripe: 4.5%
 *   hipay   — FIAT / HiPay: 1.0%
 *   radom   — Radom / TON Pay: 0%
 */

export type ProcessingFeeProfile = 'stripe' | 'hipay' | 'radom';

export interface ProcessingFeeInfo {
  profile: ProcessingFeeProfile;
  label: string;
  rate: number;       // decimal, e.g. 0.045
  ratePct: string;    // display string, e.g. "4.5%"
  description: string;
}

export const PROCESSING_FEE_PROFILES: Record<ProcessingFeeProfile, ProcessingFeeInfo> = {
  stripe: {
    profile: 'stripe',
    label: 'Stripe',
    rate: 0.045,
    ratePct: '4.5%',
    description: 'Standard card processing via Stripe',
  },
  hipay: {
    profile: 'hipay',
    label: 'FIAT / HiPay',
    rate: 0.01,
    ratePct: '1.0%',
    description: 'Bank transfer and FIAT payments via HiPay',
  },
  radom: {
    profile: 'radom',
    label: 'Radom / TON Pay',
    rate: 0,
    ratePct: '0%',
    description: 'Crypto payments via Radom (TON)',
  },
};

export const DEFAULT_PROCESSING_FEE_PROFILE: ProcessingFeeProfile = 'stripe';

/**
 * Compute the processing fee for a given amount and profile.
 */
export function computeProcessingFee(
  amount: number,
  profile: ProcessingFeeProfile = DEFAULT_PROCESSING_FEE_PROFILE,
): { rate: number; feeAmount: number } {
  const info = PROCESSING_FEE_PROFILES[profile];
  const feeAmount = Math.round(amount * info.rate * 100) / 100;
  return { rate: info.rate, feeAmount };
}

/**
 * Resolve a tenant's processing fee profile, defaulting to 'stripe'.
 */
export function resolveProfile(raw: string | null | undefined): ProcessingFeeProfile {
  if (raw && raw in PROCESSING_FEE_PROFILES) return raw as ProcessingFeeProfile;
  return DEFAULT_PROCESSING_FEE_PROFILE;
}
