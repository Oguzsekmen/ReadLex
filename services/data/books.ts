import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Book, Chapter } from '../../types';
import { db } from '../firebase';
import { shouldUseChapterDocuments } from './compatibility';

const fromChapter = (id: string, data: Record<string, unknown>): Chapter => ({
  id,
  title: typeof data.title === 'string' ? data.title : 'Untitled chapter',
  content: typeof data.content === 'string' ? data.content : ''
});

const fromBook = (id: string, data: Record<string, unknown>, chapters?: Chapter[]): Book => ({
  id,
  title: typeof data.title === 'string' ? data.title : 'Untitled book',
  author: typeof data.author === 'string' ? data.author : 'Unknown',
  level: (typeof data.level === 'string' ? data.level : 'A1') as Book['level'],
  coverUrl: typeof data.coverUrl === 'string' ? data.coverUrl : '',
  excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
  totalWords: typeof data.totalWords === 'number' ? data.totalWords : 0,
  requiredPlan: Array.isArray(data.requiredPlan) ? data.requiredPlan.filter((plan): plan is string => typeof plan === 'string') : ['FREE'],
  archived: data.archived === true,
  chapterCount: typeof data.chapterCount === 'number' ? data.chapterCount : chapters?.length,
  chapters,
  source: data.source && typeof data.source === 'object' && typeof (data.source as Record<string, unknown>).type === 'string'
    ? {
        type: (data.source as Record<string, unknown>).type as 'MANUAL_TEXT' | 'OCR_IMAGE' | 'OCR_PDF',
        importId: typeof (data.source as Record<string, unknown>).importId === 'string' ? (data.source as Record<string, unknown>).importId as string : undefined
      }
    : undefined,
  languageProcessingStatus: data.languageProcessingStatus === 'NOT_STARTED' ? 'NOT_STARTED' : undefined
});

export const getBookMetadata = async (bookId: string): Promise<Book | undefined> => {
  if (!db) return undefined;
  const snapshot = await getDoc(doc(db, 'books', bookId));
  return snapshot.exists() ? fromBook(snapshot.id, snapshot.data() as Record<string, unknown>) : undefined;
};

export const getBookWithChapters = async (bookId: string): Promise<Book | undefined> => {
  if (!db) return undefined;
  const bookSnapshot = await getDoc(doc(db, 'books', bookId));
  if (!bookSnapshot.exists()) return undefined;
  const metadata = bookSnapshot.data() as Record<string, unknown>;
  const chaptersSnapshot = await getDocs(query(collection(bookSnapshot.ref, 'chapters'), orderBy('order')));
  const chapters = chaptersSnapshot.docs.map(chapter => fromChapter(chapter.id, chapter.data() as Record<string, unknown>));
  // During an incomplete copy, the legacy array remains authoritative. A
  // completed migration explicitly switches reads to chapter documents.
  const legacyChapters = Array.isArray(metadata.chapters)
    ? metadata.chapters.map((chapter, index) => fromChapter(`legacy-${index}`, chapter as Record<string, unknown>))
    : [];
  return fromBook(bookSnapshot.id, metadata, shouldUseChapterDocuments(metadata) ? chapters : legacyChapters);
};

export const getBookList = async (): Promise<Book[]> => {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, 'books'), limit(100)));
  return snapshot.docs.map(book => fromBook(book.id, book.data() as Record<string, unknown>));
};
