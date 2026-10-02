import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-readlex-tests';
const host = '127.0.0.1';
const port = 8080;
let testEnv;

const profile = (uid, email) => ({
  id: uid, email, name: 'Reader', role: 'USER', streak: 0, xp: 0, dailyGoal: 10,
  subscriptionStatus: 'ACTIVE', plan: 'FREE', trialEndsAt: 0, subscriptionEndsAt: 0,
  createdAt: 0, updatedAt: 0
});
const userDb = (uid, claims = {}) => testEnv.authenticatedContext(uid, { email: `${uid}@example.test`, ...claims }).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Rules tests require FIRESTORE_EMULATOR_HOST. Use npm run test:rules.');
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { host, port, rules: await readFile('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test('profiles allow only safe own creation and updates', async () => {
  const alice = userDb('alice');
  await assertSucceeds(setDoc(doc(alice, 'users/alice'), profile('alice', 'alice@example.test')));
  await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { name: 'Updated' }));
  await assertFails(updateDoc(doc(alice, 'users/alice'), { role: 'ADMIN' }));
  await assertFails(updateDoc(doc(alice, 'users/alice'), { subscriptionStatus: 'PAST_DUE' }));
  await assertFails(updateDoc(doc(alice, 'users/alice'), { plan: 'PREMIUM' }));
  await assertFails(updateDoc(doc(alice, 'users/alice'), { providerId: 'forged-provider' }));
  await assertFails(getDoc(doc(userDb('bob'), 'users/alice')));
  await assertFails(updateDoc(doc(userDb('bob'), 'users/alice'), { name: 'Forged' }));
  await assertFails(setDoc(doc(anonDb(), 'users/guest'), profile('guest', 'guest@example.test')));
});

test('vocabulary is owned by the path UID only', async () => {
  const alice = userDb('alice');
  const word = doc(alice, 'users/alice/vocabulary/word-1');
  await assertSucceeds(setDoc(word, { word: 'fixture' }));
  await assertSucceeds(getDoc(word));
  await assertSucceeds(updateDoc(word, { translation: 'test' }));
  await assertSucceeds(deleteDoc(word));
  await assertFails(setDoc(doc(userDb('bob'), 'users/alice/vocabulary/forged'), { word: 'nope' }));
  await assertFails(getDoc(doc(userDb('bob'), 'users/alice/vocabulary/word-1')));
  await assertFails(getDoc(doc(anonDb(), 'users/alice/vocabulary/word-1')));
  await assertFails(setDoc(doc(anonDb(), 'users/alice/vocabulary/anon'), { word: 'nope' }));
});

test('progress is owned by the path UID only', async () => {
  const alice = userDb('alice');
  const progress = doc(alice, 'users/alice/progress/book-1');
  await assertSucceeds(setDoc(progress, { bookId: 'book-1', status: 'IN_PROGRESS' }));
  await assertSucceeds(updateDoc(progress, { lastWordIndex: 4 }));
  await assertFails(getDoc(doc(userDb('bob'), 'users/alice/progress/book-1')));
  await assertFails(setDoc(doc(anonDb(), 'users/alice/progress/book-1'), { bookId: 'book-1' }));
});

test('review events are owner-readable and client-write denied', async () => {
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'users/alice/reviewEvents/event-1'), { action: 'fixture' }));
  await assertSucceeds(getDoc(doc(userDb('alice'), 'users/alice/reviewEvents/event-1')));
  await assertFails(setDoc(doc(userDb('alice'), 'users/alice/reviewEvents/event-2'), { action: 'forged' }));
  await assertFails(getDoc(doc(userDb('bob'), 'users/alice/reviewEvents/event-1')));
});

test('migration completion state is owner-readable and server-only', async () => {
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'users/alice/migrationState/data'), { vocabularyMigrationState: 'MIGRATED' }));
  await assertSucceeds(getDoc(doc(userDb('alice'), 'users/alice/migrationState/data')));
  await assertFails(setDoc(doc(userDb('alice'), 'users/alice/migrationState/data'), { vocabularyMigrationState: 'MIGRATED' }));
  await assertFails(getDoc(doc(userDb('bob'), 'users/alice/migrationState/data')));
});

test('books, chapters, plans, and dictionary are read-only to all browser clients', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'books/book-1'), { title: 'Fixture' });
    await setDoc(doc(db, 'books/book-1/chapters/chapter-1'), { title: 'Chapter' });
    await setDoc(doc(db, 'books/book-1/languageChapters/chapter-1'), { status: 'COMPLETED' });
    await setDoc(doc(db, 'books/book-1/languageChapters/chapter-1/sentences/sentence-1'), { translatedText: 'Çeviri' });
    await setDoc(doc(db, 'books/book-1/languageChapters/chapter-1/tokenChunks/chunk-0'), { tokens: [] });
    await setDoc(doc(db, 'plans/FREE'), { name: 'Free' });
    await setDoc(doc(db, 'dictionary/word'), { word: 'fixture' });
    await setDoc(doc(db, 'bookImports/import-1'), { title: 'Private source material' });
  });
  const reader = userDb('reader');
  await assertSucceeds(getDoc(doc(reader, 'books/book-1')));
  await assertSucceeds(getDoc(doc(reader, 'books/book-1/chapters/chapter-1')));
  await assertSucceeds(getDoc(doc(reader, 'books/book-1/languageChapters/chapter-1/sentences/sentence-1')));
  await assertSucceeds(getDoc(doc(reader, 'books/book-1/languageChapters/chapter-1/tokenChunks/chunk-0')));
  await assertSucceeds(getDoc(doc(reader, 'plans/FREE')));
  await assertSucceeds(getDoc(doc(reader, 'dictionary/word')));
  const browserAdmin = userDb('browser-admin', { admin: true });
  await assertFails(setDoc(doc(browserAdmin, 'books/forged'), { title: 'No' }));
  await assertFails(deleteDoc(doc(browserAdmin, 'books/book-1')));
  await assertFails(setDoc(doc(browserAdmin, 'books/book-1/chapters/forged'), { title: 'No' }));
  await assertFails(deleteDoc(doc(browserAdmin, 'books/book-1/chapters/chapter-1')));
  await assertFails(setDoc(doc(browserAdmin, 'books/book-1/languageChapters/chapter-1/sentences/forged'), { translatedText: 'Forged' }));
  await assertFails(setDoc(doc(browserAdmin, 'books/book-1/languageChapters/chapter-1/tokenChunks/forged'), { tokens: [] }));
  await assertFails(updateDoc(doc(browserAdmin, 'plans/FREE'), { name: 'Forged' }));
  await assertFails(setDoc(doc(browserAdmin, 'plans/forged'), { name: 'Forged' }));
  await assertFails(setDoc(doc(reader, 'dictionary/forged'), { word: 'No' }));
  await assertFails(getDoc(doc(browserAdmin, 'bookImports/import-1')));
  await assertFails(setDoc(doc(browserAdmin, 'bookImports/forged'), { title: 'No' }));
  await assertFails(getDoc(doc(anonDb(), 'books/book-1')));
});

test('subscriptions and payments are owner-readable but never client-writable', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'subscriptions/sub-alice'), { userId: 'alice', plan: 'FREE' });
    await setDoc(doc(db, 'payments/pay-alice'), { userId: 'alice', amount: 1 });
  });
  await assertSucceeds(getDoc(doc(userDb('alice'), 'subscriptions/sub-alice')));
  await assertSucceeds(getDoc(doc(userDb('alice'), 'payments/pay-alice')));
  await assertFails(getDoc(doc(userDb('bob'), 'subscriptions/sub-alice')));
  await assertFails(setDoc(doc(userDb('alice'), 'subscriptions/forged'), { userId: 'alice', plan: 'ENTERPRISE' }));
  await assertFails(updateDoc(doc(userDb('alice'), 'subscriptions/sub-alice'), { plan: 'ENTERPRISE' }));
  await assertFails(deleteDoc(doc(userDb('alice'), 'subscriptions/sub-alice')));
  await assertFails(setDoc(doc(userDb('alice'), 'payments/forged'), { userId: 'alice', amount: 999999 }));
  await assertFails(deleteDoc(doc(userDb('alice'), 'payments/pay-alice')));
});

test('trusted emulator seeding bypasses rules while browser clients do not', async () => {
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'books/trusted'), { title: 'Trusted seed' }));
  await assertSucceeds(getDoc(doc(userDb('reader'), 'books/trusted')));
  await assertFails(updateDoc(doc(userDb('reader'), 'books/trusted'), { title: 'Browser write' }));
  assert.ok(true);
});
