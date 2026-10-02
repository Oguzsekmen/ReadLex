import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests'; const host = '127.0.0.1'; const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`; process.env.GCLOUD_PROJECT = projectId;
const { adminDb } = await import('../functions/lib/admin.js');
const { submitVocabularyReview } = await import('../functions/lib/learning/reviewService.js');
let env;
before(async () => { env = await initializeTestEnvironment({ projectId, firestore: { host, port } }); });
beforeEach(async () => env.clearFirestore()); after(async () => env.cleanup());
const seed = (uid = 'alice', id = 'word-1', extra = {}) => adminDb.collection('users').doc(uid).collection('vocabulary').doc(id).set({ id, word: 'door', translation: 'kapı', strength: 0, nextReviewDate: 0, ...extra });

test('valid review atomically updates own vocabulary and creates a corresponding event', async () => {
  await seed(); const result = await submitVocabularyReview('alice', { vocabularyId: 'word-1', grade: 'GOOD', attemptId: 'attempt-1' }, 1_000);
  assert.equal(result.alreadySubmitted, false); const word = (await adminDb.doc('users/alice/vocabulary/word-1').get()).data(); const event = (await adminDb.doc('users/alice/reviewEvents/attempt-1').get()).data();
  assert.equal(word.repetitions, 1); assert.equal(word.correctCount, 1); assert.equal(word.nextReviewAt, event.resultingState.nextReviewAt); assert.equal(event.previousState.repetitions, 0); assert.equal(event.grade, 'GOOD');
});
test('rejects invalid grades and absent vocabulary without writing events', async () => {
  await assert.rejects(() => submitVocabularyReview('alice', { vocabularyId: 'missing', grade: 'GOOD' })); await seed(); await assert.rejects(() => submitVocabularyReview('alice', { vocabularyId: 'word-1', grade: 'MAYBE' })); assert.equal((await adminDb.collection('users/alice/reviewEvents').get()).empty, true);
});
test('legacy documents are upgraded safely and an attempt ID is idempotent', async () => {
  await seed('alice', 'legacy', { strength: 0 }); const first = await submitVocabularyReview('alice', { vocabularyId: 'legacy', grade: 'EASY', attemptId: 'same-attempt' }, 5_000); const second = await submitVocabularyReview('alice', { vocabularyId: 'legacy', grade: 'EASY', attemptId: 'same-attempt' }, 6_000);
  assert.equal(second.alreadySubmitted, true); assert.equal((await adminDb.collection('users/alice/reviewEvents').get()).size, 1); assert.equal(first.state.intervalDays, 4); assert.equal((await adminDb.doc('users/alice/vocabulary/legacy').get()).data().repetitions, 1);
});
test('review paths are owner scoped by the authenticated uid', async () => {
  await seed('alice'); await assert.rejects(() => submitVocabularyReview('bob', { vocabularyId: 'word-1', grade: 'GOOD' })); assert.equal((await adminDb.collection('users/alice/reviewEvents').get()).empty, true);
});
