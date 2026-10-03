import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { getEntitlements } from '../subscriptions/service';
import { BillingDomainError } from './errors';
import { getBillingProduct, requireProviderProductId } from './catalog';
import { getBillingProvider, BillingProvider } from './provider';
import { mapVerifiedPurchaseToSubscription } from './subscriptionMapper';
import { BillingChannel, BillingProductKey, BillingVerificationRequest, NormalizedPurchase } from './types';

export type VerifyPurchaseInput = { channel: BillingChannel; productKey: BillingProductKey; purchaseProof: unknown };
export type VerifyPurchaseResult = { verificationStatus: 'VERIFIED'; productKey: BillingProductKey; entitlement: Awaited<ReturnType<typeof getEntitlements>>; alreadyProcessed: boolean };
export type BillingServiceDependencies = {
  getProvider?: (channel: string) => BillingProvider;
  getProviderProductId?: (channel: BillingChannel, productKey: BillingProductKey) => string;
  now?: () => number;
};

const channels = new Set<BillingChannel>(['WEB', 'GOOGLE_PLAY', 'APPLE']);
const productKeys = new Set<BillingProductKey>(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasProof = (proof: unknown) => typeof proof === 'string' ? proof.trim().length > 0 : isRecord(proof) && Object.keys(proof).length > 0;
const validUid = (uid: unknown): uid is string => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);

/** Strict generic envelope validation; provider adapters own proof interpretation. */
export const parseVerifyPurchaseInput = (raw: unknown): VerifyPurchaseInput => {
  if (!isRecord(raw) || Object.keys(raw).some(key => key !== 'channel' && key !== 'productKey' && key !== 'purchaseProof')) throw new BillingDomainError('INVALID_PURCHASE');
  if (!channels.has(raw.channel as BillingChannel)) throw new BillingDomainError('UNSUPPORTED_PROVIDER');
  if (!productKeys.has(raw.productKey as BillingProductKey)) throw new BillingDomainError('INVALID_PRODUCT');
  if (!hasProof(raw.purchaseProof)) throw new BillingDomainError('INVALID_PURCHASE');
  return { channel: raw.channel as BillingChannel, productKey: raw.productKey as BillingProductKey, purchaseProof: raw.purchaseProof };
};

const paymentId = (purchase: NormalizedPurchase) => createHash('sha256').update(`${purchase.channel}:${purchase.environment}:${purchase.providerTransactionId}`).digest('hex');
export const billingPaymentId = paymentId;

const validateProviderPurchase = (input: VerifyPurchaseInput, expectedProductId: string, purchase: NormalizedPurchase) => {
  if (purchase.channel !== input.channel || purchase.productKey !== input.productKey || purchase.providerProductId !== expectedProductId) throw new BillingDomainError('INVALID_PURCHASE');
};

/**
 * Server-only verification boundary. Production uses fail-closed stubs; tests
 * inject a fake provider and mapping without altering the production registry.
 */
export const verifyPurchaseForUser = async (uid: unknown, raw: unknown, dependencies: BillingServiceDependencies = {}): Promise<VerifyPurchaseResult> => {
  if (!validUid(uid)) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const input = parseVerifyPurchaseInput(raw);
  const product = getBillingProduct(input.productKey);
  if (product.planId !== 'PREMIUM') throw new BillingDomainError('INVALID_PRODUCT');
  const getProductId = dependencies.getProviderProductId || requireProviderProductId;
  const expectedProductId = getProductId(input.channel, input.productKey);
  const provider = (dependencies.getProvider || getBillingProvider)(input.channel);
  if (provider.channel !== input.channel) throw new BillingDomainError('INVALID_PURCHASE');
  const request: BillingVerificationRequest = { productKey: input.productKey, proof: input.purchaseProof };
  const purchase = await provider.verifyPurchase(request);
  validateProviderPurchase(input, expectedProductId, purchase);
  const now = dependencies.now?.() ?? Date.now();
  const subscription = mapVerifiedPurchaseToSubscription(uid, purchase, now);
  const payment = adminDb.collection('payments').doc(paymentId(purchase));
  const subscriptionRef = adminDb.collection('subscriptions').doc(uid);

  const outcome = await adminDb.runTransaction(async tx => {
    const [existingPayment, existingSubscription] = await Promise.all([tx.get(payment), tx.get(subscriptionRef)]);
    if (existingPayment.exists) {
      const stored = existingPayment.data() || {};
      if (stored.userId !== uid) throw new BillingDomainError('INVALID_PURCHASE');
      return { verificationStatus: 'VERIFIED' as const, productKey: purchase.productKey, alreadyProcessed: true };
    }
    tx.create(payment, {
      id: payment.id,
      userId: uid,
      channel: purchase.channel,
      provider: purchase.channel,
      productKey: purchase.productKey,
      providerProductId: purchase.providerProductId,
      providerTransactionId: purchase.providerTransactionId,
      ...(purchase.providerSubscriptionId ? { providerSubscriptionId: purchase.providerSubscriptionId } : {}),
      environment: purchase.environment,
      status: 'VERIFIED',
      purchasedAt: purchase.purchasedAt,
      currentPeriodStart: purchase.currentPeriodStart,
      currentPeriodEnd: purchase.currentPeriodEnd,
      ...(typeof purchase.autoRenew === 'boolean' ? { autoRenew: purchase.autoRenew } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(subscriptionRef, {
      ...subscription,
      createdAt: existingSubscription.exists ? (existingSubscription.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { verificationStatus: 'VERIFIED' as const, productKey: purchase.productKey, alreadyProcessed: false };
  });
  return { ...outcome, entitlement: await getEntitlements(uid, now) };
};

const callableError = (error: unknown): never => {
  if (error instanceof HttpsError) throw error;
  if (error instanceof BillingDomainError) {
    const code = error.code === 'INVALID_PRODUCT' || error.code === 'INVALID_PURCHASE' || error.code === 'UNSUPPORTED_PROVIDER' ? 'invalid-argument' : 'failed-precondition';
    throw new HttpsError(code, error.code);
  }
  throw new HttpsError('internal', 'Purchase verification failed.');
};

export const verifyPurchaseForAuthenticatedRequest = async (uid: string | undefined, raw: unknown): Promise<VerifyPurchaseResult> => {
  try { return await verifyPurchaseForUser(uid, raw); } catch (error) { return callableError(error); }
};
