import { BillingEnvironment, BillingProductKey, BillingPurchaseStatus, NormalizedPurchase } from '../types';

/** Opaque token emitted by a future native Play Billing adapter. */
export type GooglePlayPurchaseRequest = { productKey: BillingProductKey; purchaseToken: string };
export type GooglePlayPurchaseState = 'PURCHASED' | 'CANCELED' | 'REFUNDED' | 'REVOKED' | 'EXPIRED';

// Internal provider-adapter result only; this is not a guessed Play API payload.
export type GooglePlayVerifiedPayload = {
  productKey: BillingProductKey;
  providerProductId: string;
  orderId: string;
  subscriptionId?: string;
  environment: BillingEnvironment;
  purchaseState: GooglePlayPurchaseState;
  purchasedAt: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  autoRenew?: boolean;
};

export type GooglePlayRestoreRequest = GooglePlayPurchaseRequest;
export type GooglePlayAcknowledgementRequest = { purchaseToken: string };
export type GooglePlayNormalizedPurchase = NormalizedPurchase & { channel: 'GOOGLE_PLAY'; status: BillingPurchaseStatus };
