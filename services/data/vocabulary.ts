import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { VocabularyEntry } from '../../types';
import { db } from '../firebase';
import { mergeVocabularyEntries, migrationIsComplete, toDate } from './compatibility';

const normalizeWord = (word: string) => word.normalize('NFKD').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'word';

// A vocabulary entry is stable per language, normalized spelling, and reading
// source. The source segment prevents one book's word from overwriting another.
export const vocabularyDocumentId = (entry: VocabularyEntry) =>
  `v1-en-${normalizeWord(entry.normalizedWord || entry.word)}-${normalizeWord(entry.sourceBookId || 'manual')}-${normalizeWord(entry.sourceChapterId || 'legacy')}`.slice(0, 512);

const fromEntry = (id: string, data: Record<string, unknown>): VocabularyEntry => ({
  id,
  word: typeof data.word === 'string' ? data.word : '',
  translation: typeof data.translation === 'string' ? data.translation : '',
  definition: typeof data.definition === 'string' ? data.definition : '',
  exampleSentence: typeof data.exampleSentence === 'string' ? data.exampleSentence : '',
  type: typeof data.type === 'string' ? data.type : '',
  level: (typeof data.level === 'string' ? data.level : 'A1') as VocabularyEntry['level'],
  sourceBookId: typeof data.sourceBookId === 'string' ? data.sourceBookId : '',
  sourceChapterId: typeof data.sourceChapterId === 'string' ? data.sourceChapterId : undefined,
  nextReviewDate: toDate(data.nextReviewDate),
  strength: typeof data.strength === 'number' ? data.strength : 0,
  normalizedWord: typeof data.normalizedWord === 'string' ? data.normalizedWord : normalizeWord(typeof data.word === 'string' ? data.word : ''),
  createdAt: data.createdAt === undefined ? undefined : toDate(data.createdAt),
  updatedAt: data.updatedAt === undefined ? undefined : toDate(data.updatedAt),
  nextReviewAt: data.nextReviewAt === undefined ? undefined : toDate(data.nextReviewAt),
  lastReviewedAt: data.lastReviewedAt === undefined ? undefined : toDate(data.lastReviewedAt),
  correctCount: typeof data.correctCount === 'number' ? data.correctCount : undefined,
  wrongCount: typeof data.wrongCount === 'number' ? data.wrongCount : undefined,
  repetitions: typeof data.repetitions === 'number' ? data.repetitions : undefined,
  intervalDays: typeof data.intervalDays === 'number' ? data.intervalDays : undefined,
  easeFactor: typeof data.easeFactor === 'number' ? data.easeFactor : undefined
});

export const getVocabularyEntries = async (uid: string): Promise<VocabularyEntry[]> => {
  if (!db) return [];
  const [entries, migration] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'vocabulary'))),
    getDoc(doc(db, 'users', uid, 'migrationState', 'data'))
  ]);
  const current = entries.docs.map(entry => fromEntry(entry.id, entry.data() as Record<string, unknown>));
  if (migrationIsComplete(migration.data() as Record<string, unknown> | undefined, 'vocabulary')) return current;
  const legacy = await getDoc(doc(db, 'vocabulary', uid));
  const words = legacy.data()?.words;
  const legacyEntries = Array.isArray(words)
    ? words.map((word, index) => fromEntry(typeof word?.id === 'string' ? word.id : `legacy-${index}`, word as Record<string, unknown>))
    : [];
  return mergeVocabularyEntries(current, legacyEntries);
};

/** Keep optional legacy fields out of Firestore writes when they are absent. */
export const vocabularyFieldsForWrite = (entry: VocabularyEntry, id: string, normalizedWord: string) => ({
  id,
  word: entry.word,
  translation: entry.translation,
  definition: entry.definition,
  exampleSentence: entry.exampleSentence,
  type: entry.type,
  level: entry.level,
  sourceBookId: entry.sourceBookId,
  nextReviewDate: entry.nextReviewDate,
  strength: entry.strength,
  normalizedWord,
  ...(typeof entry.sourceChapterId === 'string' ? { sourceChapterId: entry.sourceChapterId } : {}),
  ...(entry.createdAt !== undefined ? { createdAt: entry.createdAt } : {}),
  ...(entry.nextReviewAt !== undefined ? { nextReviewAt: entry.nextReviewAt } : {}),
  ...(entry.lastReviewedAt !== undefined ? { lastReviewedAt: entry.lastReviewedAt } : {}),
  ...(typeof entry.correctCount === 'number' ? { correctCount: entry.correctCount } : {}),
  ...(typeof entry.wrongCount === 'number' ? { wrongCount: entry.wrongCount } : {}),
  ...(typeof entry.repetitions === 'number' ? { repetitions: entry.repetitions } : {}),
  ...(typeof entry.intervalDays === 'number' ? { intervalDays: entry.intervalDays } : {}),
  ...(typeof entry.easeFactor === 'number' ? { easeFactor: entry.easeFactor } : {})
});

export const saveVocabularyEntry = async (uid: string, entry: VocabularyEntry): Promise<VocabularyEntry> => {
  if (!db) throw new Error('Firestore is unavailable.');
  const id = vocabularyDocumentId(entry);
  const ref = doc(db, 'users', uid, 'vocabulary', id);
  const normalizedWord = entry.normalizedWord || normalizeWord(entry.word);
  const existing = await getDoc(ref);
  await setDoc(ref, { ...vocabularyFieldsForWrite(entry, id, normalizedWord), ...(existing.exists() ? {} : { createdAt: serverTimestamp() }), updatedAt: serverTimestamp() }, { merge: true });
  return { ...entry, id, normalizedWord };
};

export const deleteVocabularyEntry = async (uid: string, entryId: string) => {
  if (!db) throw new Error('Firestore is unavailable.');
  return deleteDoc(doc(db, 'users', uid, 'vocabulary', entryId));
};
