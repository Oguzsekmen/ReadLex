import { logger, setGlobalOptions } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './admin';
import { requireAdmin } from './middleware/authorization';
import { resourceId, validateBook, validatePlan } from './utils/validation';
import { cancelImport, createImport, getImport, listImports, processOcrImport, processTextImport, publishImport, registerImportSourceFiles, updateImportChapters, updateImportMetadata } from './imports/service';
import { getBookLanguagePreflight, getBookLanguageProcessingStatus as getLanguageStatus, startBookLanguageProcessing as runLanguageProcessing } from './translation/service';

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const audit = (operation: string, adminUid: string, resourceId: string, result: 'success' | 'failure') =>
  logger.info('admin_operation', { operation, adminUid, resourceId, result });

const totalWords = (chapters: Array<{ content: string }>) =>
  chapters.reduce((total, chapter) => total + chapter.content.trim().split(/\s+/).filter(Boolean).length, 0);

const writeBook = async (id: string, book: ReturnType<typeof validateBook>, creating: boolean) => {
  const ref = adminDb.collection('books').doc(id);
  const [, existingChapters] = creating ? [undefined, undefined] : await Promise.all([ref.get(), ref.collection('chapters').get()]);
  const nextChapterIds = new Set(book.chapters.map(chapter => chapter.id));
  const contentChanged = !creating && (() => {
    const current = new Map((existingChapters?.docs || []).map(chapter => [chapter.id, chapter.data().content]));
    return current.size !== book.chapters.length || book.chapters.some(chapter => current.get(chapter.id) !== chapter.content);
  })();
  const batch = adminDb.batch();
  const metadata = {
    id,
    title: book.title,
    author: book.author,
    level: book.level,
    coverUrl: book.coverUrl,
    excerpt: book.excerpt,
    totalWords: totalWords(book.chapters),
    requiredPlan: book.requiredPlan,
    archived: book.archived,
    chapterCount: book.chapters.length,
    chapterMigrationState: 'MIGRATED',
    ...(contentChanged ? { languageProcessingStatus: 'NOT_STARTED', languageProcessingOperationId: FieldValue.delete(), languageProcessingErrorCode: FieldValue.delete(), languageProcessingErrorMessage: FieldValue.delete() } : {}),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (creating) batch.create(ref, { ...metadata, sourceLanguage: 'en', targetLanguage: 'tr', languageProcessingStatus: 'NOT_STARTED', createdAt: FieldValue.serverTimestamp() });
  else batch.set(ref, metadata, { merge: true });
  for (const [order, chapter] of book.chapters.entries()) {
    batch.set(ref.collection('chapters').doc(chapter.id), {
      ...chapter,
      order,
      wordCount: chapter.content.trim().split(/\s+/).filter(Boolean).length,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  for (const chapter of existingChapters?.docs || []) {
    if (!nextChapterIds.has(chapter.id)) batch.delete(chapter.ref);
  }
  await batch.commit();
  return { ...metadata, id, chapters: book.chapters };
};

export const createBook = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const book = validateBook(request.data);
  const ref = adminDb.collection('books').doc();
  const storedBook = await writeBook(ref.id, book, true);
  audit('createBook', uid, ref.id, 'success');
  return { book: storedBook };
});

export const updateBook = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const id = resourceId(data?.id);
  const book = validateBook(data);
  const ref = adminDb.collection('books').doc(id);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Book not found.');
  const storedBook = await writeBook(id, book, false);
  audit('updateBook', uid, id, 'success');
  return { book: storedBook };
});

export const archiveBook = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const id = resourceId(data?.id);
  if (typeof data?.archived !== 'boolean') throw new HttpsError('invalid-argument', 'Invalid archived state.');
  const ref = adminDb.collection('books').doc(id);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Book not found.');
  await ref.update({ archived: data.archived, updatedAt: FieldValue.serverTimestamp() });
  audit('archiveBook', uid, id, 'success');
  return { id, archived: data.archived };
});

export const deleteBook = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const id = resourceId((request.data as Record<string, unknown>)?.id);
  const ref = adminDb.collection('books').doc(id);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Book not found.');
  await ref.delete();
  audit('deleteBook', uid, id, 'success');
  return { id };
});

export const createPlan = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const plan = validatePlan(request.data);
  const ref = adminDb.collection('plans').doc(plan.id);
  if ((await ref.get()).exists) throw new HttpsError('already-exists', 'Plan already exists.');
  await ref.create(plan);
  audit('createPlan', uid, plan.id, 'success');
  return { plan };
});

export const updatePlan = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const plan = validatePlan(request.data);
  const ref = adminDb.collection('plans').doc(plan.id);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Plan not found.');
  await ref.set(plan);
  audit('updatePlan', uid, plan.id, 'success');
  return { plan };
});

export const deletePlan = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const id = resourceId((request.data as Record<string, unknown>)?.id);
  const ref = adminDb.collection('plans').doc(id);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Plan not found.');
  await ref.delete();
  audit('deletePlan', uid, id, 'success');
  return { id };
});

export const listUsers = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const result = await adminAuth.listUsers(1000);
  const users = result.users.map(user => ({
    id: user.uid,
    email: user.email || null,
    name: user.displayName || null,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    isAdmin: user.customClaims?.admin === true
  }));
  audit('listUsers', uid, 'batch', 'success');
  return { users };
});

export const createBookImport = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const imported = await createImport(uid, request.data);
  audit('createBookImport', uid, imported.id, 'success');
  return { import: imported };
});

export const getBookImport = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const id = resourceId((request.data as Record<string, unknown>)?.id);
  const imported = await getImport(id);
  audit('getBookImport', uid, id, 'success');
  return { import: imported };
});

export const listBookImports = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const imports = await listImports();
  audit('listBookImports', uid, 'batch', 'success');
  return { imports };
});

export const updateBookImportMetadata = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const id = resourceId(data?.id);
  const imported = await updateImportMetadata(id, data?.metadata);
  audit('updateBookImportMetadata', uid, id, 'success');
  return { import: imported };
});

export const setBookImportText = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const id = resourceId(data?.id);
  const imported = await processTextImport(id, data?.rawText);
  audit('setBookImportText', uid, id, 'success');
  return { import: imported };
});

export const registerBookImportSourceFiles = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const id = resourceId(data?.id);
  const imported = await registerImportSourceFiles(id, data?.files);
  audit('registerBookImportSourceFiles', uid, id, 'success');
  return { import: imported };
});

export const startBookImportOcr = onCall({ timeoutSeconds: 120, memory: '1GiB' }, async (request) => {
  const { uid } = requireAdmin(request);
  const id = resourceId((request.data as Record<string, unknown>)?.id);
  const imported = await processOcrImport(id);
  audit('startBookImportOcr', uid, id, 'success');
  return { import: imported };
});

export const updateBookImportChapters = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const id = resourceId(data?.id);
  const imported = await updateImportChapters(id, data?.chapters);
  audit('updateBookImportChapters', uid, id, 'success');
  return { import: imported };
});

export const cancelBookImport = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const id = resourceId((request.data as Record<string, unknown>)?.id);
  const imported = await cancelImport(id);
  audit('cancelBookImport', uid, id, 'success');
  return { import: imported };
});

export const publishBookImport = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const id = resourceId((request.data as Record<string, unknown>)?.id);
  const published = await publishImport(id);
  audit('publishBookImport', uid, id, 'success');
  return published;
});

export const getBookLanguageProcessingPreflight = onCall(async (request) => {
  const { uid } = requireAdmin(request); const id = resourceId((request.data as Record<string, unknown>)?.id);
  const preflight = await getBookLanguagePreflight(id); audit('getBookLanguageProcessingPreflight', uid, id, 'success'); return { preflight };
});

export const getBookLanguageProcessingStatus = onCall(async (request) => {
  const { uid } = requireAdmin(request); const id = resourceId((request.data as Record<string, unknown>)?.id);
  const status = await getLanguageStatus(id); audit('getBookLanguageProcessingStatus', uid, id, 'success'); return { status };
});

export const startBookLanguageProcessing = onCall({ timeoutSeconds: 300, memory: '1GiB' }, async (request) => {
  const { uid } = requireAdmin(request); const id = resourceId((request.data as Record<string, unknown>)?.id);
  const status = await runLanguageProcessing(id); audit('startBookLanguageProcessing', uid, id, 'success'); return { status };
});

export const retryBookLanguageProcessing = onCall({ timeoutSeconds: 300, memory: '1GiB' }, async (request) => {
  const { uid } = requireAdmin(request); const id = resourceId((request.data as Record<string, unknown>)?.id);
  const status = await runLanguageProcessing(id, undefined, true); audit('retryBookLanguageProcessing', uid, id, 'success'); return { status };
});
