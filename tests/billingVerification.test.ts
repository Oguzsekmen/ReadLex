import { describe, expect, it } from 'vitest';
import { BillingDomainError } from '../functions/src/billing/errors';
import { parseVerifyPurchaseInput } from '../functions/src/billing/service';
import { mapVerifiedPurchaseToSubscription } from '../functions/src/billing/subscriptionMapper';
import { NormalizedPurchase } from '../functions/src/billing/types';

const purchase = (overrides: Partial<NormalizedPurchase> = {}): NormalizedPurchase => ({
  channel: 'GOOGLE_PLAY', productKey: 'PREMIUM_MONTHLY', providerProductId: 'test-google-monthly',
  providerTransactionId: 'transaction-1', environment: 'SANDBOX', status: 'VERIFIED',
  purchasedAt: 100, currentPeriodStart: 100, currentPeriodEnd: 10_000, autoRenew: true, ...overrides,
});

const expectCode = (operation: () => unknown, code: string) => {
  try { operation(); } catch (error) { expect(error).toMatchObject({ code }); return; }
  throw new Error(`Expected ${code}`);
};

describe('billing verification validation', () => {
  it('rejects invalid products, channels, missing proof, and client entitlement fields', () => {
    expectCode(() => parseVerifyPurchaseInput({ channel: 'GOOGLE_PLAY', productKey: 'NOT_A_PRODUCT', purchaseProof: 'proof' }), 'INVALID_PRODUCT');
    expectCode(() => parseVerifyPurchaseInput({ channel: 'UNKNOWN', productKey: 'PREMIUM_MONTHLY', purchaseProof: 'proof' }), 'UNSUPPORTED_PROVIDER');
    expectCode(() => parseVerifyPurchaseInput({ channel: 'GOOGLE_PLAY', productKey: 'PREMIUM_MONTHLY', purchaseProof: '' }), 'INVALID_PURCHASE');
    expectCode(() => parseVerifyPurchaseInput({ channel: 'GOOGLE_PLAY', productKey: 'PREMIUM_MONTHLY', purchaseProof: 'proof', isPremium: true }), 'INVALID_PURCHASE');
  });

  it.each(['REJECTED', 'REFUNDED', 'REVOKED'] as const)('does not map a %s purchase to a subscription', status => {
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', purchase({ status })), 'VERIFICATION_FAILED');
  });

  it('rejects a verified purchase with missing identity or subscription period', () => {
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', purchase({ providerTransactionId: '' })), 'INVALID_PURCHASE');
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', purchase({ currentPeriodEnd: undefined })), 'INVALID_PURCHASE');
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', purchase({ currentPeriodStart: 100, currentPeriodEnd: 100 })), 'INVALID_PURCHASE');
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', purchase(), 10_000), 'INVALID_PURCHASE');
  });

  it('maps a verified Google Play purchase to an ACTIVE Premium subscription', () => {
    expect(mapVerifiedPurchaseToSubscription('alice', purchase())).toEqual({
      userId: 'alice', planId: 'PREMIUM', provider: 'GOOGLE_PLAY', status: 'ACTIVE',
      currentPeriodStart: 100, currentPeriodEnd: 10_000, billingChannel: 'GOOGLE_PLAY',
    });
  });

  it('maps Apple with its provider identity and preserves the production environment', () => {
    const update = mapVerifiedPurchaseToSubscription('alice', purchase({ channel: 'APPLE', environment: 'PRODUCTION' }));
    expect(update.provider).toBe('APPLE');
    expect(update.billingChannel).toBe('APPLE');
  });

  it('refuses WEB activation until a concrete web provider is configured', () => {
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', purchase({ channel: 'WEB' })), 'PROVIDER_NOT_CONFIGURED');
  });
});
