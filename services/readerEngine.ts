import { PreparedReaderToken } from './readerLanguageData';

export const PROGRESS_WRITE_DEBOUNCE_MS = 5_000;
export const PROGRESS_PERCENT_DELTA = 2;
export const PROGRESS_TOKEN_DELTA = 20;
export const INITIAL_RENDER_BLOCKS = 40;
export const RENDER_BLOCK_INCREMENT = 24;

export type ReaderTokenBlock = { id: string; tokens: PreparedReaderToken[]; startTokenIndex: number; endTokenIndex: number; sentenceId?: string };
export type ReaderProgressUpdate = { chapterId: string; chapterContentHash?: string; tokenIndex: number; scrollPercent: number; activeSentenceId?: string };

/** Groups persisted tokens by paragraph/newline without changing token identity. */
export const groupPreparedTokenBlocks = (tokens: PreparedReaderToken[]): ReaderTokenBlock[] => {
  const blocks: ReaderTokenBlock[] = []; let current: PreparedReaderToken[] = [];
  const push = () => { if (!current.length) return; blocks.push({ id: `block-${current[0].index}`, tokens: current, startTokenIndex: current[0].index, endTokenIndex: current[current.length - 1].index, sentenceId: current.find(token => token.isWord)?.sentenceId }); current = []; };
  for (const token of tokens) { current.push(token); if (token.text.includes('\n')) push(); }
  push(); return blocks;
};

export const calculateScrollPercent = (scrollTop: number, scrollHeight: number, clientHeight: number) => {
  const available = Math.max(0, scrollHeight - clientHeight); return available === 0 ? 100 : Math.max(0, Math.min(100, Math.round(scrollTop / available * 100)));
};

export const shouldPersistProgress = (previous: ReaderProgressUpdate | undefined, next: ReaderProgressUpdate) =>
  !previous || previous.chapterId !== next.chapterId || Math.abs(previous.scrollPercent - next.scrollPercent) >= PROGRESS_PERCENT_DELTA || Math.abs(previous.tokenIndex - next.tokenIndex) >= PROGRESS_TOKEN_DELTA;

/** Coalesces noisy scroll updates into one persistence operation. */
export class ProgressWriteScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: ReaderProgressUpdate | undefined;
  schedule(update: ReaderProgressUpdate, persist: (value: ReaderProgressUpdate) => void) { this.pending = update; if (this.timer) return; this.timer = setTimeout(() => this.flush(persist), PROGRESS_WRITE_DEBOUNCE_MS); }
  flush(persist: (value: ReaderProgressUpdate) => void) { if (this.timer) clearTimeout(this.timer); this.timer = undefined; if (this.pending) { const value = this.pending; this.pending = undefined; persist(value); } }
  cancel() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; this.pending = undefined; }
}

export const resumeTarget = (saved: { lastWordIndex?: number; progressPercent?: number; currentChapterId?: string; chapterContentHash?: string } | undefined, chapterId: string, currentHash?: string) => {
  if (!saved || saved.currentChapterId && saved.currentChapterId !== chapterId) return { kind: 'start' as const };
  if (saved.chapterContentHash && currentHash && saved.chapterContentHash === currentHash && typeof saved.lastWordIndex === 'number') return { kind: 'token' as const, tokenIndex: saved.lastWordIndex };
  if (typeof saved.progressPercent === 'number' && saved.progressPercent > 0) return { kind: 'percent' as const, percent: saved.progressPercent };
  return { kind: 'start' as const };
};
