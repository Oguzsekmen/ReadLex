import { ReaderTtsCapabilities, ReaderTtsError, ReaderTtsRequest, ReaderTtsVoice } from '../types';

export type NativeTtsEvent =
  | { type: 'START'; sessionId: string }
  | { type: 'BOUNDARY'; sessionId: string; charIndex: number; charLength?: number }
  | { type: 'PAUSE'; sessionId: string }
  | { type: 'RESUME'; sessionId: string }
  | { type: 'END'; sessionId: string }
  | { type: 'ERROR'; sessionId: string; error: ReaderTtsError };

export type NativeTtsSpeakRequest = ReaderTtsRequest & { sessionId: string; voiceId?: string };

/** Capacitor/Kotlin/Swift code implements this narrow, JS-safe boundary later. */
export interface NativeTtsBridge {
  isAvailable(): boolean;
  getCapabilities(): ReaderTtsCapabilities;
  getVoices(): Promise<ReaderTtsVoice[]>;
  speak(request: NativeTtsSpeakRequest, onEvent: (event: NativeTtsEvent) => void): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
}
