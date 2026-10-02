import { httpsCallable } from 'firebase/functions';
import { BookImportJob, BookImportSourceFile, BookImportSourceType, DetectedChapter } from '../types';
import { functions, storage } from './firebase';
import { ref, uploadBytesResumable } from 'firebase/storage';

type ImportMetadata = Pick<BookImportJob, 'title' | 'author' | 'level' | 'requiredPlan' | 'coverUrl' | 'originalFileName'>;

const callable = <TRequest, TResponse>(name: string, data: TRequest) => {
  if (!functions) throw new Error('functions/not-configured');
  return httpsCallable<TRequest, TResponse>(functions, name)(data).then(result => result.data);
};

export const contentImportApi = {
  createImport: (sourceType: BookImportSourceType, metadata: ImportMetadata) => callable('createBookImport', { sourceType, ...metadata }) as Promise<{ import: BookImportJob }>,
  listImports: () => callable<Record<string, never>, { imports: BookImportJob[] }>('listBookImports', {}),
  getImport: (id: string) => callable<{ id: string }, { import: BookImportJob }>('getBookImport', { id }),
  updateMetadata: (id: string, metadata: ImportMetadata) => callable('updateBookImportMetadata', { id, metadata }) as Promise<{ import: BookImportJob }>,
  setText: (id: string, rawText: string) => callable('setBookImportText', { id, rawText }) as Promise<{ import: BookImportJob }>,
  registerSourceFiles: (id: string, files: BookImportSourceFile[]) => callable('registerBookImportSourceFiles', { id, files }) as Promise<{ import: BookImportJob }>,
  startOcr: (id: string) => callable<{ id: string }, { import: BookImportJob }>('startBookImportOcr', { id }),
  updateChapters: (id: string, chapters: DetectedChapter[]) => callable('updateBookImportChapters', { id, chapters }) as Promise<{ import: BookImportJob }>,
  cancelImport: (id: string) => callable('cancelBookImport', { id }) as Promise<{ import: BookImportJob }>,
  publishImport: (id: string) => callable<{ id: string }, { bookId: string; alreadyPublished: boolean }>('publishBookImport', { id })
};

export const uploadImportSourceFile = (importId: string, file: File, id: string, order: number, onProgress?: (value: number) => void) => {
  if (!storage) return Promise.reject(new Error('storage/not-configured'));
  const safeName = file.name.replace(/[\\/]/g, '_');
  const storagePath = `book-imports/${importId}/source/${id}-${safeName}`;
  const task = uploadBytesResumable(ref(storage, storagePath), file, { contentType: file.type });
  return new Promise<BookImportSourceFile>((resolve, reject) => task.on('state_changed', snap => onProgress?.(snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0), reject, () => resolve({ id, fileName: safeName, storagePath, contentType: file.type, size: file.size, order })));
};
