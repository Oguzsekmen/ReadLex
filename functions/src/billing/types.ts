/**
 * Provider-neutral billing vocabulary. Purchase verification is intentionally
 * separate from subscription entitlement state: a VERIFIED purchase may later
 * update a subscription, while the Phase 6A resolver remains entitlement authority.
 */
export type BillingChannel = 'WEB' | 'GOOGLE_PLAY' | 'APPLE';
export type BillingEnvironment = 'SANDBOX' | 'PRODUCTION';
export type BillingProductKey = 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';
export type BillingPurchaseStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REFUNDED' | 'REVOKED' | 'EXPIRED';

export type BillingProduct = {
  key: BillingProductKey;
  planId: 'PREMIUM';
  entitlement: 'PREMIUM';
  billingPeriod: 'MONTH' | 'YEAR';
};

export type BillingVerificationRequest = {
  productKey: BillingProductKey;
  // Opaque client evidence. Only the concrete provider adapter may interpret it.
  proof: unknown;
};

export type NormalizedPurchase = {
  channel: BillingChannel;
  productKey: BillingProductKey;
  providerProductId: string;
  providerTransactionId: string;
  providerSubscriptionId?: string;
  environment: BillingEnvironment;
  purchasedAt: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  autoRenew?: boolean;
  status: BillingPurchaseStatus;
};
