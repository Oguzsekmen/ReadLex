import { HttpsError } from 'firebase-functions/v2/https';
import { GoogleVisionProvider } from './googleVisionProvider';
import { OcrProvider } from './types';
import { assertExternalProviderExecutionAllowed } from '../hybridSafety';

export const getOcrProvider = (): OcrProvider => {
  assertExternalProviderExecutionAllowed('OCR');
  const configured = process.env.OCR_PROVIDER || 'google-vision';
  if (configured === 'google-vision') return new GoogleVisionProvider();
  throw new HttpsError('failed-precondition', 'OCR provider is not configured.');
};
