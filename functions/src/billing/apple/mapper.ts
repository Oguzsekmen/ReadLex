import { BillingDomainError } from '../errors';
import { AppleNormalizedPurchase, AppleVerifiedPayload } from './types';

const validMillis = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const statusFor = (state: AppleVerifiedPayload['purchaseState']): AppleNormalizedPurchase['status'] => {
  if (state === 'ACTIVE') return 'VERIFIED';
  if (state === 'REFUNDED') return 'REFUNDED';
  if (state === 'REVOKED') return 'REVOKED';
  if (state === 'EXPIRED') return 'EXPIRED';
  return 'REJECTED';
};

/** Converts verified Apple-adapter output to ReadLex's shared purchase model only. */
export const normalizeApplePurchase = (payload: AppleVerifiedPayload): AppleNormalizedPurchase => {
  if (!payload.transactionId.trim() || !payload.providerProductId.trim() || !validMillis(payload.purchasedAt)) throw new BillingDomainError('INVALID_PURCHASE');
  if (payload.environment !== 'SANDBOX' && payload.environment !== 'PRODUCTION') throw new BillingDomainError('INVALID_PURCHASE');
  if (payload.purchaseState === 'ACTIVE' && (!payload.originalTransactionId?.trim() || !validMillis(payload.currentPeriodStart) || !validMillis(payload.currentPeriodEnd) || payload.currentPeriodEnd <= payload.currentPeriodStart)) throw new BillingDomainError('INVALID_PURCHASE');
  return {
    channel: 'APPLE', productKey: payload.productKey, providerProductId: payload.providerProductId,
    providerTransactionId: payload.transactionId, ...(payload.originalTransactionId ? { providerSubscriptionId: payload.originalTransactionId } : {}),
    environment: payload.environment, status: statusFor(payload.purchaseState), purchasedAt: payload.purchasedAt,
    ...(typeof payload.currentPeriodStart === 'number' ? { currentPeriodStart: payload.currentPeriodStart } : {}),
    ...(typeof payload.currentPeriodEnd === 'number' ? { currentPeriodEnd: payload.currentPeriodEnd } : {}),
    ...(typeof payload.autoRenew === 'boolean' ? { autoRenew: payload.autoRenew } : {}),
  };
};
