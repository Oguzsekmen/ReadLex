import { describe, expect, it } from 'vitest';
import { requireGooglePlayProductId } from '../functions/src/billing/googlePlay/catalog';
import { normalizeGooglePlayPurchase } from '../functions/src/billing/googlePlay/mapper';
import { getGooglePlayBillingProvider } from '../functions/src/billing/googlePlay/provider';
import { parseGooglePlayPurchaseInput } from '../functions/src/billing/googlePlay/service';
import { GooglePlayVerifiedPayload } from '../functions/src/billing/googlePlay/types';
import { mapVerifiedPurchaseToSubscription } from '../functions/src/billing/subscriptionMapper';

const payload = (overrides: Partial<GooglePlayVerifiedPayload> = {}): GooglePlayVerifiedPayload => ({
  productKey: 'PREMIUM_MONTHLY', providerProductId: 'test-play-monthly', orderId: 'GPA.1', environment: 'SANDBOX',
  purchaseState: 'PURCHASED', purchasedAt: 100, currentPeriodStart: 100, currentPeriodEnd: 10_000, autoRenew: true, ...overrides,
});
const expectCode = (operation: () => unknown, code: string) => {
  try { operation(); } catch (error) { expect(error).toMatchObject({ code }); return; }
  throw new Error(`Expected ${code}`);
};

describe('Google Play billing boundary', () => {
  it('treats missing Google Play product mapping as not configured', () => {
    expectCode(() => requireGooglePlayProductId('PREMIUM_MONTHLY'), 'PROVIDER_NOT_CONFIGURED');
  });

  it('keeps the production Google Play provider fail-closed', async () => {
    await expect(getGooglePlayBillingProvider().verifyGooglePlayPurchase({ productKey: 'PREMIUM_MONTHLY', purchaseToken: 'opaque-token' })).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    await expect(getGooglePlayBillingProvider().acknowledgePurchase({ purchaseToken: 'opaque-token' })).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
  });

  it('rejects missing or malformed tokens and all client subscription authority fields', () => {
    expectCode(() => parseGooglePlayPurchaseInput({ productKey: 'PREMIUM_MONTHLY' }), 'INVALID_PURCHASE');
    expectCode(() => parseGooglePlayPurchaseInput({ productKey: 'PREMIUM_MONTHLY', purchaseToken: '' }), 'INVALID_PURCHASE');
    expectCode(() => parseGooglePlayPurchaseInput({ productKey: 'INVALID', purchaseToken: 'token' }), 'INVALID_PRODUCT');
    for (const extra of [{ uid: 'bob' }, { status: 'VERIFIED' }, { currentPeriodEnd: 999999 }, { price: 1 }, { verified: true }]) {
      expectCode(() => parseGooglePlayPurchaseInput({ productKey: 'PREMIUM_MONTHLY', purchaseToken: 'token', ...extra }), 'INVALID_PURCHASE');
    }
  });

  it.each(['CANCELED', 'REFUNDED', 'REVOKED', 'EXPIRED'] as const)('normalizes %s as non-verified and cannot activate a subscription', state => {
    const normalized = normalizeGooglePlayPurchase(payload({ purchaseState: state }));
    expect(normalized.status).not.toBe('VERIFIED');
    expectCode(() => mapVerifiedPurchaseToSubscription('alice', normalized), 'VERIFICATION_FAILED');
  });

  it('rejects missing order identity and invalid subscription periods', () => {
    expectCode(() => normalizeGooglePlayPurchase(payload({ orderId: '' })), 'INVALID_PURCHASE');
    expectCode(() => normalizeGooglePlayPurchase(payload({ currentPeriodEnd: undefined })), 'INVALID_PURCHASE');
    expectCode(() => normalizeGooglePlayPurchase(payload({ currentPeriodStart: 100, currentPeriodEnd: 100 })), 'INVALID_PURCHASE');
  });

  it('normalizes a fake verified purchase into GOOGLE_PLAY and preserves environment', () => {
    const normalized = normalizeGooglePlayPurchase(payload({ environment: 'PRODUCTION', subscriptionId: 'subscription-1' }));
    expect(normalized).toMatchObject({ channel: 'GOOGLE_PLAY', status: 'VERIFIED', environment: 'PRODUCTION', providerTransactionId: 'GPA.1' });
    expect(mapVerifiedPurchaseToSubscription('alice', normalized).provider).toBe('GOOGLE_PLAY');
  });
});
