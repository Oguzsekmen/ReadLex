import { httpsCallable } from 'firebase/functions';
import { BookImportJob, BookImportSourceType, DetectedChapter } from '../types';
import { functions } from './firebase';

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
  updateChapters: (id: string, chapters: DetectedChapter[]) => callable('updateBookImportChapters', { id, chapters }) as Promise<{ import: BookImportJob }>,
  cancelImport: (id: string) => callable('cancelBookImport', { id }) as Promise<{ import: BookImportJob }>,
  publishImport: (id: string) => callable<{ id: string }, { bookId: string; alreadyPublished: boolean }>('publishBookImport', { id })
};
