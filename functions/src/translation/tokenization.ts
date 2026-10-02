import { normalizeDictionaryWord } from './normalization';
import { PreparedToken } from './types';
const wordPattern = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*(?:-[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*)*/gu;
/** Emits every occurrence with exact offsets; repeated words never share an index. */
export const tokenizeSentence = (text: string, sentenceId: string, startIndex: number, chapterOffset: number): PreparedToken[] => {
  const tokens: PreparedToken[] = []; let cursor = 0; let index = startIndex;
  for (const match of text.matchAll(wordPattern)) { const at = match.index || 0; for (let gap = cursor; gap < at; gap++) tokens.push({ index: index++, text: text[gap], normalized: null, start: chapterOffset + gap, end: chapterOffset + gap + 1, sentenceId, isWord: false }); const word = match[0]; tokens.push({ index: index++, text: word, normalized: normalizeDictionaryWord(word), start: chapterOffset + at, end: chapterOffset + at + word.length, sentenceId, isWord: true }); cursor = at + word.length; }
  for (let gap = cursor; gap < text.length; gap++) tokens.push({ index: index++, text: text[gap], normalized: null, start: chapterOffset + gap, end: chapterOffset + gap + 1, sentenceId, isWord: false }); return tokens;
};
