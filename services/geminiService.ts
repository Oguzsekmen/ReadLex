import { GoogleGenAI } from "@google/genai";
import { DefinitionResponse } from "../types";

// NOTE: In a real production app, this key should come from a secure backend proxy
// to avoid exposing it on the client. For this codebase, we use the env variable
// but provide a mock fallback if it is missing.
const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

// In-memory cache for performance (Fast)
const definitionCache = new Map<string, DefinitionResponse>();

// Pre-defined dictionary for the demo texts to ensure 100% reliability and speed for demo content
// This acts as a robust fallback if the API Key is missing or the API fails
const FALLBACK_DICT: Record<string, { translation: string, definition: string, type: string }> = {
  "key": { translation: "anahtar", definition: "A small metal instrument specially cut to fit into a lock.", type: "noun" },
  "pocket": { translation: "cep", definition: "A small bag sewn into or on clothing so as to form part of it.", type: "noun" },
  "table": { translation: "masa", definition: "A piece of furniture with a flat top and one or more legs.", type: "noun" },
  "sun": { translation: "güneş", definition: "The star around which the earth orbits.", type: "noun" },
  "hot": { translation: "sıcak", definition: "Having a high degree of heat or a high temperature.", type: "adjective" },
  "shiny": { translation: "parlak", definition: "Reflecting light, typically because very clean or polished.", type: "adjective" },
  "grass": { translation: "çim", definition: "Vegetation consisting of typically short plants with long narrow leaves.", type: "noun" },
  "happy": { translation: "mutlu", definition: "Feeling or showing pleasure or contentment.", type: "adjective" },
  "evolution": { translation: "evrim", definition: "The gradual development of something, especially from a simple to a more complex form.", type: "noun" },
  "artificial": { translation: "yapay", definition: "Made or produced by human beings rather than occurring naturally.", type: "adjective" },
  "intelligence": { translation: "zeka", definition: "The ability to acquire and apply knowledge and skills.", type: "noun" },
  "sparked": { translation: "tetikledi / başlattı", definition: "Provide the stimulus for a sudden outbreak of something.", type: "verb" },
  "dilemmas": { translation: "ikilemler", definition: "A situation in which a difficult choice has to be made between two or more alternatives.", type: "noun" },
  "quantum": { translation: "kuantum", definition: "A discrete quantity of energy proportional in magnitude to the frequency of the radiation it represents.", type: "noun" },
  "entanglement": { translation: "dolanıklık", definition: "The action of becoming twisted together with or caught in.", type: "noun" },
  "intuition": { translation: "sezgi", definition: "The ability to understand something immediately, without the need for conscious reasoning.", type: "noun" },
  "interconnected": { translation: "birbiriyle bağlantılı", definition: "Having all constituent parts linked or connected.", type: "adjective" },
  "cryptography": { translation: "kriptografi", definition: "The art of writing or solving codes.", type: "noun" }
};

export const getWordDefinition = async (word: string, contextSentence: string): Promise<DefinitionResponse> => {
  const normalizedWord = word.toLowerCase().trim().replace(/[^\w\s]/gi, '');

  // 1. Check Cache (Fastest)
  if (definitionCache.has(normalizedWord)) {
    return definitionCache.get(normalizedWord)!;
  }

  // 2. Try API (Best Quality)
  if (API_KEY) {
    try {
      // Optimized prompt for speed: minimized tokens
      const prompt = `Define "${word}" in context: "${contextSentence}".
Return JSON.
Schema:
{
  "word": "${word}",
  "phonetic": "phonetic",
  "meanings": [{
    "partOfSpeech": "type",
    "translation": "Turkish translation",
    "definition": "Simple English definition",
    "example": "Short example sentence"
  }]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          // Disable thinking budget to minimize latency for simple translation tasks
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      
      const result = JSON.parse(text) as DefinitionResponse;
      
      // Cache the result
      definitionCache.set(normalizedWord, result);
      return result;

    } catch (error) {
      console.warn("Gemini API failed, falling back to local dictionary:", error);
      // Fall through to local dictionary
    }
  } 
  // REMOVED: Artificial delay for non-API users to ensure maximum speed perception
  
  // 3. Local Dictionary / Fallback (Reliable)
  const localDef = FALLBACK_DICT[normalizedWord];
  const fallbackResponse: DefinitionResponse = {
    word: word,
    meanings: [{
      partOfSpeech: localDef?.type || "unknown",
      translation: localDef?.translation || `[TR] ${word}`,
      definition: localDef?.definition || "Definition currently unavailable. Please check your internet connection.",
      example: contextSentence
    }]
  };

  // Cache the fallback too so we don't delay again
  definitionCache.set(normalizedWord, fallbackResponse);
  
  return fallbackResponse;
};