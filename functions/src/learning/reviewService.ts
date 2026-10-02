import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { calculateNextReview, initialSrsState, ReviewGrade } from './srs';
import { learningDayKey, nextStreak, xpForReview } from './stats';

const grades: ReviewGrade[] = ['AGAIN', 'HARD', 'GOOD', 'EASY'];
const reviewGrade = (value: unknown): ReviewGrade => {
  if (typeof value !== 'string' || !grades.includes(value as ReviewGrade)) throw new HttpsError('invalid-argument', 'Invalid review grade.');
  return value as ReviewGrade;
};
const reviewId = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError('invalid-argument', 'Invalid review attempt ID.');
  return value;
};
const eventState = (state: ReturnType<typeof initialSrsState>) => state.lastReviewedAt === undefined
  ? (({ lastReviewedAt: _ignored, ...rest }) => rest)(state)
  : state;

export const submitVocabularyReview = async (uid: string, payload: unknown, reviewedAt = Date.now()) => {
  const data = payload as Record<string, unknown>;
  const vocabularyId = typeof data?.vocabularyId === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(data.vocabularyId) ? data.vocabularyId : '';
  if (!vocabularyId) throw new HttpsError('invalid-argument', 'Invalid vocabulary ID.');
  const grade = reviewGrade(data?.grade); const attemptId = reviewId(data?.attemptId);
  const vocabulary = adminDb.collection('users').doc(uid).collection('vocabulary').doc(vocabularyId);
  const user = adminDb.collection('users').doc(uid); const summary = user.collection('learningSummary').doc('overview');
  const event = adminDb.collection('users').doc(uid).collection('reviewEvents').doc(attemptId || adminDb.collection('users').doc(uid).collection('reviewEvents').doc().id);
  return adminDb.runTransaction(async transaction => {
    if (attemptId) { const existing = await transaction.get(event); if (existing.exists) return { eventId: event.id, alreadySubmitted: true, state: existing.data()?.resultingState }; }
    const [snapshot, userSnapshot, summarySnapshot] = await Promise.all([transaction.get(vocabulary), transaction.get(user), transaction.get(summary)]);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Vocabulary entry not found.');
    const previous = initialSrsState(snapshot.data() || {}); const next = calculateNextReview(snapshot.data() || {}, grade, reviewedAt);
    transaction.update(vocabulary, { ...next, nextReviewDate: next.nextReviewAt, updatedAt: FieldValue.serverTimestamp() });
    transaction.create(event, { id: event.id, vocabularyId, grade, reviewedAt, previousState: eventState(previous), resultingState: eventState(next), createdAt: FieldValue.serverTimestamp() });
    const xp = xpForReview(grade); const day = learningDayKey(reviewedAt); const priorSummary = summarySnapshot.data() || {}; const streak = nextStreak({ ...(userSnapshot.data() || {}), ...priorSummary }, day); const reviewedToday = (priorSummary.lastSummaryDay === day ? Number(priorSummary.reviewedToday || 0) : 0) + 1; const correctToday = (priorSummary.lastSummaryDay === day ? Number(priorSummary.correctToday || 0) : 0) + (grade === 'AGAIN' ? 0 : 1); const incorrectToday = (priorSummary.lastSummaryDay === day ? Number(priorSummary.incorrectToday || 0) : 0) + (grade === 'AGAIN' ? 1 : 0); const totalXp = Number(priorSummary.totalXp ?? userSnapshot.data()?.xp ?? 0) + xp;
    transaction.set(user, { xp: totalXp, streak: streak.currentStreak, ...streak, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(summary, { totalXp, ...streak, lastSummaryDay: day, reviewedToday, correctToday, incorrectToday, totalReviews: Number(priorSummary.totalReviews || 0) + 1, totalCorrect: Number(priorSummary.totalCorrect || 0) + (grade === 'AGAIN' ? 0 : 1), totalIncorrect: Number(priorSummary.totalIncorrect || 0) + (grade === 'AGAIN' ? 1 : 0), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.create(user.collection('xpEvents').doc(event.id), { id: event.id, type: 'REVIEW', amount: xp, sourceId: event.id, createdAt: FieldValue.serverTimestamp() });
    return { eventId: event.id, alreadySubmitted: false, state: next };
  });
};
