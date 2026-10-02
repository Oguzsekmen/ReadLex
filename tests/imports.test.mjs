import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests';
const host = '127.0.0.1';
const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
process.env.GCLOUD_PROJECT = projectId;

const { adminDb } = await import('../functions/lib/admin.js');
const { normalizeImportText } = await import('../functions/lib/imports/normalization.js');
const { detectImportChapters } = await import('../functions/lib/imports/chapterDetection.js');
const { assertImportTransition } = await import('../functions/lib/imports/status.js');
const { requireAdmin } = await import('../functions/lib/middleware/authorization.js');
const { createImport, processTextImport, publishImport, getImport } = await import('../functions/lib/imports/service.js');
let testEnv;

const metadata = {
  title: 'Fixture Book', author: 'Fixture Author', level: 'A2', requiredPlan: ['FREE'], coverUrl: 'https://example.test/cover.png'
};

before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== `${host}:${port}`) throw new Error('Import tests require the explicit local Firestore Emulator.');
  testEnv = await initializeTestEnvironment({ projectId, firestore: { host, port } });
});
beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test('normalization preserves paragraphs and Unicode while applying conservative cleanup', () => {
  const normalized = normalizeImportText('  Hello  world.\r\n\r\n12\r\n\r\nİstan-\r\nbul  is  here.\r\n\r\n\r\nNext paragraph.  ');
  assert.equal(normalized, 'Hello world.\n\nİstanbul is here.\n\nNext paragraph.');
});

test('chapter detection recognizes obvious headings and falls back conservatively', () => {
  const detected = detectImportChapters('CHAPTER 1\nFirst text.\n\nPart II\nSecond text.');
  assert.deepEqual(detected.chapters.map(chapter => [chapter.title, chapter.order, chapter.content]), [
    ['CHAPTER 1', 0, 'First text.'], ['Part II', 1, 'Second text.']
  ]);
  assert.equal(detected.reviewRequired, false);
  const fallback = detectImportChapters('No obvious heading here.');
  assert.equal(fallback.reviewRequired, true);
  assert.equal(fallback.chapters.length, 1);
});

test('status machine rejects invalid transitions and unauthenticated/non-admin access', () => {
  assert.throws(() => assertImportTransition('PUBLISHED', 'READY_TO_PUBLISH'));
  assert.throws(() => requireAdmin({ auth: null }));
  assert.throws(() => requireAdmin({ auth: { uid: 'user', token: {} } }));
  assert.deepEqual(requireAdmin({ auth: { uid: 'admin', token: { admin: true } } }).uid, 'admin');
});

test('TEXT import publishes chapters and metadata exactly once', async () => {
  const created = await createImport('admin-1', { sourceType: 'TEXT', ...metadata });
  const processed = await processTextImport(created.id, 'Chapter 1\nOne two.\n\nChapter 2\nThree four five.');
  assert.equal(processed.status, 'READY_TO_PUBLISH');
  assert.equal(processed.rawText, 'Chapter 1\nOne two.\n\nChapter 2\nThree four five.');
  assert.equal(processed.normalizedText, 'Chapter 1\nOne two.\n\nChapter 2\nThree four five.');
  const firstPublish = await publishImport(created.id);
  const secondPublish = await publishImport(created.id);
  assert.equal(secondPublish.bookId, firstPublish.bookId);
  assert.equal(secondPublish.alreadyPublished, true);
  const book = await adminDb.collection('books').doc(firstPublish.bookId).get();
  const chapters = await book.ref.collection('chapters').orderBy('order').get();
  assert.equal(book.data().chapterCount, 2);
  assert.equal(book.data().totalWords, 5);
  assert.deepEqual(book.data().source, { type: 'MANUAL_TEXT', importId: created.id });
  assert.equal(book.data().languageProcessingStatus, 'NOT_STARTED');
  assert.deepEqual(chapters.docs.map(chapter => [chapter.id, chapter.data().title, chapter.data().order]), [
    ['chapter-1', 'Chapter 1', 0], ['chapter-2', 'Chapter 2', 1]
  ]);
  assert.equal((await getImport(created.id)).publishedBookId, firstPublish.bookId);
});

test('invalid or canceled imports cannot publish and IMAGE extraction stays unimplemented', async () => {
  const draft = await createImport('admin-1', { sourceType: 'TEXT', ...metadata });
  await assert.rejects(() => publishImport(draft.id));
  const image = await createImport('admin-1', { sourceType: 'IMAGE', ...metadata });
  await assert.rejects(() => processTextImport(image.id, 'not OCR'), /NOT_IMPLEMENTED_YET/);
  await adminDb.collection('bookImports').doc(draft.id).update({ status: 'CANCELED' });
  await assert.rejects(() => publishImport(draft.id));
  const failed = await createImport('admin-1', { sourceType: 'TEXT', ...metadata });
  await adminDb.collection('bookImports').doc(failed.id).update({ status: 'FAILED' });
  await assert.rejects(() => publishImport(failed.id));
});
