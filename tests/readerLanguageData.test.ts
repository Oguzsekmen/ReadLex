import { describe, expect, it } from 'vitest';
import { contentHash, LatestTapGuard, PreparedReaderToken, ReaderLanguageDataService, ReaderLanguageRepository } from '../services/readerLanguageData';
import { vocabularyFromPreparedToken } from '../services/readerVocabulary';

const text = 'The door opened. He closed the door.';
const tokens: PreparedReaderToken[] = [
  { index: 0, text: 'The', normalized: 'the', start: 0, end: 3, sentenceId: 's1', isWord: true }, { index: 1, text: ' ', normalized: null, start: 3, end: 4, sentenceId: 's1', isWord: false }, { index: 2, text: 'door', normalized: 'door', start: 4, end: 8, sentenceId: 's1', isWord: true },
  { index: 7, text: 'He', normalized: 'he', start: 17, end: 19, sentenceId: 's2', isWord: true }, { index: 13, text: 'door', normalized: 'door', start: 31, end: 35, sentenceId: 's2', isWord: true }
];

const createRepository = async () => {
  const hash = await contentHash(text); let dictionaryReads = 0; let sentenceReads = 0;
  const repository: ReaderLanguageRepository = {
    getMetadata: async () => ({ status: 'COMPLETED', chapterContentHash: hash, processingVersion: 'language-preprocessing-v1', sourceLanguage: 'en', targetLanguage: 'tr', tokenChunkSize: 300 }),
    getTokenChunks: async () => [tokens],
    getDictionaryEntries: async () => { dictionaryReads++; return [{ id: 'door-id', word: 'door', normalizedWord: 'door', translation: 'kapı' }, { id: 'the-id', word: 'the', normalizedWord: 'the', translation: 'bu' }, { id: 'he-id', word: 'he', normalizedWord: 'he', translation: 'o' }]; },
    getSentence: async (_book, _chapter, id) => { sentenceReads++; return id === 's2' ? { id, sourceText: 'He closed the door.', translatedText: 'Kapıyı kapattı.', sourceHash: 's2', chapterContentHash: hash, processingVersion: 'language-preprocessing-v1' } : { id, sourceText: 'The door opened.', translatedText: 'Kapı açıldı.', sourceHash: 's1', chapterContentHash: hash, processingVersion: 'language-preprocessing-v1' }; }
  };
  return { repository, reads: () => ({ dictionaryReads, sentenceReads }) };
};

describe('prepared reader language data', () => {
  it('maps repeated occurrences to their exact prepared sentence and caches reads', async () => {
    const fixture = await createRepository(); const service = new ReaderLanguageDataService(fixture.repository);
    const first = await service.resolve('book', 'chapter', text, 2); const second = await service.resolve('book', 'chapter', text, 13); const repeat = await service.resolve('book', 'chapter', text, 13);
    expect(first.state).toBe('ready'); expect(second.state).toBe('ready'); expect(repeat.state).toBe('ready');
    if (second.state === 'ready') { expect(second.token.start).toBe(31); expect(second.sentence?.id).toBe('s2'); expect(second.sentence?.translatedText).toBe('Kapıyı kapattı.'); expect(second.dictionary?.translation).toBe('kapı'); }
    expect(fixture.reads()).toEqual({ dictionaryReads: 1, sentenceReads: 2 });
  });

  it('rejects stale or missing prepared chapter data without a runtime provider', async () => {
    const fixture = await createRepository(); const stale: ReaderLanguageRepository = { ...fixture.repository, getMetadata: async () => ({ status: 'COMPLETED', chapterContentHash: 'old-hash', processingVersion: 'language-preprocessing-v1', sourceLanguage: 'en', targetLanguage: 'tr', tokenChunkSize: 300 }) };
    const result = await new ReaderLanguageDataService(stale).resolve('book', 'chapter', text, 2);
    expect(result).toEqual({ state: 'unavailable', reason: 'STALE' }); expect(fixture.reads().dictionaryReads).toBe(0);
    const missing: ReaderLanguageRepository = { ...fixture.repository, getTokenChunks: async () => [] };
    await expect(new ReaderLanguageDataService(missing).resolve('book', 'chapter', text, 2)).resolves.toEqual({ state: 'unavailable', reason: 'MISSING_DATA' });
  });

  it('protects the latest tap and saves vocabulary from the exact prepared context', () => {
    const guard = new LatestTapGuard(); const first = guard.next(); const second = guard.next(); expect(guard.isLatest(first)).toBe(false); expect(guard.isLatest(second)).toBe(true);
    const entry = vocabularyFromPreparedToken({ id: 'book', title: 'B', author: 'A', level: 'A1', coverUrl: '', excerpt: '', totalWords: 0, requiredPlan: ['FREE'], archived: false }, 'chapter', tokens[4], { id: 'door', word: 'door', normalizedWord: 'door', translation: 'kapı' }, { id: 's2', sourceText: 'He closed the door.', translatedText: 'Kapıyı kapattı.', sourceHash: 's2', chapterContentHash: 'hash', processingVersion: 'v1' });
    expect(entry).toMatchObject({ normalizedWord: 'door', sourceChapterId: 'chapter', exampleSentence: 'He closed the door.', translation: 'kapı' });
  });
});
