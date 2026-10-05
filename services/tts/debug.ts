/**
 * Development-only Read Along trace. It deliberately logs lifecycle metadata
 * only—never chapter text, tokens, authentication, or user information.
 */
export const readAlongDebug = (
  event: string,
  details?: Record<string, unknown>,
): void => {
  if (import.meta.env.DEV && import.meta.env.VITE_TTS_DEBUG === "true") {
    console.info(`[ReadLex TTS] ${event}`, details || {});
  }
};
