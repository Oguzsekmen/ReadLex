
const DEEPL_API_KEY = '0f41027e-c3e5-4402-9b2e-7128debdd878:fx';
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

export const translateWithDeepL = async (text: string, context?: string): Promise<string | null> => {
  if (!text) return null;

  try {
    const params = new URLSearchParams();
    params.append('auth_key', DEEPL_API_KEY);
    params.append('text', text);
    params.append('target_lang', 'TR');
    params.append('source_lang', 'EN');
    
    // Tarayıcı ortamları (Browser) DeepL API'sine doğrudan erişimi CORS nedeniyle engeller.
    // Bu sorunu aşmak için bir CORS proxy kullanıyoruz ve isteği GET olarak gönderiyoruz.
    const urlWithParams = `${DEEPL_API_URL}?${params.toString()}`;
    
    // Not: Prodüksiyon ortamında bu isteklerin backend üzerinden yapılması önerilir.
    // Demo/Geliştirme için corsproxy.io kullanılıyor.
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(urlWithParams);
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
        // Hata durumunda (4xx, 5xx) null dönerek sistemin Gemini'ye geçmesini sağla
        return null;
    }
    
    const data = await response.json();
    return data.translations && data.translations.length > 0 ? data.translations[0].text : null;
  } catch (error) {
    // Ağ veya CORS hatası durumunda konsola bilgi ver ve Gemini fallback'ini tetikle
    console.warn("DeepL unavailable (CORS/Network), switching to Gemini.");
    return null;
  }
};
