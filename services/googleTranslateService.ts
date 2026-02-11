
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyBEC-8RfB8HRMxAPSAhDQTInJOmjVR-k0I';
const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

export const translateWithGoogle = async (text: string): Promise<string> => {
  if (!text) throw new Error("Çevrilecek metin boş olamaz.");
  const cleanText = text.trim();
  if (!cleanText) throw new Error("Çevrilecek metin boş olamaz.");

  try {
    // API Key trimlenerek boşluk hataları önlenir
    const url = `${GOOGLE_TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY.trim()}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: cleanText,
        target: 'tr',
        format: 'text'
      })
    });

    const data = await response.json();

    if (!response.ok) {
        // API'den dönen spesifik hata mesajını al
        const errorMessage = data.error?.message || response.statusText;
        console.error('❌ Google Translate API Error:', errorMessage);
        throw new Error(errorMessage);
    }

    if (data.data && data.data.translations && data.data.translations.length > 0) {
        return data.data.translations[0].translatedText;
    }
    
    throw new Error('Google Translate boş yanıt döndü.');

  } catch (error: any) {
    // Ağ hatası veya API hatasını yukarı fırlat
    throw new Error(error.message || "Bilinmeyen çeviri hatası");
  }
};