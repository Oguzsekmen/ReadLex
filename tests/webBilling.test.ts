import { describe, expect, it } from 'vitest';
import { BillingDomainError } from '../functions/src/billing/errors';
import { WebBillingProvider } from '../functions/src/billing/web/provider';
import { createWebCheckoutForUser, normalizeVerifiedWebBillingEvent, parseCreateWebCheckoutInput, verifyWebProviderNotification } from '../functions/src/billing/web/service';

const expectCode = async (operation: () => Promise<unknown> | unknown, code: string) => {
  await expect(operation()).rejects.toMatchObject({ code });
};

const fakeProvider = (overrides: Partial<WebBillingProvider> = {}): WebBillingProvider => ({
  providerName: 'IYZICO',
  createCheckoutSession: async request => ({ provider: 'IYZICO', checkoutSessionId: `session-${request.uid}`, environment: request.environment }),
  verifyNotification: async () => ({ verificationStatus: 'VERIFIED', provider: 'IYZICO', eventType: 'PAYMENT_SUCCEEDED', environment: 'SANDBOX', providerTransactionId: 'transaction-1' }),
  ...overrides,
});

describe('WEB billing adapter boundary', () => {
  it('fails closed while WEB provider configuration is absent', async () => {
    await expectCode(() => createWebCheckoutForUser('alice', { productKey: 'PREMIUM_MONTHLY' }), 'PROVIDER_NOT_CONFIGURED');
    await expectCode(() => verifyWebProviderNotification({ untrusted: true }), 'PROVIDER_NOT_CONFIGURED');
  });

  it('accepts a logical product only through trusted configuration and preserves environment', async () => {
    let received: unknown;
    const result = await createWebCheckoutForUser('alice', { productKey: 'PREMIUM_YEARLY' }, {
      getProviderProductId: key => `configured-${key}`,
      environment: 'PRODUCTION',
      getProvider: () => fakeProvider({ createCheckoutSession: async request => { received = request; return { provider: 'IYZICO', checkoutSessionId: 'safe-session', environment: request.environment }; } }),
    });
    expect(result).toEqual({ provider: 'IYZICO', checkoutSessionId: 'safe-session', environment: 'PRODUCTION' });
    expect(received).toEqual({ uid: 'alice', productKey: 'PREMIUM_YEARLY', providerProductId: 'configured-PREMIUM_YEARLY', environment: 'PRODUCTION' });
  });

  it('rejects client price, currency, uid, plan, and status fields', () => {
    for (const extra of [{ price: 1 }, { currency: 'TRY' }, { uid: 'bob' }, { planId: 'PREMIUM' }, { status: 'PAID' }]) {
      expect(() => parseCreateWebCheckoutInput({ productKey: 'PREMIUM_MONTHLY', ...extra })).toThrow(BillingDomainError);
    }
  });

  it('rejects an invalid logical product', () => {
    expect(() => parseCreateWebCheckoutInput({ productKey: 'PREMIUM_LIFETIME' })).toThrow(BillingDomainError);
  });

  it('normalizes only an adapter-verified event and preserves its environment', () => {
    expect(normalizeVerifiedWebBillingEvent({ verificationStatus: 'VERIFIED', provider: 'IYZICO', eventType: 'SUBSCRIPTION_RENEWED', environment: 'PRODUCTION', providerTransactionId: 'transaction-2' })).toMatchObject({ eventType: 'SUBSCRIPTION_RENEWED', environment: 'PRODUCTION' });
  });

  it('rejects unverified callback output and performs no payment or subscription mutation', async () => {
    await expectCode(() => verifyWebProviderNotification({ anything: true }, { getProvider: () => fakeProvider({ verifyNotification: async () => ({ verificationStatus: 'UNVERIFIED' } as never) }) }), 'VERIFICATION_FAILED');
  });
});
