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
  assert.equal(result.alreadySubmitted, false); const word = (await adminDb.doc('users/alice/vocabulary/word-1').get()).data(); const event = (await adminDb.doc('users/alice/reviewEvents/attempt-1').get()).data(); const profile = (await adminDb.doc('users/alice').get()).data(); const summary = (await adminDb.doc('users/alice/learningSummary/overview').get()).data(); const xpEvent = (await adminDb.doc('users/alice/xpEvents/attempt-1').get()).data();
  assert.equal(word.repetitions, 1); assert.equal(word.correctCount, 1); assert.equal(word.nextReviewAt, event.resultingState.nextReviewAt); assert.equal(event.previousState.repetitions, 0); assert.equal(event.grade, 'GOOD');
  assert.equal(profile.xp, 10); assert.equal(profile.streak, 1); assert.equal(summary.reviewedToday, 1); assert.equal(summary.correctToday, 1); assert.equal(summary.incorrectToday, 0); assert.equal(summary.totalReviews, 1); assert.equal(xpEvent.amount, 10);
});
test('rejects invalid grades and absent vocabulary without writing events', async () => {
  await assert.rejects(() => submitVocabularyReview('alice', { vocabularyId: 'missing', grade: 'GOOD' })); await seed(); await assert.rejects(() => submitVocabularyReview('alice', { vocabularyId: 'word-1', grade: 'MAYBE' })); assert.equal((await adminDb.collection('users/alice/reviewEvents').get()).empty, true);
});
test('legacy documents are upgraded safely and an attempt ID is idempotent', async () => {
  await seed('alice', 'legacy', { strength: 0 }); const first = await submitVocabularyReview('alice', { vocabularyId: 'legacy', grade: 'EASY', attemptId: 'same-attempt' }, 5_000); const second = await submitVocabularyReview('alice', { vocabularyId: 'legacy', grade: 'EASY', attemptId: 'same-attempt' }, 6_000);
  assert.equal(second.alreadySubmitted, true); assert.equal((await adminDb.collection('users/alice/reviewEvents').get()).size, 1); assert.equal((await adminDb.collection('users/alice/xpEvents').get()).size, 1); assert.equal((await adminDb.doc('users/alice').get()).data().xp, 12); assert.equal(first.state.intervalDays, 4); assert.equal((await adminDb.doc('users/alice/vocabulary/legacy').get()).data().repetitions, 1);
});
test('summary handles same-day, consecutive and missed UTC days without duplicate streak increments', async () => {
  await seed('alice', 'one'); await seed('alice', 'two'); await seed('alice', 'three'); await seed('alice', 'four');
  await submitVocabularyReview('alice', { vocabularyId: 'one', grade: 'GOOD', attemptId: 'day-one' }, Date.UTC(2026, 11, 31, 12));
  await submitVocabularyReview('alice', { vocabularyId: 'two', grade: 'AGAIN', attemptId: 'same-day' }, Date.UTC(2026, 11, 31, 18));
  let summary = (await adminDb.doc('users/alice/learningSummary/overview').get()).data();
  assert.equal(summary.currentStreak, 1); assert.equal(summary.longestStreak, 1); assert.equal(summary.totalActiveDays, 1); assert.equal(summary.reviewedToday, 2); assert.equal(summary.correctToday, 1); assert.equal(summary.incorrectToday, 1);
  await submitVocabularyReview('alice', { vocabularyId: 'three', grade: 'HARD', attemptId: 'next-day' }, Date.UTC(2027, 0, 1, 12));
  summary = (await adminDb.doc('users/alice/learningSummary/overview').get()).data(); assert.equal(summary.currentStreak, 2); assert.equal(summary.longestStreak, 2); assert.equal(summary.totalActiveDays, 2);
  await submitVocabularyReview('alice', { vocabularyId: 'four', grade: 'GOOD', attemptId: 'missed-day' }, Date.UTC(2027, 0, 3, 12));
  summary = (await adminDb.doc('users/alice/learningSummary/overview').get()).data(); assert.equal(summary.currentStreak, 1); assert.equal(summary.longestStreak, 2); assert.equal(summary.totalActiveDays, 3);
});
test('review paths are owner scoped by the authenticated uid', async () => {
  await seed('alice'); await assert.rejects(() => submitVocabularyReview('bob', { vocabularyId: 'word-1', grade: 'GOOD' })); assert.equal((await adminDb.collection('users/alice/reviewEvents').get()).empty, true);
});
