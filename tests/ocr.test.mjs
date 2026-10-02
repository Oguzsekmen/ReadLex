import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-readlex-tests'; const host = '127.0.0.1'; const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`; process.env.GCLOUD_PROJECT = projectId;
const { adminDb } = await import('../functions/lib/admin.js');
const { createImport, getImport, processOcrImport, publishImport } = await import('../functions/lib/imports/service.js');
const { validateImportSourceFiles } = await import('../functions/lib/imports/validation.js');
let testEnv;
const metadata = { title: 'OCR Book', author: 'Admin', level: 'A2', requiredPlan: ['FREE'], coverUrl: 'https://example.test/c.png' };
const source = (id, order) => ({ id, fileName: `${id}.jpg`, storagePath: `book-imports/IMPORT/source/${id}-${id}.jpg`, contentType: 'image/jpeg', size: 100, order });
before(async () => { testEnv = await initializeTestEnvironment({ projectId, firestore: { host, port } }); });
beforeEach(async () => testEnv.clearFirestore()); after(async () => testEnv.cleanup());

test('source validation limits types, path, size, and image count', () => {
  assert.equal(validateImportSourceFiles('IMPORT', 'IMAGE', [source('a', 0)]).length, 1);
  assert.throws(() => validateImportSourceFiles('IMPORT', 'IMAGE', [{ ...source('a', 0), contentType: 'application/pdf' }]));
  assert.throws(() => validateImportSourceFiles('IMPORT', 'PDF', [source('a', 0)]));
});

test('OCR uses page order, stores page data outside import document, and publishes once', async () => {
  const created = await createImport('admin', { sourceType: 'IMAGE', ...metadata });
  const files = [source('first', 0), source('second', 1)];
  await adminDb.collection('bookImports').doc(created.id).update({ status: 'UPLOADED', sourceFiles: files, ocrStatus: 'NOT_STARTED' });
  const calls = [];
  const fake = { extractImage: async ({ sourceFile }) => { calls.push(sourceFile.id); return { id: sourceFile.id, pageNumber: sourceFile.order + 1, text: sourceFile.order ? 'Chapter 2\nThree four.' : 'Chapter 1\nOne two.' }; }, extractPdf: async () => [] };
  const result = await processOcrImport(created.id, fake);
  assert.deepEqual(calls, ['first', 'second']); assert.equal(result.status, 'READY_TO_PUBLISH');
  assert.equal(result.rawText, 'Chapter 1\nOne two.\n\nChapter 2\nThree four.');
  const root = await adminDb.collection('bookImports').doc(created.id).get(); assert.equal(root.data().detectedChapters, undefined);
  assert.equal((await root.ref.collection('pages').get()).size, 2);
  const first = await publishImport(created.id); const second = await publishImport(created.id);
  assert.equal(second.alreadyPublished, true); assert.equal(first.bookId, second.bookId);
  assert.equal((await adminDb.collection('books').doc(first.bookId).get()).data().source.type, 'OCR_IMAGE');
});

test('empty provider output fails safely and duplicate process cannot run', async () => {
  const created = await createImport('admin', { sourceType: 'IMAGE', ...metadata });
  await adminDb.collection('bookImports').doc(created.id).update({ status: 'UPLOADED', sourceFiles: [source('only', 0)], ocrStatus: 'NOT_STARTED' });
  const empty = { extractImage: async () => ({ id: 'only', pageNumber: 1, text: '' }), extractPdf: async () => [] };
  await assert.rejects(() => processOcrImport(created.id, empty));
  assert.equal((await getImport(created.id)).status, 'FAILED');
  await adminDb.collection('bookImports').doc(created.id).update({ status: 'PROCESSING', ocrStatus: 'PROCESSING' });
  await assert.rejects(() => processOcrImport(created.id, empty));
  await assert.rejects(() => publishImport(created.id));
});
