import { HttpsError } from 'firebase-functions/v2/https';
import { getBillingProduct, requireProviderProductId } from '../catalog';
import { BillingDomainError } from '../errors';
import { BillingEnvironment, BillingProductKey } from '../types';
import { getWebBillingProvider, WebBillingProvider } from './provider';
import { VerifiedWebBillingEvent, WebBillingEventType, WebCheckoutResult } from './types';

export type CreateWebCheckoutInput = { productKey: BillingProductKey };
export type WebBillingDependencies = {
  getProvider?: () => WebBillingProvider;
  getProviderProductId?: (productKey: BillingProductKey) => string;
  environment?: BillingEnvironment;
};

const productKeys = new Set<BillingProductKey>(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']);
const eventTypes = new Set<WebBillingEventType>(['PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_EXPIRED', 'REFUNDED', 'REVOKED']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validUid = (uid: unknown): uid is string => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);

export const parseCreateWebCheckoutInput = (raw: unknown): CreateWebCheckoutInput => {
  if (!isRecord(raw) || Object.keys(raw).some(key => key !== 'productKey')) throw new BillingDomainError('INVALID_PURCHASE');
  if (!productKeys.has(raw.productKey as BillingProductKey)) throw new BillingDomainError('INVALID_PRODUCT');
  return { productKey: raw.productKey as BillingProductKey };
};

/** Defensive validation for a provider-verified result; it does not mutate billing state. */
export const normalizeVerifiedWebBillingEvent = (raw: unknown): VerifiedWebBillingEvent => {
  if (!isRecord(raw) || raw.verificationStatus !== 'VERIFIED' || raw.provider !== 'IYZICO' || !eventTypes.has(raw.eventType as WebBillingEventType) || (raw.environment !== 'SANDBOX' && raw.environment !== 'PRODUCTION') || typeof raw.providerTransactionId !== 'string' || !raw.providerTransactionId.trim()) throw new BillingDomainError('VERIFICATION_FAILED');
  return raw as VerifiedWebBillingEvent;
};

export const createWebCheckoutForUser = async (uid: unknown, raw: unknown, dependencies: WebBillingDependencies = {}): Promise<WebCheckoutResult> => {
  if (!validUid(uid)) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const input = parseCreateWebCheckoutInput(raw);
  const product = getBillingProduct(input.productKey);
  if (product.planId !== 'PREMIUM') throw new BillingDomainError('INVALID_PRODUCT');
  const providerProductId = (dependencies.getProviderProductId || ((key: BillingProductKey) => requireProviderProductId('WEB', key)))(input.productKey);
  const environment = dependencies.environment || 'SANDBOX';
  return (dependencies.getProvider || getWebBillingProvider)().createCheckoutSession({ uid, productKey: input.productKey, providerProductId, environment });
};

/** Future verified notifications must be converted into verifyPurchase input; no direct activation lives here. */
export const verifyWebProviderNotification = async (rawPayload: unknown, dependencies: WebBillingDependencies = {}): Promise<VerifiedWebBillingEvent> => {
  const event = await (dependencies.getProvider || getWebBillingProvider)().verifyNotification(rawPayload);
  return normalizeVerifiedWebBillingEvent(event);
};

const callableError = (error: unknown): never => {
  if (error instanceof HttpsError) throw error;
  if (error instanceof BillingDomainError) {
    const code = error.code === 'INVALID_PRODUCT' || error.code === 'INVALID_PURCHASE' ? 'invalid-argument' : 'failed-precondition';
    throw new HttpsError(code, error.code);
  }
  throw new HttpsError('internal', 'Web checkout could not be created.');
};

export const createWebCheckoutForAuthenticatedRequest = async (uid: string | undefined, raw: unknown): Promise<WebCheckoutResult> => {
  try { return await createWebCheckoutForUser(uid, raw); } catch (error) { return callableError(error); }
};
