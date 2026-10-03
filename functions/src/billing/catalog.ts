import { BillingChannel, BillingProduct, BillingProductKey } from './types';
import { BillingDomainError } from './errors';

export const BILLING_CATALOG: Readonly<Record<BillingProductKey, BillingProduct>> = {
  PREMIUM_MONTHLY: { key: 'PREMIUM_MONTHLY', planId: 'PREMIUM', entitlement: 'PREMIUM', billingPeriod: 'MONTH' },
  PREMIUM_YEARLY: { key: 'PREMIUM_YEARLY', planId: 'PREMIUM', entitlement: 'PREMIUM', billingPeriod: 'YEAR' },
};

// Provider IDs are deliberately absent until each provider account is configured.
const providerProductIds: Readonly<Partial<Record<BillingChannel, Partial<Record<BillingProductKey, string>>>>> = {};

export const getBillingProduct = (key: BillingProductKey): BillingProduct => BILLING_CATALOG[key];

export const requireProviderProductId = (channel: BillingChannel, key: BillingProductKey): string => {
  const productId = providerProductIds[channel]?.[key];
  if (!productId) throw new BillingDomainError('PROVIDER_NOT_CONFIGURED');
  return productId;
};
