import { PreparedReaderToken } from '../readerLanguageData';

const spoken = (tokens: PreparedReaderToken[]) => tokens.filter(token => token.isWord).sort((a, b) => a.start - b.start);

/** Maps Web Speech's UTF-16 character offset to one canonical spoken token. */
export const resolveTokenFromCharIndex = (tokens: PreparedReaderToken[], charIndex: number): PreparedReaderToken | null => {
  if (!Number.isInteger(charIndex) || charIndex < 0) return null;
  const values = spoken(tokens); let low = 0; let high = values.length - 1;
  while (low <= high) { const middle = (low + high) >> 1; const token = values[middle]; if (charIndex < token.start) high = middle - 1; else if (charIndex >= token.end) low = middle + 1; else return token; }
  return null;
};

export const getSentenceForToken = (tokens: PreparedReaderToken[], tokenIndex: number) => tokens.find(token => token.index === tokenIndex)?.sentenceId || null;
export const findSentenceStartToken = (tokens: PreparedReaderToken[], sentenceId: string) => spoken(tokens).find(token => token.sentenceId === sentenceId) || null;
export const findPreviousSentenceStartToken = (tokens: PreparedReaderToken[], tokenIndex: number) => { const current = getSentenceForToken(tokens, tokenIndex); const sentences = spoken(tokens).filter((token, i, all) => !i || all[i - 1].sentenceId !== token.sentenceId); const at = sentences.findIndex(token => token.sentenceId === current); return at > 0 ? sentences[at - 1] : null; };
export const findNextSentenceStartToken = (tokens: PreparedReaderToken[], tokenIndex: number) => { const current = getSentenceForToken(tokens, tokenIndex); const sentences = spoken(tokens).filter((token, i, all) => !i || all[i - 1].sentenceId !== token.sentenceId); const at = sentences.findIndex(token => token.sentenceId === current); return at >= 0 && at + 1 < sentences.length ? sentences[at + 1] : null; };

export type SpeechSegment = { speechText: string; originalStartOffset: number; startTokenIndex: number };
export const buildSpeechSegmentFromToken = (text: string, tokens: PreparedReaderToken[], startTokenIndex: number): SpeechSegment | null => { const token = spoken(tokens).find(value => value.index === startTokenIndex); return token ? { speechText: text.slice(token.start), originalStartOffset: token.start, startTokenIndex } : null; };
export const resolveSegmentCharIndex = (segment: SpeechSegment, tokens: PreparedReaderToken[], charIndex: number) => resolveTokenFromCharIndex(tokens, segment.originalStartOffset + charIndex);

export const WEB_SPEECH_TARGET_CHUNK_LENGTH = 600;
export const WEB_SPEECH_HARD_MAX_CHUNK_LENGTH = 1000;
export type SpeechChunk = { text: string; globalStartChar: number; globalEndChar: number; firstTokenIndex: number; lastTokenIndex: number };

const whitespaceBreakBefore = (text: string, start: number, limit: number) => {
  for (let index = Math.min(limit - 1, text.length - 1); index > start; index -= 1) if (/\s/.test(text[index])) return index + 1;
  return null;
};

/**
 * Builds source-order Web Speech chunks. Sentence starts are preferred; a long
 * sentence falls back only to whitespace so no canonical word is split.
 */
export const buildSpeechChunksFromToken = (text: string, tokens: PreparedReaderToken[], startTokenIndex: number, targetLength = WEB_SPEECH_TARGET_CHUNK_LENGTH, hardMaximum = WEB_SPEECH_HARD_MAX_CHUNK_LENGTH): SpeechChunk[] => {
  const values = spoken(tokens); const startToken = values.find(token => token.index === startTokenIndex);
  if (!startToken || targetLength <= 0 || hardMaximum < targetLength) return [];
  const sentenceStarts = values.filter((token, index) => index > 0 && values[index - 1].sentenceId !== token.sentenceId).map(token => token.start);
  const chunks: SpeechChunk[] = []; let cursor = startToken.start;
  while (cursor < text.length) {
    const targetEnd = Math.min(text.length, cursor + targetLength); const hardEnd = Math.min(text.length, cursor + hardMaximum);
    const boundaryAtOrBeforeTarget = [...sentenceStarts, text.length].filter(value => value > cursor && value <= targetEnd).pop();
    const firstBoundaryAtOrBeforeHard = [...sentenceStarts, text.length].find(value => value > cursor && value <= hardEnd);
    const end = boundaryAtOrBeforeTarget || firstBoundaryAtOrBeforeHard || whitespaceBreakBefore(text, cursor, hardEnd);
    if (!end || end <= cursor) throw new Error('Speech text contains a word that exceeds the Web Speech chunk limit.');
    const chunkTokens = values.filter(token => token.start >= cursor && token.start < end);
    if (!chunkTokens.length) throw new Error('Speech chunk has no canonical spoken token.');
    chunks.push({ text: text.slice(cursor, end), globalStartChar: cursor, globalEndChar: end, firstTokenIndex: chunkTokens[0].index, lastTokenIndex: chunkTokens[chunkTokens.length - 1].index });
    cursor = end;
  }
  return chunks;
};
