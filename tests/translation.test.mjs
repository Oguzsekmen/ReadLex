import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests'; const host = '127.0.0.1'; const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`; process.env.GCLOUD_PROJECT = projectId;
const { adminDb } = await import('../functions/lib/admin.js');
const { segmentEnglishSentences } = await import('../functions/lib/translation/segmentation.js');
const { tokenizeSentence } = await import('../functions/lib/translation/tokenization.js');
const { normalizeDictionaryWord } = await import('../functions/lib/translation/normalization.js');
const { getBookLanguagePreflight, getBookLanguageProcessingStatus, invalidateBookLanguageProcessing, startBookLanguageProcessing } = await import('../functions/lib/translation/service.js');
const { requireAdmin } = await import('../functions/lib/middleware/authorization.js');
let env;
const seed = async (id, chapters) => {
  await adminDb.collection('books').doc(id).set({ id, title: 'Translation Fixture', sourceLanguage: 'en', targetLanguage: 'tr', languageProcessingStatus: 'NOT_STARTED' });
  await Promise.all(chapters.map((content, order) => adminDb.collection('books').doc(id).collection('chapters').doc(`chapter-${order + 1}`).set({ id: `chapter-${order + 1}`, order, content })));
};
const fake = (calls, failAt = 0) => ({ providerName: 'fake', providerVersion: 'v1', translateTexts: async (texts) => { calls.push(texts); if (failAt && calls.length === failAt) throw new Error('provider unavailable'); return texts.map(text => `tr:${text}`); } });
const word = index => { let value = index; let suffix = ''; do { suffix = String.fromCharCode(97 + value % 26) + suffix; value = Math.floor(value / 26) - 1; } while (value >= 0); return `word${suffix}`; };
before(async () => { env = await initializeTestEnvironment({ projectId, firestore: { host, port } }); });
beforeEach(async () => env.clearFirestore()); after(async () => env.cleanup());

test('segmenter, normalization, and tokenizer preserve punctuation and repeated-word occurrences', () => {
  assert.deepEqual(segmentEnglishSentences('Dr. Adams said, "Hello!"\n\nThe door opened. He closed the door.').map(item => item.text), ['Dr. Adams said, "Hello!"', 'The door opened.', 'He closed the door.']);
  assert.equal(normalizeDictionaryWord('Beautiful'), 'beautiful'); assert.equal(normalizeDictionaryWord("door's"), 'door'); assert.equal(normalizeDictionaryWord("don't"), "don't");
  const tokens = tokenizeSentence('The door opened. He closed the door.', 's1', 0, 0).filter(token => token.isWord && token.normalized === 'door');
  assert.deepEqual(tokens.map(token => [token.index, token.start, token.end]), [[2, 4, 8], [13, 31, 35]]);
});

test('preflight uses global dictionary hits and processing stores sentences, token chunks, and cached words', async () => {
  await seed('book-a', ['The door opened. He closed the door.']);
  const initial = await getBookLanguagePreflight('book-a'); assert.equal(initial.uniqueWordsTotal, 5); assert.equal(initial.dictionaryHits, 0); assert.equal(initial.sentencesTotal, 2);
  const calls = []; const completed = await startBookLanguageProcessing('book-a', fake(calls));
  assert.equal(completed.languageProcessingStatus, 'COMPLETED'); assert.equal(completed.wordsTranslated, 5); assert.equal(completed.sentencesTranslated, 2);
  assert.equal((await adminDb.collection('dictionary').get()).size, 5);
  const language = await adminDb.collection('books').doc('book-a').collection('languageChapters').doc('chapter-1').get();
  assert.equal(language.data().tokenCount > 0, true); assert.equal((await language.ref.collection('sentences').get()).size, 2); assert.equal((await language.ref.collection('tokenChunks').get()).size, 1);
  await seed('book-b', ['The door remained open.']); const cached = await getBookLanguagePreflight('book-b'); assert.equal(cached.dictionaryHits >= 2, true);
  const secondCalls = []; await startBookLanguageProcessing('book-a', fake(secondCalls)); assert.equal(secondCalls.length, 0);
});

test('partial word batch failure resumes from persisted dictionary entries without duplicate work', async () => {
  const source = Array.from({ length: 101 }, (_, index) => word(index)).join(' ') + '.'; await seed('book-resume', [source]);
  const failingCalls = []; await assert.rejects(() => startBookLanguageProcessing('book-resume', fake(failingCalls, 2)));
  assert.equal((await adminDb.collection('dictionary').get()).size, 100); assert.equal((await getBookLanguageProcessingStatus('book-resume')).languageProcessingStatus, 'FAILED');
  const resumedCalls = []; const completed = await startBookLanguageProcessing('book-resume', fake(resumedCalls), true);
  assert.equal(completed.languageProcessingStatus, 'COMPLETED'); assert.equal((await adminDb.collection('dictionary').get()).size, 101);
  assert.equal(resumedCalls[0].length, 1);
});

test('content invalidation is explicit, source hashes change, and processing remains admin-only', async () => {
  await seed('book-invalidate', ['A first sentence.']); await startBookLanguageProcessing('book-invalidate', fake([]));
  const language = adminDb.collection('books').doc('book-invalidate').collection('languageChapters').doc('chapter-1'); const beforeHash = (await language.get()).data().chapterContentHash;
  await adminDb.collection('books').doc('book-invalidate').collection('chapters').doc('chapter-1').update({ content: 'A changed sentence.' }); await invalidateBookLanguageProcessing('book-invalidate');
  assert.equal((await getBookLanguageProcessingStatus('book-invalidate')).languageProcessingStatus, 'NOT_STARTED'); await startBookLanguageProcessing('book-invalidate', fake([]));
  assert.notEqual((await language.get()).data().chapterContentHash, beforeHash);
  assert.throws(() => requireAdmin({ auth: { uid: 'reader', token: {} } }));
});
