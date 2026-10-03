import { BillingEnvironment, BillingProductKey } from '../types';

/** `IYZICO` is a future option, never an implicitly configured provider. */
export type WebBillingProviderName = 'NONE' | 'IYZICO';
export type WebBillingEventType = 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_RENEWED' | 'SUBSCRIPTION_CANCELED' | 'SUBSCRIPTION_EXPIRED' | 'REFUNDED' | 'REVOKED';

// Trusted server data only: callers cannot supply price, currency, or user identity.
export type WebCheckoutRequest = {
  uid: string;
  productKey: BillingProductKey;
  providerProductId: string;
  environment: BillingEnvironment;
};

export type WebCheckoutResult = {
  provider: Exclude<WebBillingProviderName, 'NONE'>;
  checkoutSessionId: string;
  checkoutUrl?: string;
  expiresAt?: number;
  environment: BillingEnvironment;
};

// Shape reserved for trusted configuration; values stay absent until a provider is approved.
export type WebProductConfiguration = {
  productKey: BillingProductKey;
  providerProductId?: string;
  currency?: string;
  displayPrice?: string;
};

export type VerifiedWebBillingEvent = {
  verificationStatus: 'VERIFIED';
  provider: Exclude<WebBillingProviderName, 'NONE'>;
  eventType: WebBillingEventType;
  environment: BillingEnvironment;
  providerTransactionId: string;
};
