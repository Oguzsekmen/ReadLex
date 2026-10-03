import { BillingDomainError } from '../errors';
import { GooglePlayNormalizedPurchase, GooglePlayVerifiedPayload } from './types';

const validMillis = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const statusFor = (state: GooglePlayVerifiedPayload['purchaseState']): GooglePlayNormalizedPurchase['status'] => {
  if (state === 'PURCHASED') return 'VERIFIED';
  if (state === 'REFUNDED') return 'REFUNDED';
  if (state === 'REVOKED') return 'REVOKED';
  if (state === 'EXPIRED') return 'EXPIRED';
  return 'REJECTED';
};

/** Converts only already-verified provider output into the shared purchase model. */
export const normalizeGooglePlayPurchase = (payload: GooglePlayVerifiedPayload): GooglePlayNormalizedPurchase => {
  if (!payload.orderId.trim() || !payload.providerProductId.trim() || !validMillis(payload.purchasedAt)) throw new BillingDomainError('INVALID_PURCHASE');
  if (payload.environment !== 'SANDBOX' && payload.environment !== 'PRODUCTION') throw new BillingDomainError('INVALID_PURCHASE');
  if (payload.purchaseState === 'PURCHASED' && (!validMillis(payload.currentPeriodStart) || !validMillis(payload.currentPeriodEnd) || payload.currentPeriodEnd <= payload.currentPeriodStart)) throw new BillingDomainError('INVALID_PURCHASE');
  return {
    channel: 'GOOGLE_PLAY', productKey: payload.productKey, providerProductId: payload.providerProductId,
    providerTransactionId: payload.orderId, ...(payload.subscriptionId ? { providerSubscriptionId: payload.subscriptionId } : {}),
    environment: payload.environment, status: statusFor(payload.purchaseState), purchasedAt: payload.purchasedAt,
    ...(typeof payload.currentPeriodStart === 'number' ? { currentPeriodStart: payload.currentPeriodStart } : {}),
    ...(typeof payload.currentPeriodEnd === 'number' ? { currentPeriodEnd: payload.currentPeriodEnd } : {}),
    ...(typeof payload.autoRenew === 'boolean' ? { autoRenew: payload.autoRenew } : {}),
  };
};
