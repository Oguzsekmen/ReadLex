import {
  normalizeRate,
  ReaderTtsAdapter,
  ReaderTtsCallbacks,
  ReaderTtsCapabilities,
  ReaderTtsError,
  ReaderTtsRequest,
  ReaderTtsVoice,
  selectPreferredVoice,
} from "./types";
import { readAlongDebug } from "./debug";
export class WebSpeechTtsAdapter implements ReaderTtsAdapter {
  private operation = 0;
  private rate = 1;
  private utterance?: SpeechSynthesisUtterance;
  private ownsActiveUtterance = false;
  private api() {
    return typeof window === "undefined" ? undefined : window.speechSynthesis;
  }
  isSupported() {
    return Boolean(
      this.api() && typeof SpeechSynthesisUtterance !== "undefined",
    );
  }
  getCapabilities(): ReaderTtsCapabilities {
    const available = this.isSupported();
    return {
      ttsAvailable: available,
      boundaryEventsSupported:
        available && "onboundary" in SpeechSynthesisUtterance.prototype,
      pauseResumeSupported:
        available &&
        typeof this.api()?.pause === "function" &&
        typeof this.api()?.resume === "function",
      voicesAvailable: Boolean(this.api()?.getVoices().length),
    };
  }
  async getVoices(): Promise<ReaderTtsVoice[]> {
    const api = this.api();
    if (!api) return [];
    return api
      .getVoices()
      .map((v) => ({
        id: v.voiceURI,
        name: v.name,
        language: v.lang,
        localService: v.localService,
        default: v.default,
      }));
  }
  setRate(rate: number) {
    this.rate = normalizeRate(rate);
    return this.rate;
  }
  speak(request: ReaderTtsRequest, callbacks: ReaderTtsCallbacks = {}) {
    const api = this.api();
    if (!this.isSupported() || !api) {
      readAlongDebug("adapter unsupported");
      callbacks.onError?.({
        code: "not-supported",
        message: "Speech synthesis is unavailable.",
      });
      return;
    }
    const shouldCancelOwnedSpeech = this.ownsActiveUtterance;
    const op = ++this.operation;
    readAlongDebug("synth before", {
      paused: api.paused,
      speaking: api.speaking,
      pending: api.pending,
      ownsActiveUtterance: shouldCancelOwnedSpeech,
      textLength: request.text.length,
    });
    if (shouldCancelOwnedSpeech) api.cancel();
    const utterance = new SpeechSynthesisUtterance(request.text);
    this.utterance = utterance;
    this.ownsActiveUtterance = true;
    utterance.lang = request.language || "en-US";
    utterance.rate = this.setRate(request.rate ?? this.rate);
    const voices = api
      .getVoices()
      .map((v) => ({
        id: v.voiceURI,
        name: v.name,
        language: v.lang,
        localService: v.localService,
        default: v.default,
      }));
    const selected = selectPreferredVoice(voices, request.preferredVoiceId);
    if (selected) {
      const native = api.getVoices().find((v) => v.voiceURI === selected.id);
      if (native) utterance.voice = native;
    }
    utterance.onstart = () => {
      if (op === this.operation) {
        readAlongDebug("adapter onstart", { operation: op });
        callbacks.onStart?.();
      }
    };
    utterance.onboundary = (event) => {
      if (op === this.operation && Number.isInteger(event.charIndex))
        callbacks.onBoundary?.({
          charIndex: event.charIndex,
          charLength: Number(event.charLength) || undefined,
          name: event.name || undefined,
        });
    };
    utterance.onpause = () => {
      if (op === this.operation) {
        readAlongDebug("adapter onpause", { operation: op });
        callbacks.onPause?.();
      }
    };
    utterance.onresume = () => {
      if (op === this.operation) {
        readAlongDebug("adapter onresume", { operation: op });
        callbacks.onResume?.();
      }
    };
    utterance.onend = () => {
      if (op === this.operation) {
        this.utterance = undefined;
        this.ownsActiveUtterance = false;
        readAlongDebug("adapter onend", { operation: op });
        callbacks.onEnd?.();
      }
    };
    utterance.onerror = (event) => {
      if (op === this.operation) {
        this.utterance = undefined;
        this.ownsActiveUtterance = false;
        const error: ReaderTtsError = {
          code: event.error === "canceled" ? "canceled" : "synthesis-failed",
          message: event.error || "Speech synthesis failed.",
        };
        readAlongDebug("adapter onerror", { operation: op, code: error.code });
        callbacks.onError?.(error);
      }
    };
    readAlongDebug("speak()", {
      operation: op,
      voice: selected?.id,
      rate: utterance.rate,
    });
    api.speak(utterance);
    readAlongDebug("synth after", {
      paused: api.paused,
      speaking: api.speaking,
      pending: api.pending,
      ownsActiveUtterance: this.ownsActiveUtterance,
    });
  }
  pause() {
    this.api()?.pause();
  }
  resume() {
    this.api()?.resume();
  }
  stop() {
    const shouldCancelOwnedSpeech = this.ownsActiveUtterance;
    this.operation += 1;
    this.utterance = undefined;
    this.ownsActiveUtterance = false;
    readAlongDebug("adapter stop", {
      cancelOwnedSpeech: shouldCancelOwnedSpeech,
    });
    if (shouldCancelOwnedSpeech) this.api()?.cancel();
  }
}
