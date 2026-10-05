import { describe, expect, it } from 'vitest';
import { buildSpeechChunksFromToken, buildSpeechSegmentFromToken, findNextSentenceStartToken, findPreviousSentenceStartToken, findSentenceStartToken, getSentenceForToken, resolveSegmentCharIndex, resolveTokenFromCharIndex, WEB_SPEECH_HARD_MAX_CHUNK_LENGTH } from '../services/tts/tokenSync';
import { PreparedReaderToken } from '../services/readerLanguageData';

const tokens = (text: string): PreparedReaderToken[] => [...text.matchAll(/[\p{L}’']+/gu)].map((match, index) => ({ index, text: match[0], normalized: match[0].toLowerCase(), start: match.index!, end: match.index! + match[0].length, sentenceId: index < 3 ? 's1' : index < 6 ? 's2' : 's3', isWord: true }));

describe('token sync', () => {
  it('uses offsets for repeated words, starts, and inside-word boundaries', () => { const text = 'door opened the door'; const values = tokens(text); expect(resolveTokenFromCharIndex(values, 0)?.index).toBe(0); expect(resolveTokenFromCharIndex(values, 2)?.index).toBe(0); expect(resolveTokenFromCharIndex(values, text.lastIndexOf('door'))?.index).toBe(3); });
  it('returns null for punctuation, whitespace, and invalid character offsets', () => { const text = 'word, word. word! word?'; const values = tokens(text); expect(resolveTokenFromCharIndex(values, text.indexOf(','))).toBeNull(); expect(resolveTokenFromCharIndex(values, text.indexOf(' '))).toBeNull(); expect(resolveTokenFromCharIndex(values, -1)).toBeNull(); expect(resolveTokenFromCharIndex(values, 999)).toBeNull(); });
  it('preserves UTF-16 offsets across quotes, contractions, unicode punctuation, and paragraphs', () => { const text = '“I’m” — don’t\nwe’ll continue.'; const values = tokens(text); expect(resolveTokenFromCharIndex(values, text.indexOf('I’m'))?.text).toBe('I’m'); expect(resolveTokenFromCharIndex(values, text.indexOf('don’t'))?.text).toBe('don’t'); expect(resolveTokenFromCharIndex(values, text.indexOf('we’ll'))?.text).toBe('we’ll'); expect(resolveTokenFromCharIndex(values, text.indexOf('“'))).toBeNull(); expect(resolveTokenFromCharIndex(values, text.indexOf('\n'))).toBeNull(); });
  it('maps suffix speech offsets to original first, middle, and final canonical tokens', () => { const text = 'The old man opened the door.'; const values = tokens(text); const first = buildSpeechSegmentFromToken(text, values, 0)!; const middle = buildSpeechSegmentFromToken(text, values, 3)!; const final = buildSpeechSegmentFromToken(text, values, 5)!; expect(first.originalStartOffset).toBe(0); expect(middle.speechText).toBe('opened the door.'); expect(resolveSegmentCharIndex(middle, values, 0)?.index).toBe(3); expect(resolveSegmentCharIndex(middle, values, middle.speechText.indexOf('door'))?.index).toBe(5); expect(resolveSegmentCharIndex(final, values, 0)?.index).toBe(5); });
  it('finds canonical sentence starts and safely stops at boundaries', () => { const values = tokens('One two three. Four five six. Seven.'); expect(getSentenceForToken(values, 4)).toBe('s2'); expect(findSentenceStartToken(values, 's2')?.index).toBe(3); expect(findPreviousSentenceStartToken(values, 0)).toBeNull(); expect(findPreviousSentenceStartToken(values, 4)?.index).toBe(0); expect(findNextSentenceStartToken(values, 1)?.index).toBe(3); expect(findNextSentenceStartToken(values, 6)).toBeNull(); });
  it('keeps lookup deterministic for a large sorted token set', () => { const values = Array.from({ length: 4096 }, (_, index) => ({ index, text: 'a', normalized: 'a', start: index * 2, end: index * 2 + 1, sentenceId: `s${index}`, isWord: true })); expect(resolveTokenFromCharIndex(values, 8190)?.index).toBe(4095); });
  it('splits a 26k chapter into bounded source-order chunks without splitting canonical words', () => {
    const text = Array.from({ length: 5201 }, () => 'door').join(' ');
    const values = tokens(text);
    const chunks = buildSpeechChunksFromToken(text, values, 0);
    expect(text.length).toBeGreaterThan(26000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map(chunk => chunk.text).join('')).toBe(text);
    expect(chunks.every(chunk => chunk.text.length <= WEB_SPEECH_HARD_MAX_CHUNK_LENGTH)).toBe(true);
    expect(chunks.every(chunk => chunk.text.endsWith(' ') || chunk.globalEndChar === text.length)).toBe(true);
    expect(chunks[1].firstTokenIndex).toBe(resolveTokenFromCharIndex(values, chunks[1].globalStartChar)?.index);
    expect(chunks[chunks.length - 1]?.lastTokenIndex).toBe(values[values.length - 1]?.index);
  });
});
