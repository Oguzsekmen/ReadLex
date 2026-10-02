import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { detectImportChapters } from './chapterDetection';
import { chapterDetectionVersion, ImportStatus, normalizationVersion } from './domain';
import { normalizeImportText } from './normalization';
import { assertImportTransition } from './status';
import { validateImportChapters, validateImportMetadata, validatePublishMetadata, validateRawText, validateSourceType } from './validation';

const importRef = (id: string) => adminDb.collection('bookImports').doc(id);
const editableStatuses: ImportStatus[] = ['DRAFT', 'UPLOADED', 'REVIEW_REQUIRED', 'READY_TO_PUBLISH'];
const wordCount = (content: string) => content.trim().split(/\s+/).filter(Boolean).length;
const defined = <T extends Record<string, unknown>>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const requireImport = async (id: string) => {
  const snapshot = await importRef(id).get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Import not found.');
  return snapshot;
};

export const createImport = async (createdBy: string, value: unknown) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'Expected an object.');
  const input = value as Record<string, unknown>;
  const metadata = validateImportMetadata(input);
  const sourceType = validateSourceType(input.sourceType);
  const ref = adminDb.collection('bookImports').doc();
  const job = {
    id: ref.id,
    createdBy,
    sourceType,
    status: 'DRAFT' as const,
    ...defined(metadata),
    normalizationVersion,
    chapterDetectionVersion,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.create(job);
  return { ...job, id: ref.id };
};

export const getImport = async (id: string) => {
  const snapshot = await requireImport(id);
  return { id: snapshot.id, ...snapshot.data() };
};

export const listImports = async () => {
  const snapshot = await adminDb.collection('bookImports').orderBy('createdAt', 'desc').limit(100).get();
  return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
};

export const updateImportMetadata = async (id: string, value: unknown) => {
  const snapshot = await requireImport(id);
  const status = (snapshot.data() || {}).status as ImportStatus;
  if (!editableStatuses.includes(status)) throw new HttpsError('failed-precondition', 'Import metadata cannot be changed in its current state.');
  const metadata = validateImportMetadata(value);
  await snapshot.ref.update({ ...defined(metadata), updatedAt: FieldValue.serverTimestamp() });
  return getImport(id);
};

export const processTextImport = async (id: string, rawTextValue: unknown) => {
  const snapshot = await requireImport(id);
  const data = snapshot.data() || {};
  const status = data.status as ImportStatus;
  if (data.sourceType !== 'TEXT') throw new HttpsError('failed-precondition', 'NOT_IMPLEMENTED_YET');
  if (!editableStatuses.includes(status)) throw new HttpsError('failed-precondition', 'Import text cannot be processed in its current state.');
  assertImportTransition(status, 'PROCESSING');
  const rawText = validateRawText(rawTextValue);
  const normalizedText = normalizeImportText(rawText);
  if (!normalizedText) throw new HttpsError('invalid-argument', 'Text contains no importable content.');
  const detection = detectImportChapters(normalizedText);
  const nextStatus: ImportStatus = detection.reviewRequired ? 'REVIEW_REQUIRED' : 'READY_TO_PUBLISH';
  assertImportTransition('PROCESSING', nextStatus);
  await snapshot.ref.update({ status: 'PROCESSING', processingStartedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  try {
    await snapshot.ref.update({
      status: nextStatus,
      rawText,
      normalizedText,
      detectedChapters: detection.chapters,
      normalizationVersion,
      chapterDetectionVersion,
      processingCompletedAt: FieldValue.serverTimestamp(),
      errorCode: FieldValue.delete(),
      errorMessage: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    await snapshot.ref.update({
      status: 'FAILED',
      errorCode: 'TEXT_PROCESSING_FAILED',
      errorMessage: 'Text processing could not complete.',
      updatedAt: FieldValue.serverTimestamp()
    });
    throw error;
  }
  return getImport(id);
};

export const updateImportChapters = async (id: string, value: unknown) => {
  const snapshot = await requireImport(id);
  const status = (snapshot.data() || {}).status as ImportStatus;
  if (status !== 'REVIEW_REQUIRED' && status !== 'READY_TO_PUBLISH') throw new HttpsError('failed-precondition', 'Import chapters cannot be edited in its current state.');
  const chapters = validateImportChapters(value);
  const nextStatus: ImportStatus = chapters.length && chapters.every(chapter => chapter.content.trim()) ? 'READY_TO_PUBLISH' : 'REVIEW_REQUIRED';
  if (nextStatus !== status) assertImportTransition(status, nextStatus);
  await snapshot.ref.update({ detectedChapters: chapters, status: nextStatus, updatedAt: FieldValue.serverTimestamp() });
  return getImport(id);
};

export const cancelImport = async (id: string) => {
  const snapshot = await requireImport(id);
  const status = (snapshot.data() || {}).status as ImportStatus;
  assertImportTransition(status, 'CANCELED');
  await snapshot.ref.update({ status: 'CANCELED', updatedAt: FieldValue.serverTimestamp() });
  return getImport(id);
};

export const publishImport = async (id: string) => adminDb.runTransaction(async transaction => {
  const snapshot = await transaction.get(importRef(id));
  if (!snapshot.exists) throw new HttpsError('not-found', 'Import not found.');
  const data = snapshot.data() || {};
  if (data.status === 'PUBLISHED' && typeof data.publishedBookId === 'string') return { bookId: data.publishedBookId, alreadyPublished: true };
  if (data.status !== 'READY_TO_PUBLISH') throw new HttpsError('failed-precondition', 'Import is not ready to publish.');
  assertImportTransition('READY_TO_PUBLISH', 'PUBLISHING');
  const metadata = validatePublishMetadata(data);
  const chapters = validateImportChapters(data.detectedChapters, false);
  if (chapters.some(chapter => !chapter.content.trim())) throw new HttpsError('failed-precondition', 'Every chapter needs content before publishing.');
  const bookRef = adminDb.collection('books').doc();
  const totalWords = chapters.reduce((total, chapter) => total + wordCount(chapter.content), 0);
  transaction.create(bookRef, {
    id: bookRef.id,
    ...metadata,
    totalWords,
    chapterCount: chapters.length,
    archived: false,
    chapterMigrationState: 'MIGRATED',
    source: { type: 'MANUAL_TEXT', importId: id },
    languageProcessingStatus: 'NOT_STARTED',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  for (const chapter of chapters) {
    transaction.create(bookRef.collection('chapters').doc(chapter.tempId), {
      id: chapter.tempId,
      title: chapter.title,
      content: chapter.content,
      order: chapter.order,
      wordCount: wordCount(chapter.content),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  assertImportTransition('PUBLISHING', 'PUBLISHED');
  transaction.update(snapshot.ref, {
    status: 'PUBLISHED',
    publishedBookId: bookRef.id,
    processingCompletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { bookId: bookRef.id, alreadyPublished: false };
});
