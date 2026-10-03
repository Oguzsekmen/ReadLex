import { describe, expect, it } from 'vitest';
import { requireAppleProductId } from '../functions/src/billing/apple/catalog';
import { normalizeApplePurchase } from '../functions/src/billing/apple/mapper';
import { getAppleBillingProvider } from '../functions/src/billing/apple/provider';
import { parseApplePurchaseInput } from '../functions/src/billing/apple/service';
import { AppleVerifiedPayload } from '../functions/src/billing/apple/types';
import { mapVerifiedPurchaseToSubscription } from '../functions/src/billing/subscriptionMapper';

const payload = (overrides: Partial<AppleVerifiedPayload> = {}): AppleVerifiedPayload => ({
  productKey: 'PREMIUM_MONTHLY', providerProductId: 'test-apple-monthly', transactionId: 'apple-transaction-1', originalTransactionId: 'apple-original-1',
  environment: 'SANDBOX', purchaseState: 'ACTIVE', purchasedAt: 100, currentPeriodStart: 100, currentPeriodEnd: 10_000, autoRenew: true, ...overrides,
});
const expectCode = (operation: () => unknown, code: string) => {
  try { operation(); } catch (error) { expect(error).toMatchObject({ code }); return; }
  throw new Error(`Expected ${code}`);
};

describe('Apple billing boundary', () => {
  it('treats missing Apple product mapping as not configured', () => {
    expectCode(() => requireAppleProductId('PREMIUM_MONTHLY'), 'PROVIDER_NOT_CONFIGURED');
  });

  it('keeps the production Apple provider fail-closed', async () => {
    await expect(getAppleBillingProvider().verifyApplePurchase({ productKey: 'PREMIUM_MONTHLY', signedTransactionInfo: 'opaque-signed-transaction' })).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
  });

  it('rejects missing or malformed proofs and all client authority fields', () => {
    expectCode(() => parseApplePurchaseInput({ productKey: 'PREMIUM_MONTHLY' }), 'INVALID_PURCHASE');
    expectCode(() => parseApplePurchaseInput({ productKey: 'PREMIUM_MONTHLY', signedTransactionInfo: '' }), 'INVALID_PURCHASE');
    expectCode(() => parseApplePurchaseInput({ productKey: 'INVALID', signedTransactionInfo: 'proof' }), 'INVALID_PRODUCT');
    for (const extra of [{ uid: 'bob' }, { status: 'VERIFIED' }, { currentPeriodEnd: 999999 }, { price: 1 }, { originalTransactionId: 'untrusted' }, { verified: true }]) {
      expectCode(() => parseApplePurchaseInput({ productKey: 'PREMIUM_MONTHLY', signedTransactionInfo: 'proof', ...extra }), 'INVALID_PURCHASE');
    }
  });

  it.each(['CANCELED', 'REFUNDED', 'REVOKED', 'EXPIRED'] as const)('normalizes %s as non-verified and cannot activate a subscription', state => {
    const normalized = normalizeApplePurchase(payload({ purchaseState: state }));
    expect(normalized.status).not.toBe('VERIFIED');
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', normalized), 'VERIFICATION_FAILED');
  });

  it('rejects missing transaction identity, original transaction, and invalid periods', () => {
    expectCode(() => normalizeApplePurchase(payload({ transactionId: '' })), 'INVALID_PURCHASE');
    expectCode(() => normalizeApplePurchase(payload({ originalTransactionId: '' })), 'INVALID_PURCHASE');
    expectCode(() => normalizeApplePurchase(payload({ currentPeriodEnd: undefined })), 'INVALID_PURCHASE');
    expectCode(() => normalizeApplePurchase(payload({ currentPeriodStart: 100, currentPeriodEnd: 100 })), 'INVALID_PURCHASE');
  });

  it('normalizes a fake verified Apple purchase, preserves environment, and retains original transaction identity', () => {
    const normalized = normalizeApplePurchase(payload({ environment: 'PRODUCTION' }));
    expect(normalized).toMatchObject({ channel: 'APPLE', status: 'VERIFIED', environment: 'PRODUCTION', providerSubscriptionId: 'apple-original-1' });
    expect(mapVerifiedPurchaseToSubscription('alice', normalized).provider).toBe('APPLE');
  });
});
