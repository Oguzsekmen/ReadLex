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

export const normalizationVersion = 'text-normalization-v1';
export const chapterDetectionVersion = 'chapter-detection-v1';
