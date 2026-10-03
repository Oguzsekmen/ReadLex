import { getBillingProduct } from './catalog';
import { BillingDomainError } from './errors';
import { NormalizedPurchase } from './types';
import { SubscriptionProvider } from '../subscriptions/entitlements';

export type VerifiedSubscriptionUpdate = {
  userId: string;
  planId: 'PREMIUM';
  provider: SubscriptionProvider;
  status: 'ACTIVE';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  billingChannel: NormalizedPurchase['channel'];
};

const validMillis = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Maps only a complete provider-verified subscription purchase to Phase 6A data. */
export const mapVerifiedPurchaseToSubscription = (uid: string, purchase: NormalizedPurchase, now = 0): VerifiedSubscriptionUpdate => {
  if (purchase.status !== 'VERIFIED') throw new BillingDomainError('VERIFICATION_FAILED');
  if (!purchase.providerTransactionId.trim() || !purchase.providerProductId.trim() || !validMillis(purchase.purchasedAt)) throw new BillingDomainError('INVALID_PURCHASE');
  if (!validMillis(purchase.currentPeriodStart) || !validMillis(purchase.currentPeriodEnd) || purchase.currentPeriodEnd <= purchase.currentPeriodStart || purchase.currentPeriodEnd <= now) throw new BillingDomainError('INVALID_PURCHASE');
  if (purchase.environment !== 'SANDBOX' && purchase.environment !== 'PRODUCTION') throw new BillingDomainError('INVALID_PURCHASE');
  const product = getBillingProduct(purchase.productKey);
  if (product.planId !== 'PREMIUM' || product.entitlement !== 'PREMIUM') throw new BillingDomainError('INVALID_PRODUCT');
  // WEB has no concrete provider selected/configured; never label it as IYZICO.
  if (purchase.channel === 'WEB') throw new BillingDomainError('PROVIDER_NOT_CONFIGURED');
  return {
    userId: uid,
    planId: 'PREMIUM',
    provider: purchase.channel,
    status: 'ACTIVE',
    currentPeriodStart: purchase.currentPeriodStart,
    currentPeriodEnd: purchase.currentPeriodEnd,
    billingChannel: purchase.channel,
  };
};
