import { GoogleGenAI } from "@google/genai";
import { DefinitionResponse } from "../types";
import { getCachedDefinition, saveDefinitionToCache } from "./storage";
import { translateWithGoogle } from "./googleTranslateService";

const posMap: Record<string, string> = {
  'noun': 'İsim',
  'verb': 'Fiil',
  'adjective': 'Sıfat',
  'adj': 'Sıfat',
  'adverb': 'Zarf',
  'adv': 'Zarf',
  'pronoun': 'Zamir',
  'preposition': 'Edat',
  'conjunction': 'Bağlaç',
  'interjection': 'Ünlem',
  'phrasal verb': 'Deyimsel Fiil',
  'gerund': 'İsim-Fiil',
  'participle': 'Ortaç',
  'determiner': 'Belirleyici',
  'article': 'Tanımlık',
  'number': 'Sayı',
  'unknown': 'Kelime',
  'word': 'Kelime'
};

export const translatePos = (pos: string | undefined): string => {
  if (!pos) return 'Kelime';
  
  // Zaten çevrilmiş Türkçe değerler (örn: "Sıfat") geldiğinde bozmamak için kontrol
  if (Object.values(posMap).includes(pos)) return pos;

  // İngilizce map kontrolü için normalizasyon
  const p = pos.toLowerCase().trim().replace(/[^a-z ]/g, '');
  if (posMap[p]) return posMap[p];
  
  for (const key in posMap) {
    if (p.includes(key)) return posMap[key];
  }

  // Eşleşme yoksa orijinal metni döndür (Türkçe karakterleri koruyarak)
  return pos.charAt(0).toUpperCase() + pos.slice(1).replace(/[^a-zA-ZıİğĞüÜşŞöÖçÇ0-9 ]/g, '');
};

/**
 * Kelime çevirisini kalıcı önbellekten, Google Translate'den veya Gemini'den getirir.
 * Sıralama: Cache -> Google Translate -> Gemini
 */
export const getWordDefinition = async (word: string, contextSentence: string): Promise<DefinitionResponse> => {
  const normalized = word.toLowerCase().trim().replace(/[^\w]/g, '');

  // 1. ADIM: Kalıcı Önbelleği Kontrol Et (Maksimum Hız)
  const cached = await getCachedDefinition(normalized);
  if (cached) {
    if (cached.meanings && cached.meanings[0]) {
        cached.meanings[0].example = contextSentence;
    }
    return cached;
  }

  // 2. ADIM: Google Translate ile Hızlı Çeviri (Yüksek Kalite & Hız)
  try {
      const googleResult = await translateWithGoogle(word);
      if (googleResult) {
          const result: DefinitionResponse = {
              word: word,
              meanings: [{
                  partOfSpeech: 'Kelime', // Google Basic API gramer bilgisi sağlamaz
                  translation: googleResult,
                  definition: 'Çeviri Google Translate ile yapıldı.', // İngilizce tanım sağlanmaz
                  example: contextSentence
              }]
          };
          
          // Sonucu önbelleğe kaydet
          await saveDefinitionToCache(normalized, result);
          return result;
      }
  } catch (googleError) {
      console.warn("Google Translate işleminde sorun oluştu, Gemini deneniyor...", googleError);
  }

  // 3. ADIM: Google Translate çalışmazsa Gemini'yi kullan (Fallback)
  if (!process.env.API_KEY) {
     return {
        word: word,
        meanings: [{ 
          partOfSpeech: "Hata", 
          translation: word, 
          definition: "API anahtarı eksik.", 
          example: contextSentence 
        }]
     };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: "${contextSentence}"
Word: "${word}"
Analyze grammatical role in context. 

Return JSON:
{
  "tr": "Turkish translation",
  "en": "Short definition",
  "pos": "noun/verb/etc."
}`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("API hatası");
    
    const data = JSON.parse(textOutput);
    
    const result: DefinitionResponse = {
      word: word,
      meanings: [{
        partOfSpeech: translatePos(data.pos),
        translation: data.tr || word,
        definition: data.en || "Tanım bulunamadı.",
        example: contextSentence
      }]
    };
    
    await saveDefinitionToCache(normalized, result);
    return result;

  } catch (err: any) {
    const isQuotaError = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
    return {
      word: word,
      meanings: [{ 
        partOfSpeech: "Sistem", 
        translation: word, 
        definition: isQuotaError ? "Günlük limit doldu." : "Hata oluştu.", 
        example: contextSentence 
      }]
    };
  }
};

export const prefetchBookContent = async (text: string): Promise<void> => {
    // Gelecekte toplu analiz için kullanılabilir
};