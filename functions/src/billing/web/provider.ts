import { BillingDomainError } from '../errors';
import { WebCheckoutRequest, WebCheckoutResult, WebBillingProviderName, VerifiedWebBillingEvent } from './types';

/**
 * Concrete web adapters own hosted-checkout creation and signature verification.
 * Raw callback bodies are never trusted outside an adapter implementation.
 */
export interface WebBillingProvider {
  readonly providerName: WebBillingProviderName;
  createCheckoutSession(request: WebCheckoutRequest): Promise<WebCheckoutResult>;
  verifyNotification(rawPayload: unknown): Promise<VerifiedWebBillingEvent>;
}

class UnconfiguredWebBillingProvider implements WebBillingProvider {
  constructor(readonly providerName: WebBillingProviderName) {}

  async createCheckoutSession(_request: WebCheckoutRequest): Promise<WebCheckoutResult> {
    throw new BillingDomainError('PROVIDER_NOT_CONFIGURED');
  }

  async verifyNotification(_rawPayload: unknown): Promise<VerifiedWebBillingEvent> {
    throw new BillingDomainError('PROVIDER_NOT_CONFIGURED');
  }
}

/**
 * Configuration names (not credentials) are deliberately the only web-provider
 * dependency in this phase. Missing/unknown config always fails closed.
 */
export const getWebBillingProvider = (): WebBillingProvider => {
  const configured = process.env.WEB_BILLING_PROVIDER || 'NONE';
  if (configured === 'NONE') return new UnconfiguredWebBillingProvider('NONE');
  if (configured === 'IYZICO') return new UnconfiguredWebBillingProvider('IYZICO');
  return new UnconfiguredWebBillingProvider('NONE');
};
