import { logger, setGlobalOptions } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth, adminDb } from './admin';
import { requireAdmin } from './middleware/authorization';
import { resourceId, validateBook, validatePlan } from './utils/validation';

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const audit = (operation: string, adminUid: string, resourceId: string, result: 'success' | 'failure') =>
  logger.info('admin_operation', { operation, adminUid, resourceId, result });

const totalWords = (chapters: Array<{ content: string }>) =>
  chapters.reduce((total, chapter) => total + chapter.content.trim().split(/\s+/).filter(Boolean).length, 0);

export const createBook = onCall(async (request) => {
  const { uid } = requireAdmin(request);
  const book = validateBook(request.data);
  const ref = adminDb.collection('books').doc();
  const storedBook = { id: ref.id, ...book, totalWords: totalWords(book.chapters) };
  await ref.create(storedBook);
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
  const storedBook = { id, ...book, totalWords: totalWords(book.chapters) };
  await ref.set(storedBook);
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
  await ref.update({ archived: data.archived });
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
