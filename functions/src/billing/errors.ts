export type BillingErrorCode = 'PROVIDER_NOT_CONFIGURED' | 'INVALID_PRODUCT' | 'INVALID_PURCHASE' | 'VERIFICATION_FAILED' | 'UNSUPPORTED_PROVIDER';

/** Safe domain error: provider internals and credentials never cross this boundary. */
export class BillingDomainError extends Error {
  constructor(public readonly code: BillingErrorCode) {
    super(code);
    this.name = 'BillingDomainError';
  }
}
