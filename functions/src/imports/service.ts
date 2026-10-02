import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { detectImportChapters } from './chapterDetection';
import { chapterDetectionVersion, ExtractedPage, ImportChapter, ImportSourceFile, ImportStatus, normalizationVersion } from './domain';
import { normalizeImportText } from './normalization';
import { assertImportTransition } from './status';
import { importSourcePath, validateImportChapters, validateImportMetadata, validateImportSourceFiles, validatePublishMetadata, validateRawText, validateSourceType } from './validation';
import { getOcrProvider } from '../ocr/provider';
import { OcrProvider } from '../ocr/types';

const importRef = (id: string) => adminDb.collection('bookImports').doc(id);
const editableStatuses: ImportStatus[] = ['DRAFT', 'UPLOADED', 'REVIEW_REQUIRED', 'READY_TO_PUBLISH'];
const wordCount = (content: string) => content.trim().split(/\s+/).filter(Boolean).length;
const defined = <T extends Record<string, unknown>>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const requireImport = async (id: string) => {
  const snapshot = await importRef(id).get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Import not found.');
  return snapshot;
};

const pagesRef = (id: string) => importRef(id).collection('pages');
const chaptersRef = (id: string) => importRef(id).collection('draftChapters');
const readChapters = async (id: string): Promise<ImportChapter[]> => (await chaptersRef(id).orderBy('order').get()).docs.map(doc => doc.data() as ImportChapter);
const replaceChapters = async (id: string, chapters: ImportChapter[]) => {
  const existing = await chaptersRef(id).get();
  const batch = adminDb.batch();
  existing.docs.forEach(doc => batch.delete(doc.ref));
  chapters.forEach(chapter => batch.set(chaptersRef(id).doc(chapter.tempId), chapter));
  await batch.commit();
};
const savePages = async (id: string, pages: ExtractedPage[]) => {
  const existing = await pagesRef(id).get(); const batch = adminDb.batch();
  existing.docs.forEach(doc => batch.delete(doc.ref));
  pages.forEach(page => batch.set(pagesRef(id).doc(page.id), page));
  await batch.commit();
};
const asText = (pages: ExtractedPage[]) => pages.slice().sort((a, b) => a.pageNumber - b.pageNumber).map((page, index) => `${index ? page.separatorBefore ?? '\n\n' : ''}${page.text}`).join('');
// Keep every Firestore page document comfortably below the 1 MiB document cap.
// A pasted TEXT source can be much larger than one scanned page.
const splitForStorage = (pages: ExtractedPage[]): ExtractedPage[] => {
  const maxChars = 350_000; const output: ExtractedPage[] = [];
  for (const page of pages) {
    let rest = page.text; let part = 0;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf('\n', maxChars); if (cut < maxChars / 2) cut = maxChars;
      output.push({ ...page, id: `${page.id}-part-${part++}`, pageNumber: output.length + 1, text: rest.slice(0, cut), separatorBefore: output.length ? page.separatorBefore ?? '\n\n' : '' });
      rest = rest.slice(cut);
    }
    output.push({ ...page, id: part ? `${page.id}-part-${part}` : page.id, pageNumber: output.length + 1, text: rest, separatorBefore: part ? '' : output.length ? page.separatorBefore ?? '\n\n' : '' });
  }
  return output;
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
  const data = snapshot.data() || {};
  const [chapterDocs, pageDocs] = await Promise.all([readChapters(id), pagesRef(id).orderBy('pageNumber').get()]);
  const pages = pageDocs.docs.map(doc => doc.data() as ExtractedPage);
  return { id: snapshot.id, ...data, detectedChapters: chapterDocs.length ? chapterDocs : data.detectedChapters, rawText: pages.length ? asText(pages) : data.rawText, extractedPages: pages.map(({ text, ...page }) => page) };
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
      // Large OCR/text payloads live in page/chapter subcollections instead
      // of the import document, keeping the job document well below 1 MiB.
      normalizedText: normalizedText.slice(0, 1000),
      detectedChapters: FieldValue.delete(),
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
  await savePages(id, splitForStorage([{ id: 'text-0001', pageNumber: 1, text: rawText }]));
  await replaceChapters(id, detection.chapters);
  return getImport(id);
};

export const updateImportChapters = async (id: string, value: unknown) => {
  const snapshot = await requireImport(id);
  const status = (snapshot.data() || {}).status as ImportStatus;
  if (status !== 'REVIEW_REQUIRED' && status !== 'READY_TO_PUBLISH') throw new HttpsError('failed-precondition', 'Import chapters cannot be edited in its current state.');
  const chapters = validateImportChapters(value);
  const nextStatus: ImportStatus = chapters.length && chapters.every(chapter => chapter.content.trim()) ? 'READY_TO_PUBLISH' : 'REVIEW_REQUIRED';
  if (nextStatus !== status) assertImportTransition(status, nextStatus);
  await replaceChapters(id, chapters);
  await snapshot.ref.update({ detectedChapters: FieldValue.delete(), draftChapterCount: chapters.length, status: nextStatus, updatedAt: FieldValue.serverTimestamp() });
  return getImport(id);
};

export const registerImportSourceFiles = async (id: string, value: unknown) => {
  const snapshot = await requireImport(id); const data = snapshot.data() || {}; const status = data.status as ImportStatus;
  if (status !== 'DRAFT' && status !== 'UPLOADED') throw new HttpsError('failed-precondition', 'Source files cannot be changed in the current state.');
  const files = validateImportSourceFiles(id, data.sourceType, value);
  for (const file of files) {
    const expected = importSourcePath(id, file.id, file.fileName);
    const [metadata] = await adminStorage.bucket().file(expected).getMetadata().catch(() => { throw new HttpsError('not-found', 'Uploaded source file was not found.'); });
    if (metadata.contentType !== file.contentType || Number(metadata.size) !== file.size) throw new HttpsError('invalid-argument', 'Uploaded source file metadata does not match.');
  }
  await snapshot.ref.update({ sourceFiles: files, originalFileName: files[0].fileName, status: 'UPLOADED', ocrStatus: 'NOT_STARTED', pagesTotal: files.length, pagesProcessed: 0, progressPercent: 0, updatedAt: FieldValue.serverTimestamp() });
  return getImport(id);
};

export const processOcrImport = async (id: string, provider: OcrProvider = getOcrProvider()) => {
  const snapshot = await requireImport(id); const data = snapshot.data() || {}; const status = data.status as ImportStatus;
  if (data.sourceType !== 'IMAGE' && data.sourceType !== 'PDF') throw new HttpsError('failed-precondition', 'OCR is only available for IMAGE and PDF imports.');
  if (data.ocrStatus === 'COMPLETED' && ['REVIEW_REQUIRED', 'READY_TO_PUBLISH'].includes(status)) return getImport(id);
  if (status !== 'UPLOADED' && status !== 'FAILED') throw new HttpsError('failed-precondition', 'OCR processing is already running or unavailable.');
  const files = data.sourceFiles as ImportSourceFile[] | undefined;
  if (!files?.length) throw new HttpsError('failed-precondition', 'Upload at least one source file first.');
  assertImportTransition(status, 'PROCESSING');
  await snapshot.ref.update({ status: 'PROCESSING', ocrStatus: 'PROCESSING', ocrProvider: 'google-vision', ocrVersion: 'google-vision-document-text-v1', ocrStartedAt: FieldValue.serverTimestamp(), processingStartedAt: FieldValue.serverTimestamp(), pagesProcessed: 0, progressPercent: 0, updatedAt: FieldValue.serverTimestamp() });
  try {
    const pages: ExtractedPage[] = [];
    for (const file of files.slice().sort((a, b) => a.order - b.order)) {
      const result = data.sourceType === 'IMAGE' ? [await provider.extractImage({ importId: id, sourceFile: file })] : await provider.extractPdf({ importId: id, sourceFile: file });
      pages.push(...result);
      await snapshot.ref.update({ pagesProcessed: pages.length, progressPercent: Math.min(99, Math.floor((pages.length / (data.sourceType === 'IMAGE' ? files.length : Math.max(pages.length, 1))) * 100)), updatedAt: FieldValue.serverTimestamp() });
    }
    const rawText = asText(pages); if (!rawText.trim()) throw new Error('EMPTY_OCR_RESULT');
    const normalized = normalizeImportText(rawText); const detection = detectImportChapters(normalized);
    await savePages(id, splitForStorage(pages)); await replaceChapters(id, detection.chapters);
    const next: ImportStatus = detection.reviewRequired ? 'REVIEW_REQUIRED' : 'READY_TO_PUBLISH'; assertImportTransition('PROCESSING', next);
    await snapshot.ref.update({ status: next, ocrStatus: 'COMPLETED', pagesTotal: pages.length, pagesProcessed: pages.length, progressPercent: 100, draftChapterCount: detection.chapters.length, normalizedText: normalized.slice(0, 1000), ocrCompletedAt: FieldValue.serverTimestamp(), processingCompletedAt: FieldValue.serverTimestamp(), errorCode: FieldValue.delete(), errorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    await snapshot.ref.update({ status: 'FAILED', ocrStatus: 'FAILED', errorCode: error instanceof Error && error.message === 'EMPTY_OCR_RESULT' ? 'EMPTY_OCR_RESULT' : 'OCR_PROCESSING_FAILED', errorMessage: 'OCR processing could not complete. Check the source file and retry.', updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError('internal', 'OCR processing could not complete.');
  }
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
  const chaptersSnapshot = await transaction.get(chaptersRef(id).orderBy('order'));
  const chapters = validateImportChapters(chaptersSnapshot.docs.map(doc => doc.data()), false);
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
    source: { type: data.sourceType === 'PDF' ? 'OCR_PDF' : data.sourceType === 'IMAGE' ? 'OCR_IMAGE' : 'MANUAL_TEXT', importId: id },
    languageProcessingStatus: 'NOT_STARTED',
    sourceLanguage: 'en',
    targetLanguage: 'tr',
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
