import { describe, expect, it } from 'vitest';
import { AGAIN_DELAY_MS, calculateNextReview, initialSrsState, isReviewDue, sortDueVocabulary, strengthFromSrs } from '../services/learning/srs';

const now = Date.UTC(2026, 0, 15, 12);

describe('SRS engine', () => {
  it('gives missing legacy fields a due, predictable initial state', () => {
    expect(initialSrsState({})).toEqual(expect.objectContaining({ repetitions: 0, intervalDays: 0, easeFactor: 2.5, strength: 1, nextReviewAt: 0 }));
  });
  it('schedules AGAIN soon and resets repetitions', () => {
    const next = calculateNextReview({ repetitions: 3, intervalDays: 8, easeFactor: 2.5, correctCount: 3 }, 'AGAIN', now);
    expect(next).toEqual(expect.objectContaining({ repetitions: 0, intervalDays: 0, wrongCount: 1, nextReviewAt: now + AGAIN_DELAY_MS, strength: 1 }));
  });
  it.each(['HARD', 'GOOD', 'EASY'] as const)('advances %s deterministically', grade => {
    const next = calculateNextReview({}, grade, now);
    expect(next.nextReviewAt).toBeGreaterThan(now); expect(next.correctCount).toBe(1); expect(next.intervalDays).toBeGreaterThan(0);
  });
  it('grows normal intervals while keeping ease bounded', () => {
    let current = initialSrsState({}); for (let index = 0; index < 8; index++) current = calculateNextReview(current, 'GOOD', now + index * 86_400_000);
    expect(current.intervalDays).toBeGreaterThan(7); expect(current.easeFactor).toBeGreaterThanOrEqual(1.3); expect(current.easeFactor).toBeLessThanOrEqual(2.8);
  });
  it('maps learner state into the existing 1–5 strength representation', () => {
    expect(strengthFromSrs({ repetitions: 0, intervalDays: 0, correctCount: 0, wrongCount: 0 })).toBe(1);
    expect(strengthFromSrs({ repetitions: 1, intervalDays: 1, correctCount: 1, wrongCount: 0 })).toBe(2);
    expect(strengthFromSrs({ repetitions: 2, intervalDays: 7, correctCount: 2, wrongCount: 0 })).toBe(3);
    expect(strengthFromSrs({ repetitions: 3, intervalDays: 30, correctCount: 3, wrongCount: 0 })).toBe(4);
    expect(strengthFromSrs({ repetitions: 4, intervalDays: 31, correctCount: 4, wrongCount: 0 })).toBe(5);
  });
  it('tests due status without reading the real clock', () => {
    expect(isReviewDue({ nextReviewAt: now }, now)).toBe(true); expect(isReviewDue({ nextReviewAt: now + 1 }, now)).toBe(false);
  });
  it('sorts overdue and weak vocabulary ahead of later entries', () => {
    const sorted = sortDueVocabulary([{ id: 'later', nextReviewAt: now + 1000 }, { id: 'weak', nextReviewAt: now - 1, repetitions: 0 }, { id: 'old', nextReviewAt: now - 1000, repetitions: 4, intervalDays: 31, correctCount: 4 }], now);
    expect(sorted.map(entry => entry.id)).toEqual(['old', 'weak', 'later']);
  });
});
