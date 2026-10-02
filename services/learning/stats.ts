import { ReviewGrade, VocabularyEntry } from '../../types';
export const learningDayKey = (at: number) => new Date(at).toISOString().slice(0, 10);
export const xpForReview = (grade: ReviewGrade) => grade === 'AGAIN' ? 0 : grade === 'HARD' ? 5 : grade === 'GOOD' ? 10 : 12;
export const nextStreak = (current: { currentStreak?: number; longestStreak?: number; lastActiveLearningDay?: string; totalActiveDays?: number }, day: string) => { const previous = current.lastActiveLearningDay; const today = new Date(`${day}T00:00:00.000Z`); const yesterday = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10); const currentStreak = previous === day ? current.currentStreak || 0 : previous === yesterday ? (current.currentStreak || 0) + 1 : 1; return { currentStreak, longestStreak: Math.max(current.longestStreak || 0, currentStreak), lastActiveLearningDay: day, totalActiveDays: (current.totalActiveDays || 0) + (previous === day ? 0 : 1) }; };
export const accuracy = (correct = 0, incorrect = 0) => correct + incorrect ? correct / (correct + incorrect) : 0;
export const isWeakWord = (entry: VocabularyEntry) => (entry.strength || 1) <= 2;
export const isMasteredWord = (entry: VocabularyEntry) => entry.strength === 5;
export const dailyGoalProgress = (reviewedToday: number, dailyGoal: number) => Math.min(1, reviewedToday / Math.max(1, dailyGoal));
