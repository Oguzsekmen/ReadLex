export type SegmentedSentence = { text: string; start: number; end: number };
const abbreviations = new Set(['mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'etc.', 'e.g.', 'i.e.', 'vs.']);
const closing = new Set(['"', "'", '”', '’', ')', ']']);
export const segmentEnglishSentences = (source: string): SegmentedSentence[] => {
  const result: SegmentedSentence[] = []; let start = 0; let index = 0;
  const push = (end: number) => { const raw = source.slice(start, end); const leading = raw.search(/\S/); const trimmed = raw.trim(); if (trimmed && leading >= 0) result.push({ text: trimmed, start: start + leading, end: start + leading + trimmed.length }); start = end; };
  while (index < source.length) {
    const current = source[index];
    if (current === '.' || current === '!' || current === '?') {
      let end = index + 1; while (end < source.length && closing.has(source[end])) end++;
      const previous = source.slice(start, end).trim().toLocaleLowerCase('en-US'); const lastWord = previous.match(/[\p{L}.]+$/u)?.[0] || '';
      const isAbbreviation = current === '.' && (abbreviations.has(lastWord) || /(?:[a-z]\.){2,}$/i.test(lastWord));
      if (!isAbbreviation && (end === source.length || /\s/.test(source[end]))) push(end);
      index = end; continue;
    }
    if (current === '\n' && source[index + 1] === '\n') { push(index); while (index < source.length && /\s/.test(source[index])) index++; start = index; continue; }
    index++;
  }
  push(source.length); return result;
};
