import { describe, expect, it, vi } from 'vitest';
import { calculateScrollPercent, groupPreparedTokenBlocks, ProgressWriteScheduler, resumeTarget, shouldPersistProgress } from '../services/readerEngine';
import { PreparedReaderToken } from '../services/readerLanguageData';

const token = (index: number, text: string, sentenceId = 's1'): PreparedReaderToken => ({ index, text, normalized: /[a-z]/i.test(text) ? text.toLowerCase() : null, start: index, end: index + text.length, sentenceId, isWord: /[a-z]/i.test(text) });

describe('reader engine v2', () => {
  it('keeps prepared token order, punctuation, and paragraph boundaries intact', () => {
    const blocks = groupPreparedTokenBlocks([token(0, 'The'), token(1, ' '), token(2, 'door'), token(3, '.'), token(4, '\n'), token(5, 'He', 's2'), token(6, ' '), token(7, 'closed', 's2'), token(8, '.')]);
    expect(blocks.map(block => block.tokens.map(item => item.text).join(''))).toEqual(['The door.\n', 'He closed.']);
    expect(blocks[1].sentenceId).toBe('s2');
  });

  it('handles a generated 10,000-word chapter linearly and retains stable token bounds', () => {
    const synthetic = Array.from({ length: 10_000 }, (_, index) => token(index * 2, index % 100 === 99 ? `word${String.fromCharCode(97 + index % 26)}\n` : `word${String.fromCharCode(97 + index % 26)}`));
    const blocks = groupPreparedTokenBlocks(synthetic);
    expect(blocks).toHaveLength(100); expect(blocks[0].startTokenIndex).toBe(0); expect(blocks.at(-1)?.endTokenIndex).toBe(19_998);
  });

  it('calculates scroll and resume targets with content-version safety', () => {
    expect(calculateScrollPercent(250, 1_000, 500)).toBe(50);
    expect(resumeTarget({ currentChapterId: 'c1', chapterContentHash: 'hash', lastWordIndex: 42, progressPercent: 70 }, 'c1', 'hash')).toEqual({ kind: 'token', tokenIndex: 42 });
    expect(resumeTarget({ currentChapterId: 'c1', chapterContentHash: 'old', lastWordIndex: 42, progressPercent: 70 }, 'c1', 'new')).toEqual({ kind: 'percent', percent: 70 });
    expect(shouldPersistProgress({ chapterId: 'c1', tokenIndex: 1, scrollPercent: 10 }, { chapterId: 'c1', tokenIndex: 2, scrollPercent: 11 })).toBe(false);
  });

  it('debounces many scroll updates into one persistence write', () => {
    vi.useFakeTimers(); const scheduler = new ProgressWriteScheduler(); const persist = vi.fn();
    scheduler.schedule({ chapterId: 'c1', tokenIndex: 10, scrollPercent: 10 }, persist); scheduler.schedule({ chapterId: 'c1', tokenIndex: 30, scrollPercent: 15 }, persist);
    vi.advanceTimersByTime(5_000); expect(persist).toHaveBeenCalledTimes(1); expect(persist).toHaveBeenLastCalledWith({ chapterId: 'c1', tokenIndex: 30, scrollPercent: 15 }); vi.useRealTimers();
  });
});
