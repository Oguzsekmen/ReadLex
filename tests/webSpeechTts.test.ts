import { describe, expect, it, vi } from 'vitest';
import { FakeReaderTtsAdapter } from '../services/tts/fakeReaderTts';
import { normalizeRate, selectPreferredVoice } from '../services/tts/types';
import { WebSpeechTtsAdapter } from '../services/tts/webSpeechTts';

describe('Web Speech adapter contract', () => {
  it('is SSR-safe and reports no synchronization when speech is unavailable', () => { const adapter = new WebSpeechTtsAdapter(); expect(adapter.isSupported()).toBe(false); expect(adapter.getCapabilities()).toMatchObject({ ttsAvailable: false, boundaryEventsSupported: false }); });
  it('selects preferred compatible and then English/local/default voices', () => { const voices = [{ id: 'fr', name: 'French', language: 'fr-FR', localService: false, default: false }, { id: 'en', name: 'English', language: 'en-US', localService: true, default: true }]; expect(selectPreferredVoice(voices, 'en')?.id).toBe('en'); expect(selectPreferredVoice(voices, 'missing')?.id).toBe('en'); });
  it('validates rates without inventing browser state', () => { expect(normalizeRate(.75)).toBe(.75); expect(normalizeRate(2)).toBe(1); });
  it('fake adapter deterministically simulates lifecycle, boundaries, and errors', () => { const adapter = new FakeReaderTtsAdapter(); const events: string[] = []; adapter.speak({ text: 'one' }, { onStart: () => events.push('start'), onBoundary: event => events.push(`b${event.charIndex}`), onPause: () => events.push('pause'), onResume: () => events.push('resume'), onEnd: () => events.push('end'), onError: () => events.push('error') }); adapter.boundary(2); adapter.pause(); adapter.resume(); adapter.fail(); adapter.stop(); expect(events).toEqual(['start', 'b2', 'pause', 'resume', 'error', 'end']); });
  it('reports unsupported speak through normalized error callback', () => { const error = vi.fn(); new WebSpeechTtsAdapter().speak({ text: 'x' }, { onError: error }); expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'not-supported' })); });
});
