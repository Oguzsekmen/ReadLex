import { describe, expect, it } from 'vitest';
import {
  mergeProgressEntries,
  mergeVocabularyEntries,
  migrationIsComplete,
  shouldUseChapterDocuments,
  toDate
} from '../services/data/compatibility';

const word = (id: string, sourceChapterId = 'chapter-1') => ({
  id,
  word: 'Word',
  translation: id,
  definition: '',
  exampleSentence: '',
  type: 'noun',
  level: 'A1' as const,
  sourceBookId: 'book-1',
  sourceChapterId,
  nextReviewDate: new Date('2026-01-01T00:00:00.000Z'),
  strength: 0,
  normalizedWord: 'word'
});

describe('new-model compatibility gates', () => {
  it('keeps legacy chapters authoritative until a book is explicitly migrated', () => {
    expect(shouldUseChapterDocuments({ chapters: [{ id: 'legacy' }], chapterMigrationState: 'MIGRATING' })).toBe(false);
    expect(shouldUseChapterDocuments({ chapters: [{ id: 'legacy' }], chapterMigrationState: 'MIGRATED' })).toBe(true);
    expect(shouldUseChapterDocuments({ chapterMigrationState: 'MIGRATING' })).toBe(true);
  });

  it('merges legacy vocabulary during a partial copy and prefers matching new entries', () => {
    const current = [word('new')];
    const legacy = [word('legacy'), word('other', 'chapter-2')];
    expect(mergeVocabularyEntries(current, legacy).map(entry => entry.id)).toEqual(['new', 'other']);
  });

  it('merges legacy progress during a partial copy and lets new records win by book id', () => {
    const legacy = {
      'book-1': { bookId: 'book-1', status: 'NOT_STARTED' as const, currentChapterIndex: 0, lastWordIndex: 0, lastReadAt: new Date(0) },
      'book-2': { bookId: 'book-2', status: 'IN_PROGRESS' as const, currentChapterIndex: 1, lastWordIndex: 3, lastReadAt: new Date(0) }
    };
    const current = {
      'book-1': { bookId: 'book-1', status: 'COMPLETED' as const, currentChapterIndex: 2, lastWordIndex: 0, lastReadAt: new Date(1) }
    };
    expect(mergeProgressEntries(current, legacy)).toMatchObject({ 'book-1': { status: 'COMPLETED' }, 'book-2': { status: 'IN_PROGRESS' } });
  });

  it('switches to new-only reads only after explicit scope completion', () => {
    expect(migrationIsComplete(undefined, 'vocabulary')).toBe(false);
    expect(migrationIsComplete({ vocabularyMigrationState: 'MIGRATING' }, 'vocabulary')).toBe(false);
    expect(migrationIsComplete({ vocabularyMigrationState: 'MIGRATED' }, 'vocabulary')).toBe(true);
  });

  it('normalizes Firestore Timestamp-like values and Date values', () => {
    const timestamp = { toDate: () => new Date('2026-02-03T04:05:06.000Z') };
    expect(toDate(timestamp).toISOString()).toBe('2026-02-03T04:05:06.000Z');
    expect(toDate(new Date('2026-03-04T00:00:00.000Z')).toISOString()).toBe('2026-03-04T00:00:00.000Z');
  });
});
