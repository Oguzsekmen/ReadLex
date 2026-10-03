import { ReaderTtsCapabilities, ReaderTtsVoice } from '../types';
import { NativeTtsBridge, NativeTtsEvent, NativeTtsSpeakRequest } from './types';

export class FakeNativeTtsBridge implements NativeTtsBridge {
  request?: NativeTtsSpeakRequest;
  events?: (event: NativeTtsEvent) => void;
  constructor(private available = true, private capabilities: ReaderTtsCapabilities = { ttsAvailable: true, boundaryEventsSupported: true, pauseResumeSupported: true, voicesAvailable: true }) {}
  isAvailable(): boolean { return this.available; }
  getCapabilities(): ReaderTtsCapabilities { return this.capabilities; }
  async getVoices(): Promise<ReaderTtsVoice[]> { return [{ id: 'native-en', name: 'Native English', language: 'en-US', localService: true, default: true }]; }
  speak(request: NativeTtsSpeakRequest, onEvent: (event: NativeTtsEvent) => void): void { this.request = request; this.events = onEvent; onEvent({ type: 'START', sessionId: request.sessionId }); }
  pause(): void { if (this.request) this.events?.({ type: 'PAUSE', sessionId: this.request.sessionId }); }
  resume(): void { if (this.request) this.events?.({ type: 'RESUME', sessionId: this.request.sessionId }); }
  stop(): void { if (this.request) this.events?.({ type: 'END', sessionId: this.request.sessionId }); }
  setRate(_rate: number): void {}
  boundary(charIndex: number, charLength?: number): void { if (this.request) this.events?.({ type: 'BOUNDARY', sessionId: this.request.sessionId, charIndex, charLength }); }
  end(): void { if (this.request) this.events?.({ type: 'END', sessionId: this.request.sessionId }); }
  fail(): void { if (this.request) this.events?.({ type: 'ERROR', sessionId: this.request.sessionId, error: { code: 'synthesis-failed', message: 'fake native failure' } }); }
}
