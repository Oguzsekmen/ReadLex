import { describe, expect, it } from 'vitest';
import { FakeNativeTtsBridge } from '../services/tts/native/fakeNativeTtsBridge';
import { createReaderTtsAdapter } from '../services/tts/native/nativeTtsFactory';
import { AndroidNativeTtsAdapter } from '../services/tts/native/androidTts';
import { IosNativeTtsAdapter } from '../services/tts/native/iosTts';
import { FakeReaderTtsAdapter } from '../services/tts/fakeReaderTts';

describe('native TTS factory', () => {
  it('chooses the existing web adapter on web', () => { const web = new FakeReaderTtsAdapter(); expect(createReaderTtsAdapter({ platform: 'web', web })).toBe(web); });
  it('chooses native Android/iOS adapters only when their bridge is available', () => {
    expect(createReaderTtsAdapter({ platform: 'android', bridges: { android: new FakeNativeTtsBridge() } })).toBeInstanceOf(AndroidNativeTtsAdapter);
    expect(createReaderTtsAdapter({ platform: 'ios', bridges: { ios: new FakeNativeTtsBridge() } })).toBeInstanceOf(IosNativeTtsAdapter);
  });
  it('falls back to usable Web Speech or safe unsupported adapter when a native bridge is absent', () => {
    const web = new FakeReaderTtsAdapter(); expect(createReaderTtsAdapter({ platform: 'android', web })).toBe(web);
    const unavailable = createReaderTtsAdapter({ platform: 'ios', web: new (class extends FakeReaderTtsAdapter { isSupported() { return false; } })() });
    expect(unavailable.isSupported()).toBe(false);
  });
});
