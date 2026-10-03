import { BillingDomainError } from '../errors';
import { NormalizedPurchase } from '../types';
import { GooglePlayAcknowledgementRequest, GooglePlayPurchaseRequest } from './types';

/**
 * A future adapter may call the official server verification API and then
 * acknowledge a verified purchase. Neither operation is client authority.
 */
export interface GooglePlayBillingProvider {
  readonly channel: 'GOOGLE_PLAY';
  verifyGooglePlayPurchase(request: GooglePlayPurchaseRequest): Promise<NormalizedPurchase>;
  acknowledgePurchase(request: GooglePlayAcknowledgementRequest): Promise<void>;
}

class UnconfiguredGooglePlayBillingProvider implements GooglePlayBillingProvider {
  readonly channel = 'GOOGLE_PLAY' as const;
  async verifyGooglePlayPurchase(_request: GooglePlayPurchaseRequest): Promise<NormalizedPurchase> { throw new BillingDomainError('PROVIDER_NOT_CONFIGURED'); }
  async acknowledgePurchase(_request: GooglePlayAcknowledgementRequest): Promise<void> { throw new BillingDomainError('PROVIDER_NOT_CONFIGURED'); }
}

// No Play SDK, Developer API client, product ID, or service account exists in this phase.
export const getGooglePlayBillingProvider = (): GooglePlayBillingProvider => new UnconfiguredGooglePlayBillingProvider();
