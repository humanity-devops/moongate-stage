import { prisma } from '@moongate/db';
import { computeProcessingFee, resolveProfile, type ProcessingFeeProfile } from './processingFees.js';

export const DEFAULT_COMMISSION_RATE = 0.08; // 8%

/**
 * Compute the effective platform fee for a given order.
 * Precedence: event override > merchant override > platform default (8%)
 * Also computes the processing fee based on the tenant's profile.
 */
export async function computeFee(orderId: string): Promise<{
  rate: number;
  feeAmount: number;
  merchantNet: number;
  source: 'event_override' | 'merchant_override' | 'default';
  processingFeeProfile: ProcessingFeeProfile;
  processingFeeRate: number;
  processingFeeAmount: number;
}> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      event: { select: { commissionRate: true } },
      tenant: { select: { commissionRate: true, processingFeeProfile: true } },
    },
  });

  const total = Number(order.fullAmount ?? order.total);

  let rate: number;
  let source: 'event_override' | 'merchant_override' | 'default';

  if (order.event.commissionRate !== null) {
    rate = Number(order.event.commissionRate);
    source = 'event_override';
  } else if (order.tenant.commissionRate !== null) {
    rate = Number(order.tenant.commissionRate);
    source = 'merchant_override';
  } else {
    rate = DEFAULT_COMMISSION_RATE;
    source = 'default';
  }

  const feeAmount = Math.round(total * rate * 100) / 100;
  const merchantNet = Math.round((total - feeAmount) * 100) / 100;

  const processingFeeProfile = resolveProfile(order.tenant.processingFeeProfile);
  const { rate: processingFeeRate, feeAmount: processingFeeAmount } = computeProcessingFee(total, processingFeeProfile);

  return { rate, feeAmount, merchantNet, source, processingFeeProfile, processingFeeRate, processingFeeAmount };
}

export function toDecimalStr(n: number): string {
  return n.toFixed(4);
}
