import { collection, doc, documentId, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';

export type PreparedReaderToken = { index: number; text: string; normalized: string | null; start: number; end: number; sentenceId: string; isWord: boolean };
export type PreparedSentence = { id: string; sourceText: string; translatedText: string; sourceHash: string; chapterContentHash: string; processingVersion: string };
export type DictionaryEntry = { id: string; word: string; normalizedWord: string; translation: string; type?: string; definition?: string };
export type ChapterLanguageMetadata = { status: string; chapterContentHash: string; processingVersion: string; sourceLanguage: string; targetLanguage: string; tokenChunkSize: number };
export type PreparedChapter = { mode: 'prepared'; metadata: ChapterLanguageMetadata; tokens: PreparedReaderToken[]; dictionaries: Map<string, DictionaryEntry>; dictionaryPrefetch: Promise<void>; sentences: Map<string, PreparedSentence> };
export type UnavailableChapter = { mode: 'unavailable'; reason: 'NOT_PREPARED' | 'STALE' | 'MISSING_DATA' };
export type ReaderLanguageChapter = PreparedChapter | UnavailableChapter;
export type ReaderLanguageResolution = { state: 'ready'; token: PreparedReaderToken; dictionary?: DictionaryEntry; sentence?: PreparedSentence } | { state: 'unavailable'; reason: UnavailableChapter['reason'] };

export class LatestTapGuard {
  private latest = 0;
  next() { this.latest += 1; return this.latest; }
  isLatest(requestId: number) { return requestId === this.latest; }
}

const groups = <T>(values: T[], size: number) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));
const toHex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
export const contentHash = async (value: string) => toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export const dictionaryDocumentId = async (sourceLanguage: string, targetLanguage: string, normalized: string) => `dict-${(await contentHash(`${sourceLanguage}:${targetLanguage}:${normalized}`)).slice(0, 40)}`;

export interface ReaderLanguageRepository {
  getMetadata(bookId: string, chapterId: string): Promise<ChapterLanguageMetadata | undefined>;
  getTokenChunks(bookId: string, chapterId: string): Promise<PreparedReaderToken[][]>;
  getDictionaryEntries(ids: string[]): Promise<DictionaryEntry[]>;
  getSentence(bookId: string, chapterId: string, sentenceId: string): Promise<PreparedSentence | undefined>;
}

const firebaseRepository: ReaderLanguageRepository = {
  async getMetadata(bookId, chapterId) {
    if (!db) return undefined; const snapshot = await getDoc(doc(db, 'books', bookId, 'languageChapters', chapterId));
    return snapshot.exists() ? snapshot.data() as ChapterLanguageMetadata : undefined;
  },
  async getTokenChunks(bookId, chapterId) {
    if (!db) return []; const snapshot = await getDocs(query(collection(db, 'books', bookId, 'languageChapters', chapterId, 'tokenChunks'), orderBy('chunkIndex')));
    return snapshot.docs.map(chunk => Array.isArray(chunk.data().tokens) ? chunk.data().tokens as PreparedReaderToken[] : []);
  },
  async getDictionaryEntries(ids) {
    if (!db || !ids.length) return []; const entries: DictionaryEntry[] = [];
    for (const group of groups(ids, 30)) { const snapshot = await getDocs(query(collection(db, 'dictionary'), where(documentId(), 'in', group))); snapshot.docs.forEach(item => entries.push({ id: item.id, ...item.data() } as DictionaryEntry)); }
    return entries;
  },
  async getSentence(bookId, chapterId, sentenceId) {
    if (!db) return undefined; const snapshot = await getDoc(doc(db, 'books', bookId, 'languageChapters', chapterId, 'sentences', sentenceId));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as PreparedSentence : undefined;
  }
};

/** Per-reader in-memory cache. No tap performs a Translation API request. */
export class ReaderLanguageDataService {
  private readonly chapters = new Map<string, Promise<ReaderLanguageChapter>>();
  constructor(private readonly repository: ReaderLanguageRepository = firebaseRepository) {}
  clearChapter(bookId: string, chapterId: string) { this.chapters.delete(`${bookId}/${chapterId}`); }

  loadChapter(bookId: string, chapterId: string, content: string): Promise<ReaderLanguageChapter> {
    const key = `${bookId}/${chapterId}`; const existing = this.chapters.get(key); if (existing) return existing;
    const loading = this.load(bookId, chapterId, content); this.chapters.set(key, loading); return loading;
  }

  private async load(bookId: string, chapterId: string, content: string): Promise<ReaderLanguageChapter> {
    const metadata = await this.repository.getMetadata(bookId, chapterId);
    if (!metadata || metadata.status !== 'COMPLETED') return { mode: 'unavailable', reason: 'NOT_PREPARED' };
    if (metadata.chapterContentHash !== await contentHash(content)) return { mode: 'unavailable', reason: 'STALE' };
    const tokens = (await this.repository.getTokenChunks(bookId, chapterId)).flat().sort((a, b) => a.index - b.index);
    if (!tokens.length) return { mode: 'unavailable', reason: 'MISSING_DATA' };
    const dictionaries = new Map<string, DictionaryEntry>(); const sentences = new Map<string, PreparedSentence>();
    const prepared: PreparedChapter = { mode: 'prepared', metadata, tokens, dictionaries, sentences, dictionaryPrefetch: Promise.resolve() };
    prepared.dictionaryPrefetch = this.prefetchDictionary(prepared); return prepared;
  }

  private async prefetchDictionary(chapter: PreparedChapter) {
    const words = [...new Set(chapter.tokens.filter(token => token.isWord && token.normalized).map(token => token.normalized as string))];
    const ids = await Promise.all(words.map(word => dictionaryDocumentId(chapter.metadata.sourceLanguage, chapter.metadata.targetLanguage, word)));
    const entries = await this.repository.getDictionaryEntries(ids); entries.forEach(entry => chapter.dictionaries.set(entry.normalizedWord, entry));
  }

  async resolve(bookId: string, chapterId: string, content: string, tokenIndex: number): Promise<ReaderLanguageResolution> {
    const chapter = await this.loadChapter(bookId, chapterId, content); if (chapter.mode !== 'prepared') return { state: 'unavailable', reason: chapter.reason };
    const token = chapter.tokens.find(item => item.index === tokenIndex); if (!token || !token.isWord || !token.normalized) return { state: 'unavailable', reason: 'MISSING_DATA' };
    await chapter.dictionaryPrefetch;
    let sentence = chapter.sentences.get(token.sentenceId);
    if (!sentence) { sentence = await this.repository.getSentence(bookId, chapterId, token.sentenceId); if (sentence && sentence.chapterContentHash === chapter.metadata.chapterContentHash && sentence.processingVersion === chapter.metadata.processingVersion) chapter.sentences.set(token.sentenceId, sentence); else sentence = undefined; }
    return { state: 'ready', token, dictionary: chapter.dictionaries.get(token.normalized), sentence };
  }
}

export const readerLanguageData = new ReaderLanguageDataService();
