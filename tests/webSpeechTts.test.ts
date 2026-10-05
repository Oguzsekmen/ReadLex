// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeReaderTtsAdapter } from '../services/tts/fakeReaderTts';
import { normalizeRate, selectPreferredVoice } from '../services/tts/types';
import { WebSpeechTtsAdapter } from '../services/tts/webSpeechTts';

const installSpeech = (voices: any[] = [], boundary = true) => {
  class MockUtterance {
    text: string; lang = ''; rate = 1; voice: unknown;
    onstart?: () => void; onboundary?: (event: any) => void; onpause?: () => void; onresume?: () => void; onend?: () => void; onerror?: (event: any) => void;
    constructor(text: string) { this.text = text; }
  }
  if (boundary) Object.defineProperty(MockUtterance.prototype, 'onboundary', { configurable: true, writable: true, value: undefined });
  const speech = { getVoices: vi.fn(() => voices), speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
  vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
  return { speech, MockUtterance };
};

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
});

describe('Web Speech adapter contract', () => {
  it('is SSR-safe and reports no synchronization when speech is unavailable', () => { const adapter = new WebSpeechTtsAdapter(); expect(adapter.isSupported()).toBe(false); expect(adapter.getCapabilities()).toMatchObject({ ttsAvailable: false, boundaryEventsSupported: false }); });
  it('selects preferred compatible and then English/local/default voices', () => { const voices = [{ id: 'fr', name: 'French', language: 'fr-FR', localService: false, default: false }, { id: 'en', name: 'English', language: 'en-US', localService: true, default: true }]; expect(selectPreferredVoice(voices, 'en')?.id).toBe('en'); expect(selectPreferredVoice(voices, 'missing')?.id).toBe('en'); });
  it('validates rates without inventing browser state', () => { expect(normalizeRate(.75)).toBe(.75); expect(normalizeRate(2)).toBe(1); });
  it('fake adapter deterministically simulates lifecycle, boundaries, and errors', () => { const adapter = new FakeReaderTtsAdapter(); const events: string[] = []; adapter.speak({ text: 'one' }, { onStart: () => events.push('start'), onBoundary: event => events.push(`b${event.charIndex}`), onPause: () => events.push('pause'), onResume: () => events.push('resume'), onEnd: () => events.push('end'), onError: () => events.push('error') }); adapter.boundary(2); adapter.pause(); adapter.resume(); adapter.fail(); adapter.stop(); expect(events).toEqual(['start', 'b2', 'pause', 'resume', 'error', 'end']); });
  it('reports unsupported speak through normalized error callback', () => { const error = vi.fn(); new WebSpeechTtsAdapter().speak({ text: 'x' }, { onError: error }); expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'not-supported' })); });
  it('speaks immediately with the browser default when Chrome voices are initially empty', () => {
    const { speech } = installSpeech([]);
    const adapter = new WebSpeechTtsAdapter();
    expect(adapter.getCapabilities()).toMatchObject({ ttsAvailable: true, voicesAvailable: false });
    adapter.speak({ text: 'Legacy chapter text.' });
    expect(speech.cancel).not.toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalledOnce();
    expect(speech.speak.mock.calls[0][0].text).toBe('Legacy chapter text.');
  });
  it('allows narration when boundary events are unavailable without inventing token progress', () => {
    const { speech } = installSpeech([], false);
    const adapter = new WebSpeechTtsAdapter();
    expect(adapter.getCapabilities().boundaryEventsSupported).toBe(false);
    adapter.speak({ text: 'Audio still works.' });
    expect(speech.speak).toHaveBeenCalledOnce();
  });
  it('ignores late boundary and end callbacks from a replaced utterance', () => {
    const { speech } = installSpeech();
    const adapter = new WebSpeechTtsAdapter();
    const firstBoundary = vi.fn();
    const firstEnd = vi.fn();
    const secondBoundary = vi.fn();
    adapter.speak({ text: 'first' }, { onBoundary: firstBoundary, onEnd: firstEnd });
    const first = speech.speak.mock.calls[0][0];
    adapter.speak({ text: 'second' }, { onBoundary: secondBoundary });
    const second = speech.speak.mock.calls[1][0];
    first.onboundary?.({ charIndex: 0, charLength: 5, name: 'word' });
    first.onend?.();
    expect(firstBoundary).not.toHaveBeenCalled();
    expect(firstEnd).not.toHaveBeenCalled();
    second.onboundary?.({ charIndex: 0, charLength: 6, name: 'word' });
    expect(secondBoundary).toHaveBeenCalledWith({ charIndex: 0, charLength: 6, name: 'word' });
  });
  it('never cancels unrelated browser speech while idle, but stops its owned narration', () => {
    const { speech, MockUtterance } = installSpeech();
    const adapter = new WebSpeechTtsAdapter();
    speech.speak(new MockUtterance('manual browser speech'));
    adapter.stop();
    expect(speech.cancel).not.toHaveBeenCalled();
    adapter.speak({ text: 'Reader narration' });
    expect(speech.speak).toHaveBeenCalledTimes(2);
    expect(speech.cancel).not.toHaveBeenCalled();
    adapter.stop();
    expect(speech.cancel).toHaveBeenCalledOnce();
  });
  it('releases failed Read Along ownership without poisoning later browser speech', () => {
    const { speech, MockUtterance } = installSpeech();
    const adapter = new WebSpeechTtsAdapter();
    const error = vi.fn();
    adapter.speak({ text: 'Reader narration' }, { onError: error });
    const readerUtterance = speech.speak.mock.calls[0][0];
    readerUtterance.onerror?.({ error: 'synthesis-failed' });
    adapter.stop();
    speech.speak(new MockUtterance('word pronunciation'));
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'synthesis-failed' }));
    expect(speech.cancel).not.toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale end callback after Read Along is closed', () => {
    const { speech } = installSpeech();
    const adapter = new WebSpeechTtsAdapter();
    const end = vi.fn();
    adapter.speak({ text: 'Reader narration' }, { onEnd: end });
    const utterance = speech.speak.mock.calls[0][0];
    adapter.stop();
    utterance.onend?.();
    expect(speech.cancel).toHaveBeenCalledOnce();
    expect(end).not.toHaveBeenCalled();
  });
});
