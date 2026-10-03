export type ReaderTtsStatus = 'IDLE' | 'SPEAKING' | 'PAUSED' | 'ERROR';
export type ReaderTtsCapabilities = { ttsAvailable: boolean; boundaryEventsSupported: boolean; pauseResumeSupported: boolean; voicesAvailable: boolean };
export type ReaderTtsVoice = { id: string; name: string; language: string; localService: boolean; default: boolean };
export type ReaderTtsBoundaryEvent = { charIndex: number; charLength?: number; name?: string; sessionId?: string };
export type ReaderTtsRequest = { text: string; rate?: number; language?: string; preferredVoiceId?: string };
export type ReaderTtsError = { code: 'not-supported' | 'synthesis-failed' | 'voice-unavailable' | 'canceled' | 'unknown'; message: string };
export type ReaderTtsCallbacks = { onStart?: () => void; onBoundary?: (event: ReaderTtsBoundaryEvent) => void; onPause?: () => void; onResume?: () => void; onEnd?: () => void; onError?: (error: ReaderTtsError) => void };
export interface ReaderTtsAdapter { isSupported(): boolean; getCapabilities(): ReaderTtsCapabilities; getVoices(): Promise<ReaderTtsVoice[]>; speak(request: ReaderTtsRequest, callbacks?: ReaderTtsCallbacks): void; pause(): void; resume(): void; stop(): void; setRate(rate: number): number; }
export const normalizeRate = (rate = 1) => [0.75, 1, 1.25, 1.5].includes(rate) ? rate : 1;
export const selectPreferredVoice = (voices: ReaderTtsVoice[], preferred?: string) => voices.find(v => v.id === preferred && /^en([-_]|$)/i.test(v.language)) || voices.find(v => /^en([-_]|$)/i.test(v.language) && v.localService) || voices.find(v => /^en([-_]|$)/i.test(v.language)) || voices.find(v => v.default) || voices[0];
