import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests';
const host = '127.0.0.1';
const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
process.env.GCLOUD_PROJECT = projectId;

const { adminDb } = await import('../functions/lib/admin.js');
const { verifyPurchaseForAuthenticatedRequest, verifyPurchaseForUser, billingPaymentId } = await import('../functions/lib/billing/service.js');
let env;
before(async () => { env = await initializeTestEnvironment({ projectId, firestore: { host, port } }); });
beforeEach(async () => env.clearFirestore());
after(async () => env.cleanup());

const input = { channel: 'GOOGLE_PLAY', productKey: 'PREMIUM_MONTHLY', purchaseProof: { receipt: 'fake-proof' } };
const purchase = (overrides = {}) => ({
  channel: 'GOOGLE_PLAY', productKey: 'PREMIUM_MONTHLY', providerProductId: 'fake-google-monthly',
  providerTransactionId: 'provider-transaction-1', environment: 'SANDBOX', status: 'VERIFIED',
  purchasedAt: 100, currentPeriodStart: 100, currentPeriodEnd: 10_000, autoRenew: true, ...overrides,
});
const fakeDependencies = (result = purchase()) => ({
  getProviderProductId: () => 'fake-google-monthly',
  getProvider: channel => ({ channel, verifyPurchase: async () => result }),
  now: () => 200,
});
const codeOf = async operation => {
  try { await operation(); } catch (error) { return error.code || error.message; }
  return undefined;
};

test('unauthenticated verification is rejected and invalid input cannot write', async () => {
  assert.equal(await codeOf(() => verifyPurchaseForAuthenticatedRequest(undefined, input)), 'unauthenticated');
  assert.equal(await codeOf(() => verifyPurchaseForUser('alice', { ...input, productKey: 'INVALID' }, fakeDependencies())), 'INVALID_PRODUCT');
  assert.equal(await codeOf(() => verifyPurchaseForUser('alice', { ...input, purchaseProof: null }, fakeDependencies())), 'INVALID_PURCHASE');
  assert.equal((await adminDb.collection('payments').get()).size, 0);
  assert.equal((await adminDb.collection('subscriptions').get()).size, 0);
});

test('the production unconfigured provider path fails closed', async () => {
  assert.equal(await codeOf(() => verifyPurchaseForUser('alice', input)), 'PROVIDER_NOT_CONFIGURED');
  assert.equal((await adminDb.collection('payments').get()).size, 0);
  assert.equal((await adminDb.collection('subscriptions').get()).size, 0);
});

test('a fake verified provider creates normalized payment and subscription atomically', async () => {
  const result = await verifyPurchaseForUser('alice', input, fakeDependencies());
  const payment = await adminDb.doc(`payments/${billingPaymentId(purchase())}`).get();
  const subscription = await adminDb.doc('subscriptions/alice').get();
  assert.equal(result.entitlement.isPremium, true);
  assert.equal(result.alreadyProcessed, false);
  assert.equal(payment.data()?.userId, 'alice');
  assert.equal(payment.data()?.status, 'VERIFIED');
  assert.equal(payment.data()?.provider, 'GOOGLE_PLAY');
  assert.equal(payment.data()?.environment, 'SANDBOX');
  assert.equal(payment.data()?.purchaseProof, undefined);
  assert.deepEqual({ planId: subscription.data()?.planId, provider: subscription.data()?.provider, status: subscription.data()?.status }, { planId: 'PREMIUM', provider: 'GOOGLE_PLAY', status: 'ACTIVE' });
});

test('a verified transaction retry is idempotent', async () => {
  const first = await verifyPurchaseForUser('alice', input, fakeDependencies());
  const second = await verifyPurchaseForUser('alice', input, fakeDependencies());
  assert.equal(first.alreadyProcessed, false);
  assert.equal(second.alreadyProcessed, true);
  assert.equal((await adminDb.collection('payments').get()).size, 1);
  assert.equal((await adminDb.doc('subscriptions/alice').get()).data()?.currentPeriodEnd, 10_000);
});

test('a verified transaction cannot be replayed by another Firebase UID', async () => {
  await verifyPurchaseForUser('alice', input, fakeDependencies());
  assert.equal(await codeOf(() => verifyPurchaseForUser('bob', input, fakeDependencies())), 'INVALID_PURCHASE');
  assert.equal((await adminDb.doc('subscriptions/bob').get()).exists, false);
});

test('rejected provider output and provider-product mismatch cannot activate entitlement', async () => {
  assert.equal(await codeOf(() => verifyPurchaseForUser('alice', input, fakeDependencies(purchase({ status: 'REJECTED' })))), 'VERIFICATION_FAILED');
  assert.equal(await codeOf(() => verifyPurchaseForUser('alice', input, fakeDependencies(purchase({ providerProductId: 'wrong-product' })))), 'INVALID_PURCHASE');
  assert.equal((await adminDb.collection('payments').get()).size, 0);
  assert.equal((await adminDb.collection('subscriptions').get()).size, 0);
});
