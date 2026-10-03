import { HttpsError } from 'firebase-functions/v2/https';
import { GoogleTranslationProvider } from './googleTranslationProvider';
import { TranslationProvider } from './types';
import { assertExternalProviderExecutionAllowed } from '../hybridSafety';

export const getTranslationProvider = (): TranslationProvider => {
  assertExternalProviderExecutionAllowed('Translation');
  const configured = process.env.TRANSLATION_PROVIDER || 'google-translation';
  if (configured === 'google-translation') return new GoogleTranslationProvider();
  throw new HttpsError('failed-precondition', 'Translation provider is not configured.');
};
