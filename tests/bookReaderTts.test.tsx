// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tts = vi.hoisted(() => ({
  activeSentenceId: undefined as string | undefined,
  activeTokenIndex: undefined as number | undefined,
  followEnabled: true,
  pause: vi.fn(),
  paused: false,
  previousSentence: vi.fn(),
  nextSentence: vi.fn(),
  repeatCurrentSentence: vi.fn(),
  moveByWords: vi.fn(),
  resume: vi.fn(),
  setFollowEnabled: vi.fn(),
  setRate: vi.fn(),
  speaking: false,
  startFromToken: vi.fn(),
  stop: vi.fn(),
  synchronizationSupported: true,
  useReaderTts: vi.fn(),
}));
const browserSpeech = vi.hoisted(() => ({ speak: vi.fn(), cancel: vi.fn() }));

vi.mock('../hooks/useReaderTts', () => ({ useReaderTts: tts.useReaderTts }));
vi.mock('../services/readerLanguageData', () => ({
  legacyReaderTokens: (content: string) => [...content.matchAll(/[A-Za-z]+/g)].map((match, index) => ({ index, text: match[0], normalized: match[0].toLowerCase(), start: match.index || 0, end: (match.index || 0) + match[0].length, sentenceId: 'legacy-sentence-0', isWord: true })),
  LatestTapGuard: class {
    private request = 0;
    next() { return ++this.request; }
    isLatest(request: number) { return request === this.request; }
  },
  readerLanguageData: {
    loadChapter: vi.fn(async () => ({
      mode: 'prepared',
      metadata: { chapterContentHash: 'h', processingVersion: '1', sourceLanguage: 'en', targetLanguage: 'tr', tokenChunkSize: 50 },
      tokens: [
        { index: 0, text: 'Door', normalized: 'door', start: 0, end: 4, sentenceId: 's1', isWord: true },
        { index: 1, text: ' ', normalized: null, start: 4, end: 5, sentenceId: 's1', isWord: false },
        { index: 2, text: 'door', normalized: 'door', start: 5, end: 9, sentenceId: 's1', isWord: true },
        { index: 3, text: ' ', normalized: null, start: 9, end: 10, sentenceId: 's1', isWord: false },
        { index: 4, text: 'third', normalized: 'third', start: 10, end: 15, sentenceId: 's1', isWord: true },
        { index: 5, text: ' ', normalized: null, start: 15, end: 16, sentenceId: 's1', isWord: false },
        { index: 6, text: 'fourth', normalized: 'fourth', start: 16, end: 22, sentenceId: 's1', isWord: true },
        { index: 7, text: ' ', normalized: null, start: 22, end: 23, sentenceId: 's1', isWord: false },
        { index: 8, text: 'fifth', normalized: 'fifth', start: 23, end: 28, sentenceId: 's1', isWord: true },
        { index: 9, text: ' ', normalized: null, start: 28, end: 29, sentenceId: 's1', isWord: false },
        { index: 10, text: 'sixth', normalized: 'sixth', start: 29, end: 34, sentenceId: 's1', isWord: true },
      ],
      dictionaries: new Map(),
      dictionaryPrefetch: Promise.resolve(),
    })),
    resolve: vi.fn(async () => ({ state: 'missing' })),
  },
}));

import BookReaderV2 from '../components/BookReaderV2';

const book: any = {
  id: 'b', title: 'B', author: 'A', level: 'A1', coverUrl: '', excerpt: '', totalWords: 6,
  requiredPlan: [], archived: false, languageProcessingStatus: 'COMPLETED',
  chapters: [{ id: 'c1', title: 'C1', content: 'Door door third fourth fifth sixth' }, { id: 'c2', title: 'C2', content: 'Next' }],
};

const renderReader = () => render(<BookReaderV2 book={book} initialChapterIndex={0} onBack={vi.fn()} onSaveWord={vi.fn()} savedWords={[]} onCompleteChapter={vi.fn()} onUpdateProgress={vi.fn()} />);

describe('BookReader TTS integration', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: browserSpeech });
    vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; constructor(public text: string) {} });
    browserSpeech.speak.mockReset(); browserSpeech.cancel.mockReset();
    tts.activeSentenceId = undefined;
    tts.activeTokenIndex = undefined;
    tts.followEnabled = true;
    tts.paused = false;
    tts.speaking = false;
    tts.synchronizationSupported = true;
    [tts.pause, tts.previousSentence, tts.nextSentence, tts.repeatCurrentSentence, tts.moveByWords, tts.resume, tts.setFollowEnabled, tts.setRate, tts.startFromToken, tts.stop, tts.useReaderTts].forEach(mock => mock.mockClear());
    tts.useReaderTts.mockImplementation(() => ({
      supported: true, status: 'IDLE', paused: tts.paused, rate: 1, voice: undefined, voices: [], setVoice: vi.fn(),
      followEnabled: tts.followEnabled, setFollowEnabled: tts.setFollowEnabled, start: vi.fn(), startFromToken: tts.startFromToken,
      resume: tts.resume, setRate: tts.setRate, repeatCurrentSentence: tts.repeatCurrentSentence,
      previousSentence: tts.previousSentence, nextSentence: tts.nextSentence, speaking: tts.speaking,
      moveByWords: tts.moveByWords,
      synchronizationSupported: tts.synchronizationSupported, activeTokenIndex: tts.activeTokenIndex,
      activeSentenceId: tts.activeSentenceId, pause: tts.pause, stop: tts.stop,
    }));
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }); });

  it('opens the player without speech, then starts from the current canonical position only on player Play', async () => {
    renderReader();
    expect(await screen.findByRole('button', { name: 'Door çevirisini göster' })).toBeTruthy();
    expect(tts.startFromToken).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Sesli okuma oynatıcısı')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sesli okumayı başlat' }));
    expect(screen.getByLabelText('Sesli okuma oynatıcısı')).toBeTruthy();
    expect(tts.startFromToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sesli okumayı başlat' })[1]);
    expect(tts.startFromToken).toHaveBeenCalledWith(0);
  });

  it('keeps manual selection separate from the exact active repeated token and stops narration before translation', async () => {
    tts.speaking = true;
    tts.activeTokenIndex = 2;
    tts.activeSentenceId = 's1';
    renderReader();
    await screen.findByRole('button', { name: 'Door çevirisini göster' });
    const second = screen.getByRole('button', { name: 'door çevirisini göster' });
    await waitFor(() => expect(second.getAttribute('data-tts-active')).toBe('true'));
    expect(second.className).toContain('bg-brand-500/25');
    const first = screen.getByRole('button', { name: 'Door çevirisini göster' });
    expect(first.getAttribute('data-tts-active')).toBeNull();
    expect(first.getAttribute('data-tts-sentence')).toBe('true');
    expect(first.className).toContain('bg-brand-500/[0.07]');
    fireEvent.click(first);
    await waitFor(() => expect(tts.stop).toHaveBeenCalledOnce());
    expect(first.className).toContain('bg-brand-700');
    expect(second.getAttribute('data-tts-active')).toBe('true');
    expect(screen.getByText('Hazırlanmış çeviri verisi kullanılamıyor.')).toBeTruthy();
  });

  it('keeps popup word pronunciation independent after opening Read Along without playing', async () => {
    renderReader();
    await screen.findByRole('button', { name: 'Door çevirisini göster' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Door çevirisini göster' }).parentElement?.getAttribute('data-token-end')).toBe('10'));
    const first = screen.getByRole('button', { name: 'Door çevirisini göster' });
    fireEvent.click(screen.getByRole('button', { name: 'Sesli okumayı başlat' }));
    expect(tts.startFromToken).not.toHaveBeenCalled();
    fireEvent.click(first);
    const speaker = await screen.findByRole('button', { name: 'Kelimeyi telaffuz et' });
    fireEvent.click(speaker);
    expect(browserSpeech.speak).toHaveBeenCalledOnce();
    expect(browserSpeech.cancel).not.toHaveBeenCalled();
  });

  it('renders a fixed player constrained to the reader card and closes it without leaving the Reader', async () => {
    const onBack = vi.fn();
    render(<BookReaderV2 book={book} initialChapterIndex={0} onBack={onBack} onSaveWord={vi.fn()} savedWords={[]} onCompleteChapter={vi.fn()} onUpdateProgress={vi.fn()} />);
    await screen.findByRole('button', { name: 'Door çevirisini göster' });
    fireEvent.click(screen.getByRole('button', { name: 'Sesli okumayı başlat' }));
    const player = screen.getByLabelText('Sesli okuma oynatıcısı');
    expect(player.closest('[data-reader-chapter-card="true"]')).toBeTruthy();
    expect(player.className).toContain('fixed');
    fireEvent.click(screen.getByLabelText('Sesli okumayı kapat'));
    expect(tts.stop).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Sesli okuma oynatıcısı')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('can reopen Read Along and start again from the persisted Reader token', async () => {
    renderReader();
    await screen.findByRole('button', { name: 'Door çevirisini göster' });
    fireEvent.click(screen.getByRole('button', { name: 'Sesli okumayı başlat' }));
    fireEvent.click(screen.getByLabelText('Sesli okumayı kapat'));
    fireEvent.click(screen.getByRole('button', { name: 'Sesli okumayı başlat' }));
    fireEvent.click(screen.getAllByLabelText('Sesli okumayı başlat')[1]);
    expect(tts.startFromToken).toHaveBeenCalledWith(0);
  });

  it('routes player word navigation, rate, and return-to-follow actions without fabricating a time line', async () => {
    tts.speaking = true;
    tts.followEnabled = false;
    tts.activeTokenIndex = 2;
    tts.activeSentenceId = 's1';
    renderReader();
    await screen.findByLabelText('Sesli okuma oynatıcısı');
    fireEvent.click(screen.getByLabelText('3 kelime geri git'));
    fireEvent.click(screen.getByLabelText('3 kelime ileri git'));
    fireEvent.change(screen.getByLabelText('Okuma hızını değiştir'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByLabelText('Takibe dön'));
    expect(tts.moveByWords).toHaveBeenNthCalledWith(1, -3);
    expect(tts.moveByWords).toHaveBeenNthCalledWith(2, 3);
    expect(tts.setRate).toHaveBeenCalledWith(1.5);
    expect(tts.setFollowEnabled).toHaveBeenCalledWith(true);
    expect(screen.queryByText(/\d{2}:\d{2}/)).toBeNull();
  });

  it('stops narration during chapter navigation and does not show active styling without synchronization', async () => {
    tts.speaking = true;
    tts.synchronizationSupported = false;
    tts.activeTokenIndex = 2;
    tts.activeSentenceId = 's1';
    renderReader();
    const activeCandidate = await screen.findByRole('button', { name: 'door çevirisini göster' });
    expect(activeCandidate.getAttribute('data-tts-active')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Sonraki Bölüm/i }));
    expect(tts.stop).toHaveBeenCalledOnce();
  });

  it('supplies legacy chapter source and fallback tokens to TTS without requiring translations', async () => {
    const legacyBook = { ...book, languageProcessingStatus: 'NOT_STARTED', chapters: [{ id: 'legacy', title: 'Legacy', content: 'Legacy English chapter.' }] };
    render(<BookReaderV2 book={legacyBook} initialChapterIndex={0} onBack={vi.fn()} onSaveWord={vi.fn()} savedWords={[]} onCompleteChapter={vi.fn()} onUpdateProgress={vi.fn()} />);
    await screen.findByRole('button', { name: 'Legacy çevirisini göster' });
    await waitFor(() => expect(tts.useReaderTts).toHaveBeenLastCalledWith('Legacy English chapter.', expect.arrayContaining([
      expect.objectContaining({ text: 'Legacy', start: 0, isWord: true }),
    ])));
    fireEvent.click(screen.getByRole('button', { name: 'Sesli okumayı başlat' }));
    expect(tts.startFromToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sesli okumayı başlat' })[1]);
    expect(tts.startFromToken).toHaveBeenCalledWith(0);
  });
});
