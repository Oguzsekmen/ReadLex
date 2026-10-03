import { HttpsError } from 'firebase-functions/v2/https';
import { BillingDomainError } from '../errors';
import { BillingProductKey, BillingVerificationRequest } from '../types';
import { BillingServiceDependencies, VerifyPurchaseResult, verifyPurchaseForUser } from '../service';
import { requireAppleProductId } from './catalog';
import { getAppleBillingProvider, AppleBillingProvider } from './provider';
import { ApplePurchaseRequest } from './types';

export type VerifyApplePurchaseInput = ApplePurchaseRequest;
export type AppleServiceDependencies = {
  getProvider?: () => AppleBillingProvider;
  getProviderProductId?: (productKey: BillingProductKey) => string;
  now?: () => number;
};

const productKeys = new Set<BillingProductKey>(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validProof = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 16_384;
const validUid = (uid: unknown): uid is string => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);

/** Client input cannot supply original transaction IDs, status, price, period, or UID. */
export const parseApplePurchaseInput = (raw: unknown): VerifyApplePurchaseInput => {
  if (!isRecord(raw) || Object.keys(raw).some(key => key !== 'productKey' && key !== 'signedTransactionInfo')) throw new BillingDomainError('INVALID_PURCHASE');
  if (!productKeys.has(raw.productKey as BillingProductKey)) throw new BillingDomainError('INVALID_PRODUCT');
  if (!validProof(raw.signedTransactionInfo)) throw new BillingDomainError('INVALID_PURCHASE');
  return { productKey: raw.productKey as BillingProductKey, signedTransactionInfo: raw.signedTransactionInfo };
};

export const verifyApplePurchaseForUser = async (uid: unknown, raw: unknown, dependencies: AppleServiceDependencies = {}): Promise<VerifyPurchaseResult> => {
  if (!validUid(uid)) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const input = parseApplePurchaseInput(raw);
  const provider = (dependencies.getProvider || getAppleBillingProvider)();
  const genericDependencies: BillingServiceDependencies = {
    getProvider: () => ({
      channel: 'APPLE',
      verifyPurchase: (request: BillingVerificationRequest) => {
        if (typeof request.proof !== 'string') throw new BillingDomainError('INVALID_PURCHASE');
        return provider.verifyApplePurchase({ productKey: request.productKey, signedTransactionInfo: request.proof });
      },
    }),
    getProviderProductId: (_channel, productKey) => (dependencies.getProviderProductId || requireAppleProductId)(productKey),
    now: dependencies.now,
  };
  return verifyPurchaseForUser(uid, { channel: 'APPLE', productKey: input.productKey, purchaseProof: input.signedTransactionInfo }, genericDependencies);
};

const callableError = (error: unknown): never => {
  if (error instanceof HttpsError) throw error;
  if (error instanceof BillingDomainError) {
    const code = error.code === 'INVALID_PRODUCT' || error.code === 'INVALID_PURCHASE' ? 'invalid-argument' : 'failed-precondition';
    throw new HttpsError(code, error.code);
  }
  throw new HttpsError('internal', 'Apple purchase verification failed.');
};

export const verifyApplePurchaseForAuthenticatedRequest = async (uid: string | undefined, raw: unknown): Promise<VerifyPurchaseResult> => {
  try { return await verifyApplePurchaseForUser(uid, raw); } catch (error) { return callableError(error); }
};
