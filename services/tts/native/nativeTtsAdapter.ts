import { normalizeRate, ReaderTtsAdapter, ReaderTtsCallbacks, ReaderTtsCapabilities, ReaderTtsRequest, ReaderTtsVoice } from '../types';
import { NativeTtsBridge, NativeTtsEvent } from './types';

/** Shared adapter for native range callbacks; platform implementations stay in a bridge. */
export class NativeTtsAdapter implements ReaderTtsAdapter {
  private operation = 0;
  private rate = 1;
  private activeSession?: string;

  constructor(private readonly bridge: NativeTtsBridge | undefined) {}

  isSupported(): boolean { return Boolean(this.bridge?.isAvailable()); }
  getCapabilities(): ReaderTtsCapabilities {
    if (!this.isSupported()) return { ttsAvailable: false, boundaryEventsSupported: false, pauseResumeSupported: false, voicesAvailable: false };
    return this.bridge!.getCapabilities();
  }
  getVoices(): Promise<ReaderTtsVoice[]> { return this.isSupported() ? this.bridge!.getVoices() : Promise.resolve([]); }
  setRate(rate: number): number { this.rate = normalizeRate(rate); if (this.isSupported()) this.bridge!.setRate(this.rate); return this.rate; }

  speak(request: ReaderTtsRequest, callbacks: ReaderTtsCallbacks = {}): void {
    if (!this.isSupported()) { callbacks.onError?.({ code: 'not-supported', message: 'Native speech is unavailable.' }); return; }
    const sessionId = `native-${++this.operation}`;
    this.activeSession = sessionId;
    this.bridge!.speak({ ...request, rate: this.setRate(request.rate ?? this.rate), voiceId: request.preferredVoiceId, sessionId }, event => {
      if (event.sessionId !== sessionId || this.activeSession !== sessionId) return;
      this.forward(event, callbacks);
      if (event.type === 'END' || event.type === 'ERROR') this.activeSession = undefined;
    });
  }

  pause(): void { if (this.getCapabilities().pauseResumeSupported) this.bridge!.pause(); }
  resume(): void { if (this.getCapabilities().pauseResumeSupported) this.bridge!.resume(); }
  stop(): void { this.operation += 1; this.activeSession = undefined; this.bridge?.stop(); }

  private forward(event: NativeTtsEvent, callbacks: ReaderTtsCallbacks): void {
    if (event.type === 'START') callbacks.onStart?.();
    else if (event.type === 'BOUNDARY') callbacks.onBoundary?.({ charIndex: event.charIndex, charLength: event.charLength, sessionId: event.sessionId });
    else if (event.type === 'PAUSE') callbacks.onPause?.();
    else if (event.type === 'RESUME') callbacks.onResume?.();
    else if (event.type === 'END') callbacks.onEnd?.();
    else callbacks.onError?.(event.error);
  }
}
