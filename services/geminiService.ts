import { DefinitionResponse } from "../types";
import { getCachedDefinition, saveDefinitionToCache } from "./storage";
import { translateWithGoogle } from "./googleTranslateService";

const posMap: Record<string, string> = {
  'noun': 'İsim',
  'verb': 'Fiil',
  'adjective': 'Sıfat',
  'adverb': 'Zarf',
  'pronoun': 'Zamir',
  'preposition': 'Edat',
  'conjunction': 'Bağlaç',
  'interjection': 'Ünlem',
  'unknown': 'Kelime',
  'word': 'Kelime'
};

export const translatePos = (pos: string | undefined): string => {
  if (!pos) return 'Kelime';
  if (Object.values(posMap).includes(pos)) return pos;
  const p = pos.toLowerCase().trim();
  return posMap[p] || 'Kelime';
};

export const getWordDefinition = async (word: string, contextSentence: string): Promise<DefinitionResponse> => {
  const normalized = word.toLowerCase().trim().replace(/[^\w]/g, '');

  // Cümle çevirisini paralel olarak başlat (Hata alırsa boş string dön)
  const sentenceTranslationPromise = contextSentence 
      ? translateWithGoogle(contextSentence).catch(e => { console.error("Sentence translation error:", e); return ""; }) 
      : Promise.resolve("");

  // 1. Önce Önbelleğe Bak
  const cached = await getCachedDefinition(normalized);
  if (cached) {
    const translatedSentence = await sentenceTranslationPromise;
    if (cached.meanings && cached.meanings[0]) {
        // Cache'den gelse bile o anki bağlam cümlesini ve çevirisini kullan
        cached.meanings[0].example = contextSentence;
        cached.meanings[0].translatedExample = translatedSentence;
    }
    return cached;
  }

  // 2. Google Translate API Çağrısı (Cache miss)
  try {
      const [googleTranslation, translatedSentence] = await Promise.all([
          translateWithGoogle(word),
          sentenceTranslationPromise
      ]);
      
      const result: DefinitionResponse = {
          word: word,
          meanings: [{
              partOfSpeech: 'Kelime',
              translation: googleTranslation,
              definition: 'Çeviri',
              example: contextSentence,
              translatedExample: translatedSentence
          }]
      };
      
      await saveDefinitionToCache(normalized, result);
      return result;

  } catch (error: any) {
      console.error("Translation Service Error:", error);

      // Hata durumunda fallback
      return {
        word: word,
        meanings: [{ 
          partOfSpeech: "Kelime", 
          translation: "...", 
          definition: "Çeviri hizmeti güvenli sunucu yapılandırması bekliyor.",
          example: contextSentence 
        }]
      };
  }
};

export const prefetchBookContent = async (text: string): Promise<void> => {
    // AI analizi devre dışı
};
