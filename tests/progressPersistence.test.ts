import { describe, expect, it, vi } from 'vitest';
import { UserBookProgress } from '../types';
import { progressFieldsForWrite } from '../services/data/progress';
import { vocabularyFieldsForWrite } from '../services/data/vocabulary';

const progress = (overrides: Partial<UserBookProgress> = {}): UserBookProgress => ({
  bookId: 'book-1',
  status: 'IN_PROGRESS',
  currentChapterIndex: 0,
  lastWordIndex: 12,
  lastReadAt: new Date(0),
  ...overrides
});

const containsUndefined = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some(containsUndefined);
};

describe('reader progress persistence payload', () => {
  it('keeps a valid prepared chapter hash', () => {
    expect(progressFieldsForWrite(progress({
      currentChapterId: 'chapter-1',
      chapterContentHash: 'chapter-hash',
      progressPercent: 44
    }))).toMatchObject({ chapterContentHash: 'chapter-hash', currentChapterId: 'chapter-1', progressPercent: 44 });
  });

  it('omits an unavailable chapter hash and every undefined optional field for legacy content', () => {
    const payload = progressFieldsForWrite(progress({
      currentChapterId: undefined,
      chapterContentHash: undefined,
      progressPercent: undefined
    }));
    expect(payload).not.toHaveProperty('chapterContentHash');
    expect(payload).not.toHaveProperty('currentChapterId');
    expect(payload).not.toHaveProperty('progressPercent');
    expect(containsUndefined(payload)).toBe(false);
  });

  it('keeps progress persistence safe when a Reader action flushes an unprepared chapter update', () => {
    const persist = vi.fn((update: UserBookProgress) => progressFieldsForWrite(update));
    expect(() => persist(progress({ chapterContentHash: undefined, lastWordIndex: 31 }))).not.toThrow();
    expect(persist).toHaveReturnedWith(expect.objectContaining({ bookId: 'book-1', lastWordIndex: 31 }));
    expect(containsUndefined(persist.mock.results[0]?.value)).toBe(false);
  });

  it('keeps legacy vocabulary optional fields out of an adjacent Firestore payload', () => {
    const payload = vocabularyFieldsForWrite({
      id: 'legacy', word: 'door', translation: 'kapı', definition: '', exampleSentence: '', type: '', level: 'A1', sourceBookId: 'book-1', nextReviewDate: new Date(0), strength: 1
    }, 'legacy', 'door');
    expect(containsUndefined(payload)).toBe(false);
    expect(payload).not.toHaveProperty('sourceChapterId');
    expect(payload).not.toHaveProperty('nextReviewAt');
  });
});
