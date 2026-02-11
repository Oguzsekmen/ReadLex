
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyDdOjjPxCr9QDUaBrd7ls3XGS1D1Xh9G74';
const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

export const translateWithGoogle = async (text: string): Promise<string | null> => {
  if (!text) return null;

  try {
    const response = await fetch(`${GOOGLE_TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target: 'tr',
        source: 'en',
        format: 'text'
      })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.warn('Google Translate API Error:', errorData);
        return null;
    }

    const data = await response.json();
    if (data.data && data.data.translations && data.data.translations.length > 0) {
        return data.data.translations[0].translatedText;
    }
    return null;

  } catch (error) {
    console.warn("Google Translate Service unavailable:", error);
    return null;
  }
};
