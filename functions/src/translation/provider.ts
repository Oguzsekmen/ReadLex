import { HttpsError } from 'firebase-functions/v2/https';
import { GoogleTranslationProvider } from './googleTranslationProvider';
import { TranslationProvider } from './types';
export const getTranslationProvider = (): TranslationProvider => { const configured = process.env.TRANSLATION_PROVIDER || 'google-translation'; if (configured === 'google-translation') return new GoogleTranslationProvider(); throw new HttpsError('failed-precondition', 'Translation provider is not configured.'); };
