import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { after, before, beforeEach, test } from 'node:test';
import { clearFirestoreData, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const execFileAsync = promisify(execFile);
const projectId = 'demo-readlex-tests';
const host = '127.0.0.1';
const port = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
process.env.GCLOUD_PROJECT = projectId;
const { adminDb } = await import('../functions/lib/admin.js');
let testEnv;

const runMigration = async (...args) => execFileAsync(process.execPath, ['functions/lib/scripts/migrateLegacyData.js', ...args], {
  cwd: process.cwd(),
  env: { ...process.env, FIRESTORE_EMULATOR_HOST: `${host}:${port}`, GCLOUD_PROJECT: projectId }
});

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Migration tests require FIRESTORE_EMULATOR_HOST. Use npm run test:migrations.');
  testEnv = await initializeTestEnvironment({ projectId, firestore: { host, port } });
});
beforeEach(async () => clearFirestoreData({ projectId, host, port }));
after(async () => testEnv.cleanup());

test('Admin SDK writes through the trusted emulator boundary', async () => {
  await adminDb.collection('books').doc('admin-written').set({ title: 'Trusted fixture' });
  assert.equal((await adminDb.collection('books').doc('admin-written').get()).data().title, 'Trusted fixture');
});

test('book migration copies all chapters, keeps legacy data, and is idempotent', async () => {
  const legacyChapters = [
    { id: 'chapter-a', title: 'First', content: 'one two' },
    { id: 'chapter-b', title: 'Second', content: 'three four five' }
  ];
  await adminDb.collection('books').doc('legacy-book').set({ title: 'Legacy', author: 'Fixture', chapters: legacyChapters });
  await runMigration('books');
  const book = await adminDb.collection('books').doc('legacy-book').get();
  const chapters = await book.ref.collection('chapters').orderBy('order').get();
  assert.deepEqual(book.data().chapters, legacyChapters);
  assert.equal(book.data().chapterMigrationState, 'MIGRATED');
  assert.equal(book.data().chapterCount, 2);
  assert.deepEqual(chapters.docs.map(snapshot => [snapshot.id, snapshot.data().title, snapshot.data().content, snapshot.data().order]), [
    ['chapter-a', 'First', 'one two', 0], ['chapter-b', 'Second', 'three four five', 1]
  ]);
  assert.equal(typeof chapters.docs[0].data().migratedAt.toDate, 'function');
  await runMigration('books');
  assert.equal((await book.ref.collection('chapters').get()).size, 2);
  assert.ok((await adminDb.collection('migrationMetadata').doc('books').get()).data().completedAt);
});

test('book migration resumes after its recorded cursor without duplicating chapters', async () => {
  await adminDb.collection('books').doc('book-001').set({ title: 'Earlier', chapters: [] });
  await adminDb.collection('books').doc('book-002').set({ title: 'Later', chapters: [{ id: 'c', title: 'Only', content: 'fixture' }] });
  await adminDb.collection('migrationMetadata').doc('books').set({ lastBookId: 'book-001' });
  await runMigration('books');
  assert.equal((await adminDb.collection('books').doc('book-002').collection('chapters').get()).size, 1);
  assert.equal((await adminDb.collection('migrationMetadata').doc('books').get()).data().lastBookId, undefined);
});

test('vocabulary migration uses deterministic normalized IDs and is retry-safe', async () => {
  await adminDb.collection('vocabulary').doc('user-1').set({ words: [
    { id: 'old-a', word: 'Word', translation: 'first', sourceBookId: 'book', sourceChapterId: 'chapter' },
    { id: 'old-b', word: 'word', translation: 'last', sourceBookId: 'book', sourceChapterId: 'chapter' },
    { id: 'old-c', word: 'word', translation: 'other', sourceBookId: 'book', sourceChapterId: 'chapter-2' }
  ] });
  await runMigration('vocabulary', 'user-1');
  const entries = await adminDb.collection('users').doc('user-1').collection('vocabulary').get();
  assert.equal(entries.size, 2);
  assert.equal(entries.docs.find(snapshot => snapshot.id === 'v1-en-word-book-chapter').data().translation, 'last');
  assert.equal(entries.docs.find(snapshot => snapshot.id === 'v1-en-word-book-chapter-2').data().translation, 'other');
  assert.ok((await adminDb.collection('migrationMetadata').doc('vocabulary-user-1').get()).data().completedAt);
  assert.equal((await adminDb.collection('users').doc('user-1').collection('migrationState').doc('data').get()).data().vocabularyMigrationState, 'MIGRATED');
  await runMigration('vocabulary', 'user-1');
  assert.equal((await adminDb.collection('users').doc('user-1').collection('vocabulary').get()).size, 2);
});

test('progress migration preserves every book record and leaves legacy data untouched', async () => {
  const progress = {
    'book-1': { bookId: 'book-1', status: 'IN_PROGRESS', currentChapterIndex: 2, lastWordIndex: 8 },
    'book-2': 'COMPLETED'
  };
  await adminDb.collection('progress').doc('user-1').set({ progress });
  await runMigration('progress', 'user-1');
  const copied = await adminDb.collection('users').doc('user-1').collection('progress').get();
  assert.equal(copied.size, 2);
  assert.deepEqual((await adminDb.collection('users').doc('user-1').collection('progress').doc('book-1').get()).data().currentChapterIndex, 2);
  assert.equal((await adminDb.collection('users').doc('user-1').collection('progress').doc('book-2').get()).data().status, 'COMPLETED');
  assert.deepEqual((await adminDb.collection('progress').doc('user-1').get()).data().progress, progress);
  assert.equal((await adminDb.collection('users').doc('user-1').collection('migrationState').doc('data').get()).data().progressMigrationState, 'MIGRATED');
  await runMigration('progress', 'user-1');
  assert.equal((await adminDb.collection('users').doc('user-1').collection('progress').get()).size, 2);
});
