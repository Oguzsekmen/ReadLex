import { BillingEnvironment, BillingProductKey, BillingPurchaseStatus, NormalizedPurchase } from '../types';

/** Opaque signed StoreKit transaction evidence from a future native adapter. */
export type ApplePurchaseRequest = { productKey: BillingProductKey; signedTransactionInfo: string };
export type ApplePurchaseState = 'ACTIVE' | 'CANCELED' | 'REFUNDED' | 'REVOKED' | 'EXPIRED';

// Internal verified-adapter output, deliberately not an App Store API payload model.
export type AppleVerifiedPayload = {
  productKey: BillingProductKey;
  providerProductId: string;
  transactionId: string;
  originalTransactionId?: string;
  environment: BillingEnvironment;
  purchaseState: ApplePurchaseState;
  purchasedAt: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  autoRenew?: boolean;
};

export type AppleRestoreRequest = ApplePurchaseRequest;
export type AppleNormalizedPurchase = NormalizedPurchase & { channel: 'APPLE'; status: BillingPurchaseStatus };
