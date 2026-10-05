import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  legacyReaderTokens,
  PreparedReaderToken,
} from "../services/readerLanguageData";
import {
  buildSpeechSegmentFromToken,
  findNextSentenceStartToken,
  findPreviousSentenceStartToken,
  findSentenceStartToken,
  resolveSegmentCharIndex,
} from "../services/tts/tokenSync";
import {
  ReaderTtsAdapter,
  ReaderTtsStatus,
  ReaderTtsVoice,
  normalizeRate,
} from "../services/tts/types";
import { createReaderTtsAdapter } from "../services/tts/native/nativeTtsFactory";
import { readAlongDebug } from "../services/tts/debug";

export const useReaderTts = (
  text: string,
  tokens: PreparedReaderToken[],
  injected?: ReaderTtsAdapter,
) => {
  const adapter = useMemo(
    () => injected || createReaderTtsAdapter(),
    [injected],
  );
  const narrationTokens = useMemo(
    () => (tokens.length ? tokens : legacyReaderTokens(text)),
    [text, tokens.length ? tokens : text],
  );
  const session = useRef(0);
  const source = useRef<
    { adapter: ReaderTtsAdapter; text: string } | undefined
  >(undefined);
  const [status, setStatus] = useState<ReaderTtsStatus>("IDLE");
  const [rate, setRateState] = useState(1);
  const [voice, setVoice] = useState<ReaderTtsVoice>();
  const [voices, setVoices] = useState<ReaderTtsVoice[]>([]);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number>();
  const [activeSentenceId, setActiveSentenceId] = useState<string>();
  const [followEnabled, setFollowEnabled] = useState(true);
  const capabilities = adapter.getCapabilities();
  useEffect(() => {
    let mounted = true;
    void adapter.getVoices().then((value) => {
      if (mounted) setVoices(value);
    });
    return () => {
      mounted = false;
      session.current += 1;
      adapter.stop();
    };
  }, [adapter]);
  useEffect(() => {
    const previous = source.current;
    source.current = { adapter, text };
    if (!previous) return;
    session.current += 1;
    if (previous.adapter === adapter) adapter.stop();
    setStatus("IDLE");
    setActiveTokenIndex(undefined);
    setActiveSentenceId(undefined);
  }, [adapter, text]);
  const startFromToken = useCallback(
    (
      requestedIndex = activeTokenIndex ??
        narrationTokens.find((t) => t.isWord)?.index,
    ) => {
      const firstWordIndex = narrationTokens.find(
        (token) => token.isWord,
      )?.index;
      if (firstWordIndex === undefined) {
        readAlongDebug("play ignored: no spoken tokens");
        return;
      }
      const index =
        requestedIndex !== undefined &&
        narrationTokens.some(
          (token) => token.isWord && token.index === requestedIndex,
        )
          ? requestedIndex
          : firstWordIndex;
      const segment = buildSpeechSegmentFromToken(text, narrationTokens, index);
      if (!segment?.speechText.trim()) {
        readAlongDebug("play ignored: empty segment", { tokenIndex: index });
        return;
      }
      const id = ++session.current;
      readAlongDebug("play", {
        adapter: adapter.constructor.name,
        tokenCount: narrationTokens.length,
        startToken: index,
        textLength: segment.speechText.length,
        synchronizationSupported: capabilities.boundaryEventsSupported,
      });
      adapter.speak(
        {
          text: segment.speechText,
          rate,
          language: "en-US",
          preferredVoiceId: voice?.id,
        },
        {
          onStart: () => {
            readAlongDebug("onstart", { session: id });
            if (id === session.current) setStatus("SPEAKING");
          },
          onBoundary: (event) => {
            if (id !== session.current || !capabilities.boundaryEventsSupported)
              return;
            const token = resolveSegmentCharIndex(
              segment,
              narrationTokens,
              event.charIndex,
            );
            if (token) {
              readAlongDebug("onboundary", {
                tokenIndex: token.index,
                sentenceId: token.sentenceId,
              });
              setActiveTokenIndex((previous) =>
                previous === token.index ? previous : token.index,
              );
              setActiveSentenceId((previous) =>
                previous === token.sentenceId ? previous : token.sentenceId,
              );
            }
          },
          onPause: () => {
            readAlongDebug("onpause", { session: id });
            if (id === session.current) setStatus("PAUSED");
          },
          onResume: () => {
            readAlongDebug("onresume", { session: id });
            if (id === session.current) setStatus("SPEAKING");
          },
          onEnd: () => {
            readAlongDebug("onend", { session: id });
            if (id === session.current) setStatus("IDLE");
          },
          onError: (error) => {
            readAlongDebug("onerror", { session: id, code: error.code });
            if (id === session.current) setStatus("ERROR");
          },
        },
      );
    },
    [
      activeTokenIndex,
      adapter,
      capabilities.boundaryEventsSupported,
      narrationTokens,
      rate,
      text,
      voice?.id,
    ],
  );
  const stop = useCallback(() => {
    readAlongDebug("stop");
    session.current += 1;
    adapter.stop();
    setStatus("IDLE");
  }, [adapter]);
  const pause = useCallback(() => {
    adapter.pause();
    setStatus("PAUSED");
  }, [adapter]);
  const resume = useCallback(() => {
    if (capabilities.pauseResumeSupported) {
      adapter.resume();
      setStatus("SPEAKING");
    } else startFromToken();
  }, [adapter, capabilities.pauseResumeSupported, startFromToken]);
  const setRate = useCallback(
    (value: number) => {
      const next = normalizeRate(value);
      setRateState(next);
      if (status === "SPEAKING") {
        stop();
        setTimeout(() => startFromToken(), 0);
      }
    },
    [startFromToken, status, stop],
  );
  const sentence = (
    resolver: (
      values: PreparedReaderToken[],
      index: number,
    ) => PreparedReaderToken | null,
  ) => {
    if (activeTokenIndex === undefined) return;
    const token = resolver(narrationTokens, activeTokenIndex);
    if (token) startFromToken(token.index);
  };
  return {
    supported: capabilities.ttsAvailable,
    synchronizationSupported: capabilities.boundaryEventsSupported,
    status,
    speaking: status === "SPEAKING",
    paused: status === "PAUSED",
    rate,
    voice,
    voices,
    setVoice,
    activeTokenIndex,
    activeSentenceId,
    followEnabled,
    setFollowEnabled,
    start: () => startFromToken(),
    startFromToken,
    pause,
    resume,
    stop,
    setRate,
    repeatCurrentSentence: () =>
      activeSentenceId &&
      startFromToken(
        findSentenceStartToken(narrationTokens, activeSentenceId)?.index,
      ),
    previousSentence: () => sentence(findPreviousSentenceStartToken),
    nextSentence: () => sentence(findNextSentenceStartToken),
  };
};
