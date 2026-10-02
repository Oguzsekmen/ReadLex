import { UserBookProgress, VocabularyEntry } from '../../types';

type TimestampLike = { toDate: () => Date };

export const toDate = (value: unknown, fallback = new Date()): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && typeof (value as TimestampLike).toDate === 'function') {
    return (value as TimestampLike).toDate();
  }
  return fallback;
};

export const migrationIsComplete = (state: Record<string, unknown> | undefined, scope: 'vocabulary' | 'progress') =>
  state?.[`${scope}MigrationState`] === 'MIGRATED';

export const mergeVocabularyEntries = (current: VocabularyEntry[], legacy: VocabularyEntry[]) => {
  const currentKeys = new Set(current.map(entry => `${entry.normalizedWord || entry.word}|${entry.sourceBookId}|${entry.sourceChapterId || ''}`));
  return [...current, ...legacy.filter(entry => !currentKeys.has(`${entry.normalizedWord || entry.word}|${entry.sourceBookId}|${entry.sourceChapterId || ''}`))];
};

export const mergeProgressEntries = (
  current: Record<string, UserBookProgress>,
  legacy: Record<string, UserBookProgress>
) => ({ ...legacy, ...current });

export const shouldUseChapterDocuments = (book: Record<string, unknown>) =>
  !Array.isArray(book.chapters) || book.chapterMigrationState === 'MIGRATED';
