import { BillingDomainError } from '../errors';
import { NormalizedPurchase } from '../types';
import { ApplePurchaseRequest } from './types';

/** Future adapter verifies StoreKit/JWS evidence server-side before activation. */
export interface AppleBillingProvider {
  readonly channel: 'APPLE';
  verifyApplePurchase(request: ApplePurchaseRequest): Promise<NormalizedPurchase>;
}

class UnconfiguredAppleBillingProvider implements AppleBillingProvider {
  readonly channel = 'APPLE' as const;
  async verifyApplePurchase(_request: ApplePurchaseRequest): Promise<NormalizedPurchase> { throw new BillingDomainError('PROVIDER_NOT_CONFIGURED'); }
}

// No StoreKit plugin, Apple API client, JWT signer, issuer/key ID, or private key is used here.
export const getAppleBillingProvider = (): AppleBillingProvider => new UnconfiguredAppleBillingProvider();
