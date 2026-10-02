export type ImportStatus =
  | 'DRAFT'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'REVIEW_REQUIRED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELED';

export type ImportSourceType = 'TEXT' | 'IMAGE' | 'PDF';

export type ImportChapter = {
  tempId: string;
  title: string;
  order: number;
  content: string;
  sourceStart?: number;
  sourceEnd?: number;
};

export type ImportSourceFile = {
  id: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  size: number;
  order: number;
  uploadedAt?: unknown;
};

export type OcrStatus = 'NOT_STARTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type ExtractedPage = {
  id: string;
  pageNumber: number;
  text: string;
  confidence?: number;
  detectedLanguage?: string;
  // Empty means this is a continuation chunk rather than a new source page.
  separatorBefore?: string;
};

export const normalizationVersion = 'text-normalization-v1';
export const chapterDetectionVersion = 'chapter-detection-v1';
