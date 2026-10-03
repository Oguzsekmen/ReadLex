import { describe, expect, it } from 'vitest';
import { BILLING_CATALOG, getBillingProduct, requireProviderProductId } from '../functions/src/billing/catalog';
import { BillingDomainError } from '../functions/src/billing/errors';
import { AppleBillingProvider, getBillingProvider, GooglePlayBillingProvider, WebBillingProvider } from '../functions/src/billing/provider';
import { BillingChannel, BillingVerificationRequest } from '../functions/src/billing/types';

const request: BillingVerificationRequest = { productKey: 'PREMIUM_MONTHLY', providerTransactionId: 'untrusted-client-transaction', environment: 'SANDBOX' };
const expectCode = async (operation: () => Promise<unknown> | unknown, code: string) => {
  await expect(operation()).rejects.toMatchObject({ code });
};

describe('provider-neutral billing domain', () => {
  it('defines monthly and yearly logical products with PREMIUM semantics', () => {
    expect(Object.keys(BILLING_CATALOG)).toEqual(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']);
    expect(getBillingProduct('PREMIUM_MONTHLY')).toMatchObject({ planId: 'PREMIUM', entitlement: 'PREMIUM', billingPeriod: 'MONTH' });
    expect(getBillingProduct('PREMIUM_YEARLY')).toMatchObject({ planId: 'PREMIUM', entitlement: 'PREMIUM', billingPeriod: 'YEAR' });
  });

  it('treats every missing provider product mapping as not configured', () => {
    for (const channel of ['WEB', 'GOOGLE_PLAY', 'APPLE'] as BillingChannel[]) {
      expect(() => requireProviderProductId(channel, 'PREMIUM_MONTHLY')).toThrow(BillingDomainError);
      try { requireProviderProductId(channel, 'PREMIUM_YEARLY'); } catch (error) { expect(error).toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' }); }
    }
  });

  it('resolves each supported channel to its isolated provider stub', () => {
    expect(getBillingProvider('WEB')).toBeInstanceOf(WebBillingProvider);
    expect(getBillingProvider('GOOGLE_PLAY')).toBeInstanceOf(GooglePlayBillingProvider);
    expect(getBillingProvider('APPLE')).toBeInstanceOf(AppleBillingProvider);
  });

  it('fails closed for an unknown provider', () => {
    expect(() => getBillingProvider('UNKNOWN')).toThrow(BillingDomainError);
    try { getBillingProvider('UNKNOWN'); } catch (error) { expect(error).toMatchObject({ code: 'UNSUPPORTED_PROVIDER' }); }
  });

  it('never verifies a WEB purchase while the provider is unconfigured', async () => {
    await expectCode(() => getBillingProvider('WEB').verifyPurchase(request), 'PROVIDER_NOT_CONFIGURED');
  });

  it('never verifies a Google Play purchase while the provider is unconfigured', async () => {
    await expectCode(() => getBillingProvider('GOOGLE_PLAY').verifyPurchase(request), 'PROVIDER_NOT_CONFIGURED');
  });

  it('never verifies an Apple purchase while the provider is unconfigured', async () => {
    await expectCode(() => getBillingProvider('APPLE').verifyPurchase(request), 'PROVIDER_NOT_CONFIGURED');
  });

  it('does not yield a verified or premium purchase from any stub', async () => {
    const results = await Promise.allSettled((['WEB', 'GOOGLE_PLAY', 'APPLE'] as const).map(channel => getBillingProvider(channel).verifyPurchase(request)));
    expect(results.every(result => result.status === 'rejected' && (result.reason as BillingDomainError).code === 'PROVIDER_NOT_CONFIGURED')).toBe(true);
  });
});
