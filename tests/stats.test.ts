import { describe, expect, it } from 'vitest';
import { accuracy, dailyGoalProgress, isMasteredWord, isWeakWord, learningDayKey, nextStreak, xpForReview } from '../services/learning/stats';
describe('learning stats', () => {
  it('awards deterministic XP only for successful review grades', () => { expect(xpForReview('AGAIN')).toBe(0); expect(xpForReview('HARD')).toBe(5); expect(xpForReview('GOOD')).toBe(10); expect(xpForReview('EASY')).toBe(12); });
  it('handles same day, consecutive, missed, month and year streak boundaries in UTC', () => { const first = nextStreak({}, '2026-12-31'); expect(nextStreak(first, '2026-12-31').currentStreak).toBe(1); expect(nextStreak(first, '2027-01-01').currentStreak).toBe(2); expect(nextStreak(first, '2027-01-02').currentStreak).toBe(1); expect(learningDayKey(Date.UTC(2026, 0, 1))).toBe('2026-01-01'); });
  it('classifies accuracy, weak/mastered words and daily goal safely', () => { expect(accuracy(0, 0)).toBe(0); expect(accuracy(3, 1)).toBe(.75); expect(isWeakWord({ strength: 2 } as any)).toBe(true); expect(isMasteredWord({ strength: 5 } as any)).toBe(true); expect(dailyGoalProgress(3, 5)).toBe(.6); });
});
