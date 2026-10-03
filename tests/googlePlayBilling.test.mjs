import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests';
const host = '127.0.0.1';
const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
process.env.GCLOUD_PROJECT = projectId;
const { adminDb } = await import('../functions/lib/admin.js');
const { verifyGooglePlayPurchaseForAuthenticatedRequest, verifyGooglePlayPurchaseForUser } = await import('../functions/lib/billing/googlePlay/service.js');
let env;
before(async () => { env = await initializeTestEnvironment({ projectId, firestore: { host, port } }); });
beforeEach(async () => env.clearFirestore());
after(async () => env.cleanup());

const input = { productKey: 'PREMIUM_MONTHLY', purchaseToken: 'opaque-test-token' };
const purchase = (overrides = {}) => ({
  channel: 'GOOGLE_PLAY', productKey: 'PREMIUM_MONTHLY', providerProductId: 'fake-play-monthly', providerTransactionId: 'GPA.test.1',
  environment: 'SANDBOX', status: 'VERIFIED', purchasedAt: 100, currentPeriodStart: 100, currentPeriodEnd: 10_000, autoRenew: true, ...overrides,
});
const fakeDependencies = (result = purchase()) => ({
  getProviderProductId: () => 'fake-play-monthly',
  getProvider: () => ({ channel: 'GOOGLE_PLAY', verifyGooglePlayPurchase: async () => result, acknowledgePurchase: async () => {} }),
  now: () => 200,
});
const codeOf = async operation => { try { await operation(); } catch (error) { return error.code || error.message; } return undefined; };
const assertNoBillingMutation = async () => { assert.equal((await adminDb.collection('payments').get()).size, 0); assert.equal((await adminDb.collection('subscriptions').get()).size, 0); };

test('unauthenticated Google verification is rejected', async () => {
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForAuthenticatedRequest(undefined, input)), 'unauthenticated');
  await assertNoBillingMutation();
});

test('authenticated Google verification remains fail-closed until configured', async () => {
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('alice', input)), 'PROVIDER_NOT_CONFIGURED');
  await assertNoBillingMutation();
});

test('invalid logical product and client UID/status/expiry fields are rejected', async () => {
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('alice', { ...input, productKey: 'INVALID' }, fakeDependencies())), 'INVALID_PRODUCT');
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('alice', { ...input, uid: 'bob' }, fakeDependencies())), 'INVALID_PURCHASE');
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('alice', { ...input, status: 'VERIFIED' }, fakeDependencies())), 'INVALID_PURCHASE');
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('alice', { ...input, currentPeriodEnd: 999999 }, fakeDependencies())), 'INVALID_PURCHASE');
  await assertNoBillingMutation();
});

test('a fake verified Google purchase uses the canonical payment and subscription transaction', async () => {
  const result = await verifyGooglePlayPurchaseForUser('alice', input, fakeDependencies());
  const payment = (await adminDb.collection('payments').get()).docs[0]?.data();
  const subscription = (await adminDb.doc('subscriptions/alice').get()).data();
  assert.equal(result.entitlement.isPremium, true);
  assert.deepEqual({ provider: payment?.provider, channel: payment?.channel, status: payment?.status }, { provider: 'GOOGLE_PLAY', channel: 'GOOGLE_PLAY', status: 'VERIFIED' });
  assert.deepEqual({ planId: subscription?.planId, provider: subscription?.provider, status: subscription?.status }, { planId: 'PREMIUM', provider: 'GOOGLE_PLAY', status: 'ACTIVE' });
  assert.equal(payment?.purchaseToken, undefined);
});

test('a Google transaction retry is idempotent and cannot be replayed by another UID', async () => {
  const first = await verifyGooglePlayPurchaseForUser('alice', input, fakeDependencies());
  const second = await verifyGooglePlayPurchaseForUser('alice', input, fakeDependencies());
  assert.equal(first.alreadyProcessed, false); assert.equal(second.alreadyProcessed, true);
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('bob', input, fakeDependencies())), 'INVALID_PURCHASE');
  assert.equal((await adminDb.collection('payments').get()).size, 1);
  assert.equal((await adminDb.doc('subscriptions/bob').get()).exists, false);
});

test('rejected verification or a product mismatch cannot create a subscription', async () => {
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('alice', input, fakeDependencies(purchase({ status: 'REJECTED' })))), 'VERIFICATION_FAILED');
  assert.equal(await codeOf(() => verifyGooglePlayPurchaseForUser('alice', input, fakeDependencies(purchase({ providerProductId: 'wrong-product' })))), 'INVALID_PURCHASE');
  await assertNoBillingMutation();
});
