import { v3 } from '@google-cloud/translate';
import { TranslationProvider, LanguagePair } from './types';
/** Google credentials are resolved by ADC in the Functions runtime only. */
export class GoogleTranslationProvider implements TranslationProvider {
  readonly providerName = 'google-cloud-translation'; readonly providerVersion = 'translation-v3'; private readonly client = new v3.TranslationServiceClient();
  async translateTexts(texts: string[], pair: LanguagePair): Promise<string[]> { if (!texts.length) return []; const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT; if (!projectId) throw new Error('PROVIDER_UNAVAILABLE'); const [response] = await this.client.translateText({ parent: `projects/${projectId}/locations/global`, contents: texts, mimeType: 'text/plain', sourceLanguageCode: pair.sourceLanguage, targetLanguageCode: pair.targetLanguage }); const translated = (response.translations || []).map(item => item.translatedText || ''); if (translated.length !== texts.length || translated.some(text => !text)) throw new Error('PROVIDER_INVALID_RESPONSE'); return translated; }
}
