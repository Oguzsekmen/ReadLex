import { describe, expect, it } from 'vitest';
import { AndroidNativeTtsAdapter } from '../services/tts/native/androidTts';
import { FakeNativeTtsBridge } from '../services/tts/native/fakeNativeTtsBridge';
import { IosNativeTtsAdapter } from '../services/tts/native/iosTts';
import { ReaderTtsCapabilities } from '../services/tts/types';

const unsupported: ReaderTtsCapabilities = { ttsAvailable: false, boundaryEventsSupported: false, pauseResumeSupported: false, voicesAvailable: false };
const verifyNativeAdapter = (create: (bridge?: FakeNativeTtsBridge) => AndroidNativeTtsAdapter | IosNativeTtsAdapter) => {
  const missing = create();
  expect(missing.isSupported()).toBe(false);
  expect(missing.getCapabilities()).toEqual(unsupported);

  const bridge = new FakeNativeTtsBridge(); const adapter = create(bridge); const events: string[] = [];
  adapter.speak({ text: 'door opened the door', language: 'en-US', rate: 1.25, preferredVoiceId: 'native-en' }, {
    onStart: () => events.push('start'), onBoundary: event => events.push(`boundary:${event.charIndex}:${event.charLength}`), onPause: () => events.push('pause'), onResume: () => events.push('resume'), onEnd: () => events.push('end'), onError: () => events.push('error')
  });
  expect(bridge.request).toMatchObject({ text: 'door opened the door', language: 'en-US', rate: 1.25, voiceId: 'native-en' });
  bridge.boundary(16, 4); adapter.pause(); adapter.resume(); bridge.end(); bridge.end();
  expect(events).toEqual(['start', 'boundary:16:4', 'pause', 'resume', 'end']);
  expect(adapter.setRate(4)).toBe(1);
};

describe('native TTS adapters', () => {
  it('Android bridge forwards exact text, ranges, voice/rate and native lifecycle once', () => verifyNativeAdapter(bridge => new AndroidNativeTtsAdapter(bridge)));
  it('iOS bridge normalizes spoken ranges into the same JS boundary contract', () => verifyNativeAdapter(bridge => new IosNativeTtsAdapter(bridge)));
  it('stops invalidate stale Android/iOS ranges and errors stay normalized', () => {
    for (const create of [
      (bridge: FakeNativeTtsBridge) => new AndroidNativeTtsAdapter(bridge),
      (bridge: FakeNativeTtsBridge) => new IosNativeTtsAdapter(bridge)
    ]) {
      const bridge = new FakeNativeTtsBridge(); const adapter = create(bridge); let boundaries = 0; let errors = 0;
      adapter.speak({ text: 'door' }, { onBoundary: () => boundaries += 1, onError: () => errors += 1 });
      adapter.stop(); bridge.boundary(0); bridge.fail();
      expect(boundaries).toBe(0); expect(errors).toBe(0);
    }
  });
});
