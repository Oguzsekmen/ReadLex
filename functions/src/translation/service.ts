import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { getTranslationProvider } from './provider';
import { segmentEnglishSentences } from './segmentation';
import { tokenizeSentence } from './tokenization';
import { LANGUAGE_PROCESSING_VERSION, LanguagePair, LanguageProcessingStatus, MAX_BOOK_PROCESSING_CHARS, PreparedSentence, PreparedToken, TOKEN_CHUNK_SIZE, TRANSLATION_BATCH_MAX_CHARS, TRANSLATION_BATCH_MAX_ITEMS, TranslationProvider } from './types';

type Chapter = { id: string; content: string; order: number };
type PreparedChapter = { chapter: Chapter; contentHash: string; sentences: PreparedSentence[]; tokens: PreparedToken[] };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const dictionaryId = (pair: LanguagePair, normalized: string) => `dict-${hash(`${pair.sourceLanguage}:${pair.targetLanguage}:${normalized}`).slice(0, 40)}`;
const bookRef = (id: string) => adminDb.collection('books').doc(id);
const languageChapterRef = (bookId: string, chapterId: string) => bookRef(bookId).collection('languageChapters').doc(chapterId);
const supportedPair = (pair: LanguagePair) => pair.sourceLanguage === 'en' && pair.targetLanguage === 'tr';
const chunks = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
const translationBatches = <T extends { text: string }>(items: T[]) => {
  const batches: T[][] = []; let current: T[] = []; let chars = 0;
  for (const item of items) { if (item.text.length > TRANSLATION_BATCH_MAX_CHARS) throw new HttpsError('invalid-argument', 'A translation input is too large.'); if (current.length && (current.length >= TRANSLATION_BATCH_MAX_ITEMS || chars + item.text.length > TRANSLATION_BATCH_MAX_CHARS)) { batches.push(current); current = []; chars = 0; } current.push(item); chars += item.text.length; }
  if (current.length) batches.push(current); return batches;
};

const readChapters = async (bookId: string): Promise<Chapter[]> => {
  const snapshot = await bookRef(bookId).collection('chapters').orderBy('order').get();
  const chapters = snapshot.docs.map((doc, order) => ({ id: doc.id, order: typeof doc.data().order === 'number' ? doc.data().order : order, content: typeof doc.data().content === 'string' ? doc.data().content : '' }));
  if (!chapters.length) throw new HttpsError('failed-precondition', 'Book has no chapter documents.');
  if (chapters.some(chapter => !chapter.content.trim())) throw new HttpsError('failed-precondition', 'Book contains an empty chapter.');
  return chapters;
};

const prepareChapter = (chapter: Chapter): PreparedChapter => {
  const contentHash = hash(chapter.content); const sentences: PreparedSentence[] = []; const tokens: PreparedToken[] = []; let nextIndex = 0;
  for (const [order, segmented] of segmentEnglishSentences(chapter.content).entries()) {
    const sourceHash = hash(segmented.text); const id = `sentence-${hash(`${contentHash}:${order}:${sourceHash}`).slice(0, 24)}`;
    const sentenceTokens = tokenizeSentence(segmented.text, id, nextIndex, segmented.start); nextIndex += sentenceTokens.length;
    sentences.push({ id, chapterId: chapter.id, order, sourceText: segmented.text, sourceStart: segmented.start, sourceEnd: segmented.end, sourceHash, tokenStartIndex: sentenceTokens[0]?.index ?? nextIndex, tokenEndIndex: sentenceTokens[sentenceTokens.length - 1]?.index ?? nextIndex }); tokens.push(...sentenceTokens);
  }
  return { chapter, contentHash, sentences, tokens };
};

const pairFromBook = (data: Record<string, unknown>): LanguagePair => ({ sourceLanguage: typeof data.sourceLanguage === 'string' ? data.sourceLanguage : 'en', targetLanguage: typeof data.targetLanguage === 'string' ? data.targetLanguage : 'tr' });
const requireBook = async (bookId: string) => { const snapshot = await bookRef(bookId).get(); if (!snapshot.exists) throw new HttpsError('not-found', 'Book not found.'); return snapshot; };

export const getBookLanguagePreflight = async (bookId: string) => {
  const snapshot = await requireBook(bookId); const pair = pairFromBook(snapshot.data() || {}); if (!supportedPair(pair)) throw new HttpsError('failed-precondition', 'Only en to tr preprocessing is currently supported.');
  const chapters = await readChapters(bookId); const sourceCharacters = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0); if (sourceCharacters > MAX_BOOK_PROCESSING_CHARS) throw new HttpsError('failed-precondition', 'Book exceeds the safe preprocessing size limit.');
  const prepared = chapters.map(prepareChapter); const unique = new Set(prepared.flatMap(chapter => chapter.tokens.filter(token => token.isWord && token.normalized).map(token => token.normalized as string)));
  const refs = [...unique].map(word => adminDb.collection('dictionary').doc(dictionaryId(pair, word))); const docs = (await Promise.all(chunks(refs, 400).map(group => adminDb.getAll(...group)))).flat(); const hits = docs.filter(doc => doc.exists).length;
  return { bookId, ...pair, chapterCount: chapters.length, sourceCharacters, uniqueWordsTotal: unique.size, dictionaryHits: hits, dictionaryMisses: unique.size - hits, sentencesTotal: prepared.reduce((sum, chapter) => sum + chapter.sentences.length, 0) };
};

export const getBookLanguageProcessingStatus = async (bookId: string) => {
  const snapshot = await requireBook(bookId); const data = snapshot.data() || {};
  return { bookId, languageProcessingStatus: (data.languageProcessingStatus || 'NOT_STARTED') as LanguageProcessingStatus, languageProcessingVersion: data.languageProcessingVersion, languageProcessingErrorCode: data.languageProcessingErrorCode, languageProcessingErrorMessage: data.languageProcessingErrorMessage, sourceLanguage: data.sourceLanguage || 'en', targetLanguage: data.targetLanguage || 'tr', uniqueWordsTotal: data.uniqueWordsTotal || 0, dictionaryHits: data.dictionaryHits || 0, dictionaryMisses: data.dictionaryMisses || 0, wordsTranslated: data.wordsTranslated || 0, sentencesTotal: data.sentencesTotal || 0, sentencesTranslated: data.sentencesTranslated || 0, chaptersProcessed: data.chaptersProcessed || 0 };
};

const safeErrorCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : ''; if (/quota/i.test(message)) return 'QUOTA_EXCEEDED'; if (/rate/i.test(message)) return 'RATE_LIMITED'; if (/unavailable|network|provider/i.test(message)) return 'PROVIDER_UNAVAILABLE'; return 'PROCESSING_FAILED';
};

export const startBookLanguageProcessing = async (bookId: string, provider: TranslationProvider = getTranslationProvider(), retry = false) => {
  const locked = await adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(bookRef(bookId)); if (!snapshot.exists) throw new HttpsError('not-found', 'Book not found.'); const data = snapshot.data() || {}; const status = (data.languageProcessingStatus || 'NOT_STARTED') as LanguageProcessingStatus;
    if (status === 'PROCESSING' || status === 'QUEUED') throw new HttpsError('failed-precondition', 'Language processing is already running.');
    if (status === 'COMPLETED' && !retry) return false;
    const operationId = randomUUID(); transaction.update(snapshot.ref, { languageProcessingStatus: 'QUEUED', languageProcessingVersion: LANGUAGE_PROCESSING_VERSION, languageProcessingOperationId: operationId, languageProcessingErrorCode: FieldValue.delete(), languageProcessingErrorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }); return operationId;
  });
  if (!locked) return getBookLanguageProcessingStatus(bookId);
  try {
    const preflight = await getBookLanguagePreflight(bookId); const chapters = await readChapters(bookId); const prepared = chapters.map(prepareChapter); const uniqueWords = new Map<string, string>();
    prepared.flatMap(chapter => chapter.tokens).filter(token => token.isWord && token.normalized).forEach(token => { if (!uniqueWords.has(token.normalized as string)) uniqueWords.set(token.normalized as string, token.text); });
    await bookRef(bookId).update({ languageProcessingStatus: 'PROCESSING', languageProcessingStartedAt: FieldValue.serverTimestamp(), uniqueWordsTotal: preflight.uniqueWordsTotal, dictionaryHits: preflight.dictionaryHits, dictionaryMisses: preflight.dictionaryMisses, wordsTranslated: 0, sentencesTotal: preflight.sentencesTotal, sentencesTranslated: 0, chaptersProcessed: 0, updatedAt: FieldValue.serverTimestamp() });
    const pair: LanguagePair = { sourceLanguage: preflight.sourceLanguage, targetLanguage: preflight.targetLanguage };
    const dictionaryRefs = [...uniqueWords.keys()].map(word => adminDb.collection('dictionary').doc(dictionaryId(pair, word))); const dictionaryDocs = (await Promise.all(chunks(dictionaryRefs, 400).map(group => adminDb.getAll(...group)))).flat(); const existing = new Set(dictionaryDocs.filter(doc => doc.exists).map(doc => doc.id));
    const missing = [...uniqueWords.entries()].filter(([word]) => !existing.has(dictionaryId(pair, word))).map(([normalized, text]) => ({ normalized, text })); let wordsTranslated = 0;
    for (const batchItems of translationBatches(missing)) { const translations = await provider.translateTexts(batchItems.map(item => item.text), pair); const batch = adminDb.batch(); batchItems.forEach((item, index) => batch.set(adminDb.collection('dictionary').doc(dictionaryId(pair, item.normalized)), { id: dictionaryId(pair, item.normalized), sourceLanguage: pair.sourceLanguage, targetLanguage: pair.targetLanguage, word: item.text, normalizedWord: item.normalized, translation: translations[index], provider: provider.providerName, providerVersion: provider.providerVersion, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })); await batch.commit(); wordsTranslated += batchItems.length; await bookRef(bookId).update({ wordsTranslated, updatedAt: FieldValue.serverTimestamp() }); }
    let sentencesTranslated = 0; let chaptersProcessed = 0;
    for (const chapter of prepared) {
      const chapterRef = languageChapterRef(bookId, chapter.chapter.id); const existingSentences = await chapterRef.collection('sentences').get(); const translatedById = new Map(existingSentences.docs.filter(doc => doc.data().sourceHash === chapter.sentences.find(sentence => sentence.id === doc.id)?.sourceHash && doc.data().processingVersion === LANGUAGE_PROCESSING_VERSION).map(doc => [doc.id, doc.data().translatedText as string]));
      const missingSentences = chapter.sentences.filter(sentence => !translatedById.has(sentence.id)).map(sentence => ({ ...sentence, text: sentence.sourceText }));
      for (const batchItems of translationBatches(missingSentences)) { const translations = await provider.translateTexts(batchItems.map(item => item.text), pair); const batch = adminDb.batch(); batchItems.forEach((sentence, index) => batch.set(chapterRef.collection('sentences').doc(sentence.id), { ...sentence, translatedText: translations[index], sourceLanguage: pair.sourceLanguage, targetLanguage: pair.targetLanguage, provider: provider.providerName, providerVersion: provider.providerVersion, processingVersion: LANGUAGE_PROCESSING_VERSION, chapterContentHash: chapter.contentHash, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true })); await batch.commit(); sentencesTranslated += batchItems.length; await bookRef(bookId).update({ sentencesTranslated, updatedAt: FieldValue.serverTimestamp() }); }
      const metadata = { chapterId: chapter.chapter.id, chapterContentHash: chapter.contentHash, sourceLanguage: pair.sourceLanguage, targetLanguage: pair.targetLanguage, processingVersion: LANGUAGE_PROCESSING_VERSION, tokenCount: chapter.tokens.length, tokenChunkSize: TOKEN_CHUNK_SIZE, sentenceCount: chapter.sentences.length, status: 'COMPLETED', updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }; await chapterRef.set(metadata, { merge: true });
      for (const [chunkIndex, tokenChunk] of chunks(chapter.tokens, TOKEN_CHUNK_SIZE).entries()) await chapterRef.collection('tokenChunks').doc(`chunk-${chunkIndex}`).set({ chunkIndex, tokenStartIndex: tokenChunk[0]?.index || 0, tokenEndIndex: tokenChunk[tokenChunk.length - 1]?.index || 0, tokens: tokenChunk, chapterContentHash: chapter.contentHash, processingVersion: LANGUAGE_PROCESSING_VERSION, updatedAt: FieldValue.serverTimestamp() });
      chaptersProcessed++; await bookRef(bookId).update({ chaptersProcessed, updatedAt: FieldValue.serverTimestamp() });
    }
    const latestChapters = await readChapters(bookId); const changed = latestChapters.some((chapter, index) => hash(chapter.content) !== prepared[index]?.contentHash || chapter.id !== prepared[index]?.chapter.id) || latestChapters.length !== prepared.length;
    const stillActive = await adminDb.runTransaction(async transaction => { const current = await transaction.get(bookRef(bookId)); if (current.data()?.languageProcessingOperationId !== locked) return false; if (changed) { transaction.update(current.ref, { languageProcessingStatus: 'NOT_STARTED', languageProcessingErrorCode: FieldValue.delete(), languageProcessingErrorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }); return false; } transaction.update(current.ref, { languageProcessingStatus: 'COMPLETED', languageProcessingVersion: LANGUAGE_PROCESSING_VERSION, languageProcessingCompletedAt: FieldValue.serverTimestamp(), sourceLanguage: pair.sourceLanguage, targetLanguage: pair.targetLanguage, uniqueWordsTotal: preflight.uniqueWordsTotal, dictionaryHits: preflight.dictionaryHits, dictionaryMisses: preflight.dictionaryMisses, wordsTranslated, sentencesTotal: preflight.sentencesTotal, sentencesTranslated, chaptersProcessed, languageProcessingErrorCode: FieldValue.delete(), languageProcessingErrorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }); return true; });
    if (!stillActive) return getBookLanguageProcessingStatus(bookId);
  } catch (error) {
    await bookRef(bookId).update({ languageProcessingStatus: 'FAILED', languageProcessingErrorCode: safeErrorCode(error), languageProcessingErrorMessage: 'Language preprocessing could not complete. Retry when the provider is available.', updatedAt: FieldValue.serverTimestamp() }); throw error instanceof HttpsError ? error : new HttpsError('internal', 'Language preprocessing could not complete.');
  }
  return getBookLanguageProcessingStatus(bookId);
};

export const invalidateBookLanguageProcessing = async (bookId: string) => bookRef(bookId).update({ languageProcessingStatus: 'NOT_STARTED', languageProcessingErrorCode: FieldValue.delete(), languageProcessingErrorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
