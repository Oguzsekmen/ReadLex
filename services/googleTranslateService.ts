
export const translateWithGoogle = async (text: string): Promise<string> => {
  if (!text) throw new Error("Çevrilecek metin boş olamaz.");
  // Provider calls must run on a backend where credentials can be protected.
  // Phase 3 will replace this boundary with an authenticated translation API.
  throw new Error('Translation is temporarily unavailable because no secure server-side translation provider is configured.');
};
