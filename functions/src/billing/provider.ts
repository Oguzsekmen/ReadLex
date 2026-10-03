import { BillingDomainError } from './errors';
import { BillingChannel, BillingVerificationRequest, NormalizedPurchase } from './types';

/**
 * Future provider adapters verify a purchase server-side before any subscription
 * write. Implementations must never treat a client purchase assertion as verified.
 */
export interface BillingProvider {
  readonly channel: BillingChannel;
  verifyPurchase(request: BillingVerificationRequest): Promise<NormalizedPurchase>;
}

abstract class UnconfiguredBillingProvider implements BillingProvider {
  abstract readonly channel: BillingChannel;

  async verifyPurchase(_request: BillingVerificationRequest): Promise<NormalizedPurchase> {
    throw new BillingDomainError('PROVIDER_NOT_CONFIGURED');
  }
}

export class WebBillingProvider extends UnconfiguredBillingProvider {
  readonly channel = 'WEB' as const;
}

export class GooglePlayBillingProvider extends UnconfiguredBillingProvider {
  readonly channel = 'GOOGLE_PLAY' as const;
}

export class AppleBillingProvider extends UnconfiguredBillingProvider {
  readonly channel = 'APPLE' as const;
}

const providers: Readonly<Record<BillingChannel, BillingProvider>> = {
  WEB: new WebBillingProvider(),
  GOOGLE_PLAY: new GooglePlayBillingProvider(),
  APPLE: new AppleBillingProvider(),
};

export const getBillingProvider = (channel: string): BillingProvider => {
  if (channel === 'WEB' || channel === 'GOOGLE_PLAY' || channel === 'APPLE') return providers[channel];
  throw new BillingDomainError('UNSUPPORTED_PROVIDER');
};
