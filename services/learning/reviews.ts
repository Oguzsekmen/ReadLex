import { httpsCallable } from 'firebase/functions';
import { ReviewGrade, VocabularyEntry } from '../../types';
import { functions } from '../firebase';
import { sortDueVocabulary } from './srs';

export const submitReview = async (vocabularyId: string, grade: ReviewGrade, attemptId?: string) => {
  if (!functions) throw new Error('Firebase Functions is unavailable.');
  const callable = httpsCallable<{ vocabularyId: string; grade: ReviewGrade; attemptId?: string }, { eventId: string; alreadySubmitted: boolean }>(functions, 'submitVocabularyReview');
  return (await callable({ vocabularyId, grade, ...(attemptId ? { attemptId } : {}) })).data;
};

// Callers can pass a bounded page of the user's current vocabulary; this keeps
// session selection deterministic without loading immutable review history.
export const selectReviewCandidates = (entries: VocabularyEntry[], reviewedAt: number, limit = 10) =>
  sortDueVocabulary(entries, reviewedAt).slice(0, Math.max(1, Math.min(limit, 50)));
