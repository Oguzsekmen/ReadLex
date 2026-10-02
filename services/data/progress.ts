import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { BookStatus, UserBookProgress } from '../../types';
import { db } from '../firebase';
import { mergeProgressEntries, migrationIsComplete, toDate } from './compatibility';

const fromProgress = (id: string, data: Record<string, unknown>): UserBookProgress => ({
  bookId: typeof data.bookId === 'string' ? data.bookId : id,
  status: (typeof data.status === 'string' ? data.status : 'NOT_STARTED') as BookStatus,
  currentChapterIndex: typeof data.currentChapterIndex === 'number' ? data.currentChapterIndex : 0,
  currentChapterId: typeof data.currentChapterId === 'string' ? data.currentChapterId : undefined,
  lastWordIndex: typeof data.lastWordIndex === 'number' ? data.lastWordIndex : 0,
  progressPercent: typeof data.progressPercent === 'number' ? data.progressPercent : undefined,
  lastReadAt: toDate(data.lastReadAt)
});

const normalizeLegacyProgress = (data: unknown): Record<string, UserBookProgress> => {
  const result: Record<string, UserBookProgress> = {};
  if (!data || typeof data !== 'object') return result;
  for (const [bookId, value] of Object.entries(data as Record<string, unknown>)) {
    result[bookId] = typeof value === 'string'
      ? { bookId, status: value as BookStatus, currentChapterIndex: value === 'COMPLETED' ? 999 : 0, lastWordIndex: 0, lastReadAt: new Date() }
      : fromProgress(bookId, value as Record<string, unknown>);
  }
  return result;
};

export const getProgressEntries = async (uid: string): Promise<Record<string, UserBookProgress>> => {
  if (!db) return {};
  const [entries, migration] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'progress'))),
    getDoc(doc(db, 'users', uid, 'migrationState', 'data'))
  ]);
  const current = Object.fromEntries(entries.docs.map(entry => [entry.id, fromProgress(entry.id, entry.data() as Record<string, unknown>)]));
  if (migrationIsComplete(migration.data() as Record<string, unknown> | undefined, 'progress')) return current;
  const legacy = await getDoc(doc(db, 'progress', uid));
  return mergeProgressEntries(current, normalizeLegacyProgress(legacy.data()?.progress));
};

export const saveProgressEntry = async (uid: string, progress: UserBookProgress) => {
  if (!db) throw new Error('Firestore is unavailable.');
  const completedAt = progress.status === 'COMPLETED' ? serverTimestamp() : null;
  return setDoc(doc(db, 'users', uid, 'progress', progress.bookId), {
    ...progress,
    lastReadAt: serverTimestamp(),
    completedAt,
    updatedAt: serverTimestamp()
  }, { merge: true });
};
