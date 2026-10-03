import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests';
const host = '127.0.0.1';
const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
process.env.GCLOUD_PROJECT = projectId;
const { adminDb } = await import('../functions/lib/admin.js');
const { createWebCheckoutForAuthenticatedRequest, createWebCheckoutForUser, verifyWebProviderNotification } = await import('../functions/lib/billing/web/service.js');
let env;
before(async () => { env = await initializeTestEnvironment({ projectId, firestore: { host, port } }); });
beforeEach(async () => env.clearFirestore());
after(async () => env.cleanup());

const codeOf = async operation => { try { await operation(); } catch (error) { return error.code || error.message; } return undefined; };
const assertNoBillingMutation = async () => {
  assert.equal((await adminDb.collection('payments').get()).size, 0);
  assert.equal((await adminDb.collection('subscriptions').get()).size, 0);
};

test('unauthenticated WEB checkout is rejected', async () => {
  assert.equal(await codeOf(() => createWebCheckoutForAuthenticatedRequest(undefined, { productKey: 'PREMIUM_MONTHLY' })), 'unauthenticated');
  await assertNoBillingMutation();
});

test('authenticated checkout remains fail-closed while no WEB provider is configured', async () => {
  assert.equal(await codeOf(() => createWebCheckoutForUser('alice', { productKey: 'PREMIUM_MONTHLY' })), 'PROVIDER_NOT_CONFIGURED');
  await assertNoBillingMutation();
});

test('invalid product and client authority fields are rejected', async () => {
  assert.equal(await codeOf(() => createWebCheckoutForUser('alice', { productKey: 'INVALID' })), 'INVALID_PRODUCT');
  assert.equal(await codeOf(() => createWebCheckoutForUser('alice', { productKey: 'PREMIUM_MONTHLY', uid: 'bob' })), 'INVALID_PURCHASE');
  assert.equal(await codeOf(() => createWebCheckoutForUser('alice', { productKey: 'PREMIUM_MONTHLY', price: 1 })), 'INVALID_PURCHASE');
  await assertNoBillingMutation();
});

test('an unconfigured or unverified callback cannot mutate billing state', async () => {
  assert.equal(await codeOf(() => verifyWebProviderNotification({ status: 'success' })), 'PROVIDER_NOT_CONFIGURED');
  await assertNoBillingMutation();
});
