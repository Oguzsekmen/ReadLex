
export const translateWithDeepL = async (text: string, context?: string): Promise<string | null> => {
  void text;
  void context;
  // Retained as a provider abstraction. DeepL credentials and CORS proxies are
  // intentionally forbidden in browser code; a future backend adapter owns it.
  return null;
};
