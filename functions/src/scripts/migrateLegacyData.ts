import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../admin';

const [scope, uid] = process.argv.slice(2);
const migrationVersion = '2a-scalable-model';

const wordCount = (content: string) => content.trim().split(/\s+/).filter(Boolean).length;
const chunks = <T>(items: T[], size = 400) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

const migrateBooks = async () => {
  const metadataRef = adminDb.collection('migrationMetadata').doc('books');
  const state = await metadataRef.get();
  let lastBookId = typeof state.data()?.lastBookId === 'string' ? state.data()?.lastBookId : undefined;

  while (true) {
    let booksQuery = adminDb.collection('books').orderBy(FieldPath.documentId()).limit(100);
    if (lastBookId) booksQuery = booksQuery.startAfter(lastBookId);
    const books = await booksQuery.get();
    if (books.empty) break;

    for (const book of books.docs) {
      const chapters = book.data().chapters;
      if (Array.isArray(chapters) && chapters.length) {
        for (const [chunkIndex, chapterChunk] of chunks(chapters).entries()) {
          const batch = adminDb.batch();
          chapterChunk.forEach((chapter: Record<string, unknown>, offset: number) => {
            const order = chunkIndex * 400 + offset;
            const id = typeof chapter.id === 'string' ? chapter.id : `legacy-${order}`;
            const content = typeof chapter.content === 'string' ? chapter.content : '';
            batch.set(book.ref.collection('chapters').doc(id), {
              id,
              title: typeof chapter.title === 'string' ? chapter.title : `Chapter ${order + 1}`,
              content,
              order,
              wordCount: wordCount(content),
              migrationVersion,
              migratedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          });
          if (chunkIndex === 0) batch.set(book.ref, { chapterCount: chapters.length, migrationVersion, migratedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          await batch.commit();
        }
        console.info(JSON.stringify({ operation: 'migrateBooks', bookId: book.id, result: 'copied' }));
      }
      lastBookId = book.id;
      await metadataRef.set({ migrationVersion, lastBookId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    if (books.size < 100) break;
  }
  await metadataRef.set({ migrationVersion, completedAt: FieldValue.serverTimestamp(), lastBookId: FieldValue.delete() }, { merge: true });
};

const migrateVocabulary = async (userId: string) => {
  const legacy = await adminDb.collection('vocabulary').doc(userId).get();
  const words = legacy.data()?.words;
  if (!Array.isArray(words)) return;
  for (const [chunkIndex, wordChunk] of chunks(words).entries()) {
    const batch = adminDb.batch();
    wordChunk.forEach((word: Record<string, unknown>, offset: number) => {
      const index = chunkIndex * 400 + offset;
      const id = typeof word.id === 'string' ? `legacy-${word.id}` : `legacy-${index}`;
      batch.set(adminDb.collection('users').doc(userId).collection('vocabulary').doc(id), { ...word, id, migrationVersion, migratedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  await adminDb.collection('migrationMetadata').doc(`vocabulary-${userId}`).set({ migrationVersion, userId, completedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.info(JSON.stringify({ operation: 'migrateVocabulary', uid: userId, result: 'copied' }));
};

const migrateProgress = async (userId: string) => {
  const legacy = await adminDb.collection('progress').doc(userId).get();
  const progress = legacy.data()?.progress;
  if (!progress || typeof progress !== 'object') return;
  for (const [chunkIndex, progressChunk] of chunks(Object.entries(progress as Record<string, unknown>)).entries()) {
    const batch = adminDb.batch();
    progressChunk.forEach(([bookId, value]) => {
      const normalized = typeof value === 'string'
        ? { bookId, status: value, currentChapterIndex: value === 'COMPLETED' ? 999 : 0, lastWordIndex: 0 }
        : value as Record<string, unknown>;
      batch.set(adminDb.collection('users').doc(userId).collection('progress').doc(bookId), { ...normalized, bookId, migrationVersion, migratedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  await adminDb.collection('migrationMetadata').doc(`progress-${userId}`).set({ migrationVersion, userId, completedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.info(JSON.stringify({ operation: 'migrateProgress', uid: userId, result: 'copied' }));
};

const run = async () => {
  if (scope === 'books') return migrateBooks();
  if (scope === 'vocabulary' && uid) return migrateVocabulary(uid);
  if (scope === 'progress' && uid) return migrateProgress(uid);
  throw new Error('Usage: npm run migration:legacy -- books | vocabulary <uid> | progress <uid>');
};

run().catch(() => {
  console.error('Migration did not run. Confirm scope, owner ADC, and project configuration.');
  process.exitCode = 1;
});
