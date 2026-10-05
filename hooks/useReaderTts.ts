import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  legacyReaderTokens,
  PreparedReaderToken,
} from "../services/readerLanguageData";
import {
  buildSpeechChunksFromToken,
  findNextSentenceStartToken,
  findPreviousSentenceStartToken,
  findSentenceStartToken,
  resolveTokenFromCharIndex,
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
  const spokenTokens = useMemo(
    () => narrationTokens.filter((token) => token.isWord),
    [narrationTokens],
  );
  const session = useRef(0);
  const resumeToken = useRef<number>();
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
    resumeToken.current = undefined;
    setActiveTokenIndex(undefined);
    setActiveSentenceId(undefined);
  }, [adapter, text]);
  const startFromToken = useCallback(
    (
      requestedIndex =
        activeTokenIndex ??
        resumeToken.current ??
        narrationTokens.find((token) => token.isWord)?.index,
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
      resumeToken.current = index;

      let chunks: ReturnType<typeof buildSpeechChunksFromToken>;
      try {
        chunks = buildSpeechChunksFromToken(text, narrationTokens, index);
      } catch (error) {
        readAlongDebug("chunk preparation error", {
          message: error instanceof Error ? error.message : "unknown",
        });
        setStatus("ERROR");
        return;
      }
      if (!chunks.length) {
        readAlongDebug("play ignored: no speech chunks", { tokenIndex: index });
        return;
      }

      const id = ++session.current;
      readAlongDebug("session start", {
        adapter: adapter.constructor.name,
        tokenCount: narrationTokens.length,
        startToken: index,
        chunkCount: chunks.length,
        synchronizationSupported: capabilities.boundaryEventsSupported,
      });
      const playChunk = (chunkIndex: number) => {
        if (id !== session.current) return;
        const chunk = chunks[chunkIndex];
        if (!chunk) {
          setStatus("IDLE");
          return;
        }
        readAlongDebug("chunk prepared", {
          chunkIndex,
          textLength: chunk.text.length,
          globalStartChar: chunk.globalStartChar,
          globalEndChar: chunk.globalEndChar,
          firstToken: chunk.firstTokenIndex,
          lastToken: chunk.lastTokenIndex,
        });
        adapter.speak(
          {
            text: chunk.text,
            rate,
            language: "en-US",
            preferredVoiceId: voice?.id,
          },
          {
            onStart: () => {
              if (id !== session.current) return;
              readAlongDebug("chunk onstart", { chunkIndex });
              setStatus("SPEAKING");
            },
            onBoundary: (event) => {
              if (
                id !== session.current ||
                !capabilities.boundaryEventsSupported
              )
                return;
              const token = resolveTokenFromCharIndex(
                narrationTokens,
                chunk.globalStartChar + event.charIndex,
              );
              if (!token) return;
              readAlongDebug("boundary", {
                chunkIndex,
                localCharIndex: event.charIndex,
                globalCharIndex: chunk.globalStartChar + event.charIndex,
                tokenIndex: token.index,
                sentenceId: token.sentenceId,
              });
              resumeToken.current = token.index;
              setActiveTokenIndex((previous) =>
                previous === token.index ? previous : token.index,
              );
              setActiveSentenceId((previous) =>
                previous === token.sentenceId ? previous : token.sentenceId,
              );
            },
            onPause: () => {
              if (id !== session.current) return;
              readAlongDebug("chunk onpause", { chunkIndex });
              setStatus("PAUSED");
            },
            onResume: () => {
              if (id !== session.current) return;
              readAlongDebug("chunk onresume", { chunkIndex });
              setStatus("SPEAKING");
            },
            onEnd: () => {
              if (id !== session.current) return;
              readAlongDebug("chunk end", { chunkIndex });
              if (chunkIndex + 1 < chunks.length) {
                readAlongDebug("next chunk", { chunkIndex: chunkIndex + 1 });
                playChunk(chunkIndex + 1);
              } else {
                setStatus("IDLE");
              }
            },
            onError: (error) => {
              if (id !== session.current) return;
              readAlongDebug("error", { chunkIndex, code: error.code });
              setStatus("ERROR");
            },
          },
        );
      };
      playChunk(0);
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
        const token = activeTokenIndex ?? resumeToken.current;
        stop();
        setTimeout(() => startFromToken(token), 0);
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
  const moveByWords = useCallback(
    (delta: number) => {
      if (!spokenTokens.length) return;
      const current = activeTokenIndex ?? resumeToken.current;
      const currentPosition = spokenTokens.findIndex(
        (token) => token.index === current,
      );
      const position = currentPosition < 0 ? 0 : currentPosition;
      const target = spokenTokens[
        Math.max(0, Math.min(spokenTokens.length - 1, position + delta))
      ];
      if (target) startFromToken(target.index);
    },
    [activeTokenIndex, spokenTokens, startFromToken],
  );
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
    moveByWords,
  };
};
