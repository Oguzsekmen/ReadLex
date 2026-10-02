import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface LearningSummary {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  reviewedToday: number;
  correctToday: number;
  incorrectToday: number;
  totalReviews: number;
  totalCorrect: number;
  totalIncorrect: number;
}

export const emptyLearningSummary: LearningSummary = {
  totalXp: 0, currentStreak: 0, longestStreak: 0, totalActiveDays: 0,
  reviewedToday: 0, correctToday: 0, incorrectToday: 0, totalReviews: 0,
  totalCorrect: 0, totalIncorrect: 0
};

// This document is written only by the review Function. The browser consumes a
// compact aggregate rather than scanning immutable review events.
export const loadLearningSummary = async (uid: string): Promise<LearningSummary> => {
  if (!db || !uid) return emptyLearningSummary;
  const snapshot = await getDoc(doc(db, 'users', uid, 'learningSummary', 'overview'));
  if (!snapshot.exists()) return emptyLearningSummary;
  const value = snapshot.data();
  const number = (key: keyof LearningSummary) => typeof value[key] === 'number' ? value[key] : 0;
  return {
    totalXp: number('totalXp'), currentStreak: number('currentStreak'),
    longestStreak: number('longestStreak'), totalActiveDays: number('totalActiveDays'),
    reviewedToday: number('reviewedToday'), correctToday: number('correctToday'),
    incorrectToday: number('incorrectToday'), totalReviews: number('totalReviews'),
    totalCorrect: number('totalCorrect'), totalIncorrect: number('totalIncorrect')
  };
};
