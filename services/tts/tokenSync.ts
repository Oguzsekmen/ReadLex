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
