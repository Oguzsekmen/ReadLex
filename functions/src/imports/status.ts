import { HttpsError } from 'firebase-functions/v2/https';
import { ImportStatus } from './domain';

const transitions: Record<ImportStatus, ImportStatus[]> = {
  DRAFT: ['PROCESSING', 'CANCELED'],
  UPLOADED: ['PROCESSING', 'CANCELED'],
  PROCESSING: ['REVIEW_REQUIRED', 'READY_TO_PUBLISH', 'FAILED', 'CANCELED'],
  REVIEW_REQUIRED: ['PROCESSING', 'READY_TO_PUBLISH', 'CANCELED'],
  READY_TO_PUBLISH: ['PROCESSING', 'PUBLISHING', 'REVIEW_REQUIRED', 'CANCELED'],
  PUBLISHING: ['PUBLISHED', 'FAILED'],
  PUBLISHED: [],
  FAILED: [],
  CANCELED: []
};

export const assertImportTransition = (from: ImportStatus, to: ImportStatus) => {
  if (!transitions[from].includes(to)) throw new HttpsError('failed-precondition', `Invalid import status transition: ${from} to ${to}.`);
};
