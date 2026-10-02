import { ReviewGrade, VocabularyEntry } from '../../types';

export interface SrsState {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  correctCount: number;
  wrongCount: number;
  lastReviewedAt?: number;
  nextReviewAt: number;
  strength: number;
}
type SrsInput = Partial<Pick<SrsState, 'repetitions' | 'intervalDays' | 'easeFactor' | 'correctCount' | 'wrongCount' | 'lastReviewedAt' | 'nextReviewAt'>> & { nextReviewDate?: Date | number; createdAt?: Date | number };

export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 2.8;
export const AGAIN_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const numeric = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const timestamp = (value: unknown) => value instanceof Date ? value.getTime() : numeric(value, 0);

export const strengthFromSrs = (state: Pick<SrsState, 'repetitions' | 'intervalDays' | 'correctCount' | 'wrongCount'>) => {
  if (state.repetitions <= 0 || state.wrongCount > state.correctCount) return 1;
  if (state.intervalDays <= 1) return 2;
  if (state.intervalDays <= 7) return 3;
  if (state.intervalDays <= 30) return 4;
  return 5;
};

export const initialSrsState = (entry?: SrsInput | Partial<VocabularyEntry>): SrsState => {
  const state = {
    repetitions: Math.max(0, numeric(entry?.repetitions, 0)),
    intervalDays: Math.max(0, numeric(entry?.intervalDays, 0)),
    easeFactor: Math.min(MAX_EASE_FACTOR, Math.max(MIN_EASE_FACTOR, numeric(entry?.easeFactor, INITIAL_EASE_FACTOR))),
    correctCount: Math.max(0, numeric(entry?.correctCount, 0)),
    wrongCount: Math.max(0, numeric(entry?.wrongCount, 0)),
    lastReviewedAt: entry?.lastReviewedAt === undefined ? undefined : timestamp(entry.lastReviewedAt),
    nextReviewAt: entry?.nextReviewAt === undefined ? timestamp(entry?.nextReviewDate) : timestamp(entry.nextReviewAt),
    strength: 1,
  };
  return { ...state, strength: strengthFromSrs(state) };
};

export const calculateNextReview = (current: Partial<SrsState>, grade: ReviewGrade, reviewedAt: number): SrsState => {
  const base = initialSrsState(current);
  let repetitions = base.repetitions;
  let intervalDays = base.intervalDays;
  let easeFactor = base.easeFactor;
  let correctCount = base.correctCount;
  let wrongCount = base.wrongCount;
  let nextReviewAt: number;
  switch (grade) {
    case 'AGAIN': repetitions = 0; intervalDays = 0; easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - .2); wrongCount++; nextReviewAt = reviewedAt + AGAIN_DELAY_MS; break;
    case 'HARD': repetitions++; intervalDays = Math.max(1, Math.round((intervalDays || 1) * 1.2)); easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - .15); correctCount++; nextReviewAt = reviewedAt + intervalDays * DAY_MS; break;
    case 'GOOD': repetitions++; intervalDays = base.repetitions === 0 ? 1 : base.repetitions === 1 ? 3 : Math.max(1, Math.round(intervalDays * easeFactor)); correctCount++; nextReviewAt = reviewedAt + intervalDays * DAY_MS; break;
    case 'EASY': repetitions++; intervalDays = base.repetitions === 0 ? 4 : Math.max(1, Math.round((intervalDays || 1) * easeFactor * 1.3)); easeFactor = Math.min(MAX_EASE_FACTOR, easeFactor + .15); correctCount++; nextReviewAt = reviewedAt + intervalDays * DAY_MS; break;
  }
  const result = { repetitions, intervalDays, easeFactor, correctCount, wrongCount, lastReviewedAt: reviewedAt, nextReviewAt, strength: 1 };
  return { ...result, strength: strengthFromSrs(result) };
};

export const isReviewDue = (entry: SrsInput | Partial<VocabularyEntry>, at: number) => initialSrsState(entry).nextReviewAt <= at;

export const sortDueVocabulary = <T extends SrsInput | Partial<VocabularyEntry>>(entries: T[], at: number) => [...entries].sort((a, b) => {
  const aState = initialSrsState(a); const bState = initialSrsState(b);
  const aDue = aState.nextReviewAt <= at; const bDue = bState.nextReviewAt <= at;
  if (aDue !== bDue) return aDue ? -1 : 1;
  if (aState.nextReviewAt !== bState.nextReviewAt) return aState.nextReviewAt - bState.nextReviewAt;
  return aState.strength - bState.strength;
});
