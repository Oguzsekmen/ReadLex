import { HttpsError } from 'firebase-functions/v2/https';
import { BillingDomainError } from '../errors';
import { BillingProductKey, BillingVerificationRequest } from '../types';
import { BillingServiceDependencies, VerifyPurchaseResult, verifyPurchaseForUser } from '../service';
import { requireGooglePlayProductId } from './catalog';
import { getGooglePlayBillingProvider, GooglePlayBillingProvider } from './provider';
import { GooglePlayPurchaseRequest } from './types';

export type VerifyGooglePlayPurchaseInput = GooglePlayPurchaseRequest;
export type GooglePlayServiceDependencies = {
  getProvider?: () => GooglePlayBillingProvider;
  getProviderProductId?: (productKey: BillingProductKey) => string;
  now?: () => number;
};

const productKeys = new Set<BillingProductKey>(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validToken = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 8_192;
const validUid = (uid: unknown): uid is string => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);

/** Strict token envelope: expiry, price, status, and UID are never client input. */
export const parseGooglePlayPurchaseInput = (raw: unknown): VerifyGooglePlayPurchaseInput => {
  if (!isRecord(raw) || Object.keys(raw).some(key => key !== 'productKey' && key !== 'purchaseToken')) throw new BillingDomainError('INVALID_PURCHASE');
  if (!productKeys.has(raw.productKey as BillingProductKey)) throw new BillingDomainError('INVALID_PRODUCT');
  if (!validToken(raw.purchaseToken)) throw new BillingDomainError('INVALID_PURCHASE');
  return { productKey: raw.productKey as BillingProductKey, purchaseToken: raw.purchaseToken };
};

export const verifyGooglePlayPurchaseForUser = async (uid: unknown, raw: unknown, dependencies: GooglePlayServiceDependencies = {}): Promise<VerifyPurchaseResult> => {
  if (!validUid(uid)) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const input = parseGooglePlayPurchaseInput(raw);
  const provider = (dependencies.getProvider || getGooglePlayBillingProvider)();
  const genericDependencies: BillingServiceDependencies = {
    getProvider: () => ({
      channel: 'GOOGLE_PLAY',
      verifyPurchase: (request: BillingVerificationRequest) => {
        if (typeof request.proof !== 'string') throw new BillingDomainError('INVALID_PURCHASE');
        return provider.verifyGooglePlayPurchase({ productKey: request.productKey, purchaseToken: request.proof });
      },
    }),
    getProviderProductId: (_channel, productKey) => (dependencies.getProviderProductId || requireGooglePlayProductId)(productKey),
    now: dependencies.now,
  };
  return verifyPurchaseForUser(uid, { channel: 'GOOGLE_PLAY', productKey: input.productKey, purchaseProof: input.purchaseToken }, genericDependencies);
};

const callableError = (error: unknown): never => {
  if (error instanceof HttpsError) throw error;
  if (error instanceof BillingDomainError) {
    const code = error.code === 'INVALID_PRODUCT' || error.code === 'INVALID_PURCHASE' ? 'invalid-argument' : 'failed-precondition';
    throw new HttpsError(code, error.code);
  }
  throw new HttpsError('internal', 'Google Play verification failed.');
};

export const verifyGooglePlayPurchaseForAuthenticatedRequest = async (uid: string | undefined, raw: unknown): Promise<VerifyPurchaseResult> => {
  try { return await verifyGooglePlayPurchaseForUser(uid, raw); } catch (error) { return callableError(error); }
};
