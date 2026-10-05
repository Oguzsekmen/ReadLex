import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Book, UserBookProgress, VocabularyWord } from "../types";
import {
  legacyReaderTokens,
  LatestTapGuard,
  PreparedReaderToken,
  readerLanguageData,
  ReaderLanguageChapter,
} from "../services/readerLanguageData";
import { vocabularyFromPreparedToken } from "../services/readerVocabulary";
import {
  groupPreparedTokenBlocks,
  INITIAL_RENDER_BLOCKS,
  RENDER_BLOCK_INCREMENT,
  calculateScrollPercent,
  ReaderProgressUpdate,
  resumeTarget,
} from "../services/readerEngine";
import { useReaderProgress } from "../hooks/useReaderProgress";
import { useReaderScroll } from "../hooks/useReaderScroll";
import { useReaderTts } from "../hooks/useReaderTts";
import { useNativeBackHandler } from "../hooks/useNativeAppLifecycle";
import { readAlongDebug } from "../services/tts/debug";
import { ReadAlongPlayer } from "./ReadAlongPlayer";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  Loader2,
  Star,
  Type,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface Props {
  book: Book;
  initialChapterIndex: number;
  initialProgress?: UserBookProgress;
  onBack: () => void;
  onSaveWord: (word: VocabularyWord) => void;
  savedWords: VocabularyWord[];
  onCompleteChapter: (bookId: string, chapterIndex: number) => void;
  onUpdateProgress: (
    bookId: string,
    chapterIndex: number,
    update: ReaderProgressUpdate,
  ) => void;
  onProgressFlushReady?: (flush?: () => void) => void;
}
type Selection = {
  word: string;
  tokenIndex: number;
  normalizedWord?: string;
  context: string;
  translatedContext?: string;
  x: number;
  y: number;
};
const FONTS = [
  { name: "Sans", class: "font-sans" },
  { name: "Serif", class: "font-serif" },
  { name: "Mono", class: "font-mono" },
];

const BookReaderV2: React.FC<Props> = ({
  book,
  initialChapterIndex,
  initialProgress,
  onBack,
  onSaveWord,
  savedWords,
  onCompleteChapter,
  onUpdateProgress,
  onProgressFlushReady,
}) => {
  const chapters = book.chapters || [];
  const [chapterIndex, setChapterIndex] = useState(initialChapterIndex);
  const [languageChapter, setLanguageChapter] =
    useState<ReaderLanguageChapter | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [definition, setDefinition] = useState<any>(null);
  const [translationMessage, setTranslationMessage] = useState<string | null>(
    null,
  );
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [visibleBlocks, setVisibleBlocks] = useState(INITIAL_RENDER_BLOCKS);
  const [fontSize, setFontSize] = useState(
    () => Number(localStorage.getItem("reader-font-size")) || 19,
  );
  const [lineHeight, setLineHeight] = useState(
    () => Number(localStorage.getItem("reader-line-height")) || 1.75,
  );
  const [fontClass, setFontClass] = useState(
    () => localStorage.getItem("reader-font") || FONTS[0].class,
  );
  const [showPreferences, setShowPreferences] = useState(false);
  const [ttsActivated, setTtsActivated] = useState(false);
  const [ttsMessage, setTtsMessage] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const readerCardRef = useRef<HTMLDivElement>(null);
  const [playerBounds, setPlayerBounds] = useState<
    { left: number; width: number } | undefined
  >();
  const latestTap = useRef(new LatestTapGuard());
  const scrollFrame = useRef<number>();
  const resumedChapter = useRef<string>();
  const currentChapter = chapters[chapterIndex] || chapters[0];
  const isLastChapter = chapterIndex === chapters.length - 1;
  const { scrollToToken, scrollToSentence, userHasScrolled, resetUserScroll } =
    useReaderScroll(articleRef);
  const chapterHash =
    languageChapter?.mode === "prepared"
      ? languageChapter.metadata.chapterContentHash
      : undefined;
  const persistProgress = useCallback(
    (update: ReaderProgressUpdate) =>
      onUpdateProgress(book.id, chapterIndex, update),
    [book.id, chapterIndex, onUpdateProgress],
  );
  const { progress, updateProgress, flushProgress } = useReaderProgress(
    {
      chapterId: currentChapter?.id || "",
      chapterContentHash: chapterHash,
      tokenIndex: initialProgress?.lastWordIndex || 0,
      scrollPercent: initialProgress?.progressPercent || 0,
    },
    persistProgress,
  );
  useEffect(() => {
    onProgressFlushReady?.(flushProgress);
    return () => onProgressFlushReady?.(undefined);
  }, [flushProgress, onProgressFlushReady]);
  const preparedBlocks = useMemo(
    () =>
      languageChapter?.mode === "prepared"
        ? groupPreparedTokenBlocks(languageChapter.tokens)
        : [],
    [languageChapter],
  );
  const narrationTokens = useMemo(
    () =>
      languageChapter?.mode === "prepared"
        ? languageChapter.tokens
        : legacyReaderTokens(currentChapter?.content || ""),
    [currentChapter?.content, languageChapter],
  );
  const legacyBlocks = useMemo(() => {
    const blocks: PreparedReaderToken[][] = [[]];
    narrationTokens.forEach((token) => {
      if (/\r\n|\r|\n/.test(token.text)) blocks.push([]);
      else blocks[blocks.length - 1].push(token);
    });
    return blocks.filter((block) => block.some((token) => token.text.trim()));
  }, [narrationTokens]);
  const firstTokenBySentence = useMemo(
    () =>
      new Map(
        narrationTokens
          .filter((token) => token.isWord)
          .map((token) => [token.sentenceId, token.index]),
      ),
    [narrationTokens],
  );
  const tts = useReaderTts(currentChapter?.content || "", narrationTokens);
  const spokenTokens = useMemo(
    () => narrationTokens.filter((token) => token.isWord),
    [narrationTokens],
  );
  const activeSpokenPosition =
    tts.activeTokenIndex === undefined
      ? -1
      : spokenTokens.findIndex((token) => token.index === tts.activeTokenIndex);
  const ttsProgress =
    activeSpokenPosition < 0 || !spokenTokens.length
      ? 0
      : ((activeSpokenPosition + 1) * 100) / spokenTokens.length;
  const playerSpokenPosition =
    activeSpokenPosition >= 0
      ? activeSpokenPosition
      : Math.max(
          0,
          spokenTokens.findIndex((token) => token.index === progress.tokenIndex),
        );
  useLayoutEffect(() => {
    const element = readerCardRef.current;
    if (!element || !(ttsActivated || tts.speaking || tts.paused)) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setPlayerBounds({ left: rect.left, width: rect.width });
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [tts.paused, tts.speaking, ttsActivated]);
  useEffect(() => {
    if (tts.activeTokenIndex === undefined || languageChapter?.mode !== "prepared")
      return;
    const block = preparedBlocks.findIndex(
      (value) =>
        value.startTokenIndex <= tts.activeTokenIndex! &&
        value.endTokenIndex >= tts.activeTokenIndex!,
    );
    if (block >= visibleBlocks) setVisibleBlocks(block + 1);
  }, [languageChapter?.mode, preparedBlocks, tts.activeTokenIndex, visibleBlocks]);
  useEffect(() => {
    if (tts.activeTokenIndex === undefined) return;
    readAlongDebug("reader active token", {
      activeTokenIndex: tts.activeTokenIndex,
      activeSentenceId: tts.activeSentenceId,
      renderedTokenId: `reader-token-${tts.activeTokenIndex}`,
    });
  }, [tts.activeSentenceId, tts.activeTokenIndex]);
  useEffect(() => {
    if (tts.activeTokenIndex !== undefined)
      updateProgress({
        tokenIndex: tts.activeTokenIndex,
        activeSentenceId: tts.activeSentenceId,
      });
  }, [tts.activeSentenceId, tts.activeTokenIndex, updateProgress]);
  useEffect(() => {
    if (
      !tts.speaking ||
      !tts.synchronizationSupported ||
      !tts.followEnabled ||
      tts.activeTokenIndex === undefined
    )
      return;
    const element = document.getElementById(
      `reader-token-${tts.activeTokenIndex}`,
    );
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const low = window.innerHeight * 0.22;
    const high = window.innerHeight * 0.78;
    if (rect.top < low || rect.bottom > high)
      scrollToToken(tts.activeTokenIndex);
  }, [
    scrollToToken,
    tts.activeTokenIndex,
    tts.followEnabled,
    tts.speaking,
    tts.synchronizationSupported,
  ]);
  useEffect(() => {
    if (tts.speaking && userHasScrolled && tts.followEnabled)
      tts.setFollowEnabled(false);
  }, [tts, userHasScrolled]);
  useEffect(() => {
    localStorage.setItem("reader-font-size", String(fontSize));
    localStorage.setItem("reader-line-height", String(lineHeight));
    localStorage.setItem("reader-font", fontClass);
  }, [fontSize, lineHeight, fontClass]);
  useEffect(() => {
    if (!currentChapter) return;
    let active = true;
    setSelection(null);
    setDefinition(null);
    setTranslationMessage(null);
    setVisibleBlocks(INITIAL_RENDER_BLOCKS);
    latestTap.current.next();
    resetUserScroll();
    if (book.languageProcessingStatus !== "COMPLETED") {
      setLanguageChapter({ mode: "unavailable", reason: "NOT_PREPARED" });
      return () => {
        active = false;
      };
    }
    setLanguageChapter(null);
    void readerLanguageData
      .loadChapter(book.id, currentChapter.id, currentChapter.content)
      .then((value) => {
        if (active) setLanguageChapter(value);
      })
      .catch(() => {
        if (active)
          setLanguageChapter({ mode: "unavailable", reason: "MISSING_DATA" });
      });
    return () => {
      active = false;
    };
  }, [
    book.id,
    book.languageProcessingStatus,
    currentChapter?.id,
    currentChapter?.content,
    resetUserScroll,
  ]);
  useEffect(() => {
    if (
      !currentChapter ||
      !languageChapter ||
      resumedChapter.current ===
        `${currentChapter.id}:${chapterHash || "legacy"}`
    )
      return;
    const target = resumeTarget(
      initialProgress,
      currentChapter.id,
      chapterHash,
    );
    if (target.kind === "token" && languageChapter.mode === "prepared") {
      const block = preparedBlocks.findIndex(
        (value) =>
          value.startTokenIndex <= target.tokenIndex &&
          value.endTokenIndex >= target.tokenIndex,
      );
      if (block >= visibleBlocks) {
        setVisibleBlocks(block + 1);
        return;
      }
      requestAnimationFrame(() => {
        scrollToToken(target.tokenIndex, "auto");
        resumedChapter.current = `${currentChapter.id}:${chapterHash || "legacy"}`;
      });
    } else if (target.kind === "percent")
      requestAnimationFrame(() => {
        const article = articleRef.current;
        if (article)
          window.scrollTo({
            top:
              article.getBoundingClientRect().top +
              window.scrollY +
              (article.offsetHeight * target.percent) / 100,
            behavior: "auto",
          });
        resumedChapter.current = `${currentChapter.id}:${chapterHash || "legacy"}`;
      });
    else
      resumedChapter.current = `${currentChapter.id}:${chapterHash || "legacy"}`;
  }, [
    currentChapter,
    languageChapter,
    chapterHash,
    initialProgress,
    preparedBlocks,
    visibleBlocks,
    scrollToToken,
  ]);
  useEffect(() => {
    const onScroll = () => {
      if (scrollFrame.current) return;
      scrollFrame.current = requestAnimationFrame(() => {
        scrollFrame.current = undefined;
        const article = articleRef.current;
        if (!article || !currentChapter) return;
        const top = Math.max(
          0,
          window.scrollY -
            (article.getBoundingClientRect().top + window.scrollY),
        );
        const percent = calculateScrollPercent(
          top,
          article.offsetHeight,
          window.innerHeight,
        );
        const blocks =
          article.querySelectorAll<HTMLElement>("[data-token-start]");
        let activeBlock = blocks[0];
        for (const block of blocks)
          if (
            block.getBoundingClientRect().bottom >
            window.innerHeight * 0.35
          ) {
            activeBlock = block;
            break;
          }
        updateProgress({
          tokenIndex: Number(
            activeBlock?.dataset.tokenStart || progress.tokenIndex,
          ),
          scrollPercent: percent,
          activeSentenceId: activeBlock?.dataset.sentenceId,
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
    };
  }, [currentChapter?.id, progress.tokenIndex, updateProgress]);
  const closeReadAlong = useCallback(() => {
    readAlongDebug("close player");
    tts.stop();
    setTtsActivated(false);
    setTtsMessage(null);
  }, [tts.stop]);
  useNativeBackHandler(() => {
    if (selection) {
      latestTap.current.next();
      setSelection(null);
      setDefinition(null);
      setTranslationMessage(null);
      return true;
    }
    if (showPreferences) {
      setShowPreferences(false);
      return true;
    }
    if (ttsActivated) {
      closeReadAlong();
      return true;
    }
    return false;
  }, 300);
  if (!chapters.length || !currentChapter)
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6">
        <h2 className="mb-4 text-xl font-bold">Content Unavailable</h2>
        <button onClick={onBack}>Go Back</button>
      </div>
    );
  const isSaved = (word: string, normalized?: string | null) =>
    savedWords.some(
      (entry) =>
        (entry.normalizedWord || entry.word.toLowerCase()) ===
          (normalized || word.toLowerCase()) &&
        entry.sourceBookId === book.id &&
        entry.sourceChapterId === currentChapter.id,
    );
  const closePopup = () => {
    latestTap.current.next();
    setSelection(null);
    setDefinition(null);
    setTranslationMessage(null);
  };
  const selectWord = async (
    token: PreparedReaderToken,
    event: React.MouseEvent,
  ) => {
    if (tts.speaking || tts.paused) tts.stop();
    const request = latestTap.current.next();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = Math.max(
      16,
      Math.min(
        rect.left + rect.width / 2 - 160,
        Math.max(16, window.innerWidth - 336),
      ),
    );
    const y = Math.max(16, rect.bottom + 12);
    setSelection({
      word: token.text,
      tokenIndex: token.index,
      normalizedWord: token.normalized || undefined,
      context: "",
      x,
      y,
    });
    setDefinition(null);
    setTranslationMessage(null);
    setLoadingTranslation(true);
    updateProgress({
      tokenIndex: token.index,
      activeSentenceId: token.sentenceId,
    });
    try {
      if (languageChapter?.mode !== "prepared") {
        if (latestTap.current.isLatest(request))
          setTranslationMessage("Bu kitap için çeviri henüz hazırlanmadı.");
        return;
      }
      const resolved = await readerLanguageData.resolve(
        book.id,
        currentChapter.id,
        currentChapter.content,
        token.index,
      );
      if (!latestTap.current.isLatest(request)) return;
      if (resolved.state !== "ready" || !resolved.dictionary) {
        setTranslationMessage("Hazırlanmış çeviri verisi kullanılamıyor.");
        return;
      }
      setSelection((previous) =>
        previous?.tokenIndex === token.index
          ? {
              ...previous,
              context: resolved.sentence?.sourceText || "",
              translatedContext: resolved.sentence?.translatedText,
            }
          : previous,
      );
      setDefinition({
        meanings: [
          {
            partOfSpeech: resolved.dictionary.type || "Kelime",
            translation: resolved.dictionary.translation,
            definition:
              resolved.dictionary.definition || "Hazırlanmış sözlük çevirisi",
            example: resolved.sentence?.sourceText || "",
            translatedExample: resolved.sentence?.translatedText || "",
          },
        ],
      });
    } catch {
      if (latestTap.current.isLatest(request))
        setTranslationMessage("Çeviri verisi yüklenemedi.");
    } finally {
      if (latestTap.current.isLatest(request)) setLoadingTranslation(false);
    }
  };
  const saveWord = () => {
    if (!selection || !definition) return;
    const token: PreparedReaderToken = {
      index: selection.tokenIndex,
      text: selection.word,
      normalized: selection.normalizedWord || null,
      start: 0,
      end: selection.word.length,
      sentenceId: progress.activeSentenceId || "",
      isWord: true,
    };
    onSaveWord(
      vocabularyFromPreparedToken(
        book,
        currentChapter.id,
        token,
        {
          id: "",
          word: token.text,
          normalizedWord: token.normalized || token.text.toLowerCase(),
          translation: definition.meanings[0].translation,
          definition: definition.meanings[0].definition,
          type: definition.meanings[0].partOfSpeech,
        },
        selection.context
          ? {
              id: token.sentenceId,
              sourceText: selection.context,
              translatedText: selection.translatedContext || "",
              sourceHash: "",
              chapterContentHash: chapterHash || "",
              processingVersion: "",
            }
          : undefined,
      ),
    );
    closePopup();
  };
  const changeChapter = (next: number) => {
    if (next < 0 || next >= chapters.length) return;
    closeReadAlong();
    flushProgress();
    resumedChapter.current = undefined;
    closePopup();
    setChapterIndex(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const finishOrNext = () => {
    onCompleteChapter(book.id, chapterIndex);
    if (isLastChapter) {
      flushProgress();
      onBack();
    } else changeChapter(chapterIndex + 1);
  };
  const openReadAlong = () => {
    if (!tts.supported) {
      setTtsMessage("Bu cihazda sesli okuma desteklenmiyor.");
      return;
    }
    setTtsMessage(
      tts.synchronizationSupported
        ? null
        : "Bu cihazda kelime takibi desteklenmiyor.",
    );
    readAlongDebug("open player", {
      supported: tts.supported,
      synchronizationSupported: tts.synchronizationSupported,
    });
    setTtsActivated(true);
  };
  const toggleTtsPlayback = () => {
    if (!tts.supported) return;
    readAlongDebug("player play/pause", {
      speaking: tts.speaking,
      paused: tts.paused,
      startToken: progress.tokenIndex,
    });
    if (tts.speaking) tts.pause();
    else if (tts.paused) tts.resume();
    else tts.startFromToken(progress.tokenIndex);
  };
  const tokenSpan = (token: PreparedReaderToken) => {
    if (!token.isWord) return <span key={token.index}>{token.text}</span>;
    const active = selection?.tokenIndex === token.index;
    const ttsVisible = ttsActivated || tts.speaking || tts.paused;
    const ttsActive =
      ttsVisible &&
      tts.synchronizationSupported &&
      tts.activeTokenIndex === token.index;
    const sentenceActive =
      ttsVisible &&
      tts.synchronizationSupported &&
      tts.activeSentenceId === token.sentenceId;
    const sentenceAnchor =
      firstTokenBySentence.get(token.sentenceId) === token.index;
    return (
      <span
        key={token.index}
        id={`reader-token-${token.index}`}
        data-sentence-id={token.sentenceId}
        data-tts-active={ttsActive || undefined}
        data-tts-sentence={sentenceActive || undefined}
        {...(sentenceAnchor
          ? { "data-sentence-anchor": token.sentenceId }
          : {})}
        onClick={(event) => void selectWord(token, event)}
        role="button"
        aria-label={`${token.text} çevirisini göster`}
        className={`cursor-pointer touch-manipulation select-none rounded-[6px] transition-colors duration-150 motion-reduce:transition-none ${sentenceActive ? "bg-brand-500/[0.07] dark:bg-brand-400/[0.08]" : ""} ${ttsActive ? "bg-brand-500/25 text-brand-900 shadow-[0_1px_5px_rgba(124,77,255,0.15)] ring-1 ring-brand-500/20 dark:bg-brand-400/25 dark:text-brand-100" : ""} ${isSaved(token.text, token.normalized) ? "bg-yellow-100 underline decoration-2" : progress.tokenIndex === token.index ? "text-red-600 underline decoration-2" : "hover:bg-brand-50 hover:text-brand-600"} ${active ? "bg-brand-700 text-white shadow-lg" : ""}`}
      >
        {token.text}
      </span>
    );
  };
  return (
    <div
      className="relative min-h-screen bg-[#fdfdfd] pb-[calc(6rem+env(safe-area-inset-bottom))] dark:bg-gray-950"
    >
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white/90 px-4 py-[calc(1rem+env(safe-area-inset-top))] backdrop-blur dark:bg-gray-900/90">
        <button
          aria-label="Bölümlere dön"
            onClick={() => {
              closeReadAlong();
            flushProgress();
            onBack();
          }}
          className="flex items-center font-bold"
        >
          <ArrowLeft className="mr-2" size={20} />
          Bölümler
        </button>
        <div className="flex items-center gap-2">
          <button
            aria-label="Sesli okumayı başlat"
            onClick={openReadAlong}
            disabled={!tts.supported}
            className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            Sesli Oku
          </button>
          <span className="hidden text-xs sm:inline">
            {Math.round(progress.scrollPercent)}%
          </span>
          <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            <button
              aria-label="Metni küçült"
              onClick={() => setFontSize((value) => Math.max(14, value - 2))}
              className="p-2"
            >
              <ZoomOut size={16} />
            </button>
            <span className="px-2 py-2 text-[10px]">{fontSize}px</span>
            <button
              aria-label="Metni büyüt"
              onClick={() => setFontSize((value) => Math.min(32, value + 2))}
              className="p-2"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <button
            aria-label="Okuma tercihleri"
            onClick={() => setShowPreferences((value) => !value)}
            className="rounded-xl bg-gray-100 p-2 dark:bg-gray-800"
          >
            <Type size={20} />
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
        {showPreferences && (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-3 rounded-2xl border bg-white p-3 shadow-xl dark:bg-gray-900">
            <span className="text-xs font-bold">Satır aralığı</span>
            <select
              aria-label="Satır aralığı"
              value={lineHeight}
              onChange={(event) => setLineHeight(Number(event.target.value))}
              className="rounded border p-1"
            >
              <option value={1.5}>Dar</option>
              <option value={1.75}>Normal</option>
              <option value={2}>Geniş</option>
            </select>
            {FONTS.map((font) => (
              <button
                key={font.name}
                onClick={() => setFontClass(font.class)}
                className={`rounded px-3 py-1 text-xs font-bold ${fontClass === font.class ? "bg-brand-600 text-white" : ""}`}
              >
                {font.name}
              </button>
            ))}
          </div>
        )}
        <div ref={readerCardRef} data-reader-chapter-card="true" className={`rounded-[2rem] border bg-white p-6 shadow-sm dark:bg-gray-900 md:p-16 ${(ttsActivated || tts.speaking || tts.paused) ? "pb-64 md:pb-60" : ""}`}>
          <header className="mb-10 border-b pb-7 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-600">
              Chapter {chapterIndex + 1}
            </p>
            <h1
              className={`mb-2 text-3xl font-black dark:text-white ${fontClass}`}
            >
              {currentChapter.title}
            </h1>
            <p className="text-xs font-black uppercase tracking-[.25em] text-gray-400">
              {book.title}
            </p>
          </header>
          <article
            ref={articleRef}
            className={`leading-relaxed text-gray-800 dark:text-gray-200 ${fontClass}`}
            style={{ fontSize, lineHeight }}
          >
            {languageChapter?.mode === "prepared" ? (
              <>
                {preparedBlocks.slice(0, visibleBlocks).map((block) => (
                  <p
                    key={block.id}
                    data-token-start={block.startTokenIndex}
                    data-token-end={block.endTokenIndex}
                    data-sentence-id={block.sentenceId}
                    className="mb-8 whitespace-pre-wrap text-justify"
                  >
                    {block.tokens.map(tokenSpan)}
                  </p>
                ))}
                {visibleBlocks < preparedBlocks.length && (
                  <button
                    onClick={() =>
                      setVisibleBlocks(
                        (value) => value + RENDER_BLOCK_INCREMENT,
                      )
                    }
                    className="my-6 w-full rounded-xl border border-brand-200 p-3 text-sm font-bold text-brand-600"
                  >
                    Devamını yükle
                  </button>
                )}
              </>
            ) : (
              legacyBlocks.map((block, blockIndex) => (
                <p
                  key={blockIndex}
                  data-token-start={
                    block.find((token) => token.isWord)?.index ?? 0
                  }
                  data-sentence-id={
                    block.find((token) => token.isWord)?.sentenceId
                  }
                  className="mb-8 whitespace-pre-wrap text-justify"
                >
                  {block.map(tokenSpan)}
                </p>
              ))
            )}
          </article>
          <footer className="mt-16 flex items-center justify-between border-t pt-8">
            <button
              aria-label="Önceki bölüm"
              disabled={chapterIndex === 0}
              onClick={() => changeChapter(chapterIndex - 1)}
              className="rounded-xl p-3 font-bold disabled:opacity-30"
            >
              <ChevronLeft className="mr-1 inline" size={18} />
              Önceki
            </button>
            <button
              onClick={finishOrNext}
              className="flex items-center rounded-2xl bg-gray-900 px-6 py-4 font-black text-white dark:bg-brand-600"
            >
              {isLastChapter ? (
                <>
                  <CheckCircle className="mr-2" />
                  Kitabı Bitir
                </>
              ) : (
                <>
                  Sonraki Bölüm
                  <ArrowRight className="ml-2" />
                </>
              )}
            </button>
          </footer>
          {(ttsActivated || tts.speaking || tts.paused) && (
            <ReadAlongPlayer
              speaking={tts.speaking}
              paused={tts.paused}
              rate={tts.rate}
              progressPercent={ttsProgress}
              bounds={playerBounds}
              canMovePrevious={playerSpokenPosition > 0}
              canMoveNext={playerSpokenPosition >= 0 && playerSpokenPosition < spokenTokens.length - 1}
              onPlayPause={toggleTtsPlayback}
              onBackThreeWords={() => tts.moveByWords(-3)}
              onForwardThreeWords={() => tts.moveByWords(3)}
              onRateChange={tts.setRate}
              onClose={closeReadAlong}
            />
          )}
        </div>
      </div>
      {selection && (
        <>
          <div className="fixed inset-0 z-40 bg-black/5" onClick={closePopup} />
          <div
            className="fixed z-50 max-h-[calc(100dvh-2rem)] w-[min(320px,calc(100vw-2rem))] overflow-y-auto rounded-[2rem] border bg-white shadow-2xl dark:bg-gray-800"
            style={{
              top: Math.max(
                16,
                Math.min(selection.y, window.innerHeight - 360),
              ),
              left: selection.x,
            }}
          >
            <div className="p-6">
              <header className="mb-2 flex justify-between">
                <div>
                  <h3 className="text-2xl font-black dark:text-white">
                    {selection.word}
                  </h3>
                  <span className="text-[10px] font-black uppercase text-gray-400">
                    İngilizce
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    aria-label="Kelimeyi telaffuz et"
                    onClick={() => {
                      const utterance = new SpeechSynthesisUtterance(
                        selection.word,
                      );
                      utterance.lang = "en-US";
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="rounded-full bg-brand-50 p-2.5 text-brand-600"
                  >
                    <Volume2 size={20} />
                  </button>
                  <button
                    aria-label="Çeviriyi kapat"
                    onClick={closePopup}
                    className="rounded-full p-2.5 text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>
              </header>
              {loadingTranslation ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto animate-spin text-brand-500" />
                </div>
              ) : translationMessage ? (
                <p className="py-8 text-center text-sm font-bold text-gray-500">
                  {translationMessage}
                </p>
              ) : (
                definition && (
                  <div className="space-y-4">
                    <span className="rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-black uppercase text-brand-600">
                      {definition.meanings[0].partOfSpeech}
                    </span>
                    <p className="text-3xl font-bold text-brand-600">
                      {definition.meanings[0].translation}
                    </p>
                    <div className="rounded-xl border bg-gray-50 p-3 text-sm dark:bg-gray-900">
                      <p className="italic">
                        “{definition.meanings[0].example}”
                      </p>
                      {definition.meanings[0].translatedExample && (
                        <p className="mt-2 border-t pt-2 text-brand-600">
                          {definition.meanings[0].translatedExample}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={saveWord}
                      className={`w-full rounded-xl py-4 font-black ${isSaved(selection.word, selection.normalizedWord) ? "bg-green-50 text-green-600" : "bg-brand-600 text-white"}`}
                    >
                      {isSaved(selection.word, selection.normalizedWord) ? (
                        "Kaydedildi"
                      ) : (
                        <>
                          <Star className="mr-2 inline" size={18} />
                          Deftere Ekle
                        </>
                      )}
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}
      {tts.speaking &&
        tts.synchronizationSupported &&
        !tts.followEnabled &&
        tts.activeTokenIndex !== undefined && (
          <button
            aria-label="Takibe dön"
            onClick={() => {
              tts.setFollowEnabled(true);
              scrollToToken(tts.activeTokenIndex!);
            }}
            className="fixed bottom-24 right-4 z-40 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-lg sm:right-8"
          >
            Takibe dön
          </button>
        )}
      {ttsMessage && (
        <p
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {ttsMessage}
        </p>
      )}
      <span
        className="sr-only"
        data-reader-active-token={progress.tokenIndex}
        data-reader-active-sentence={progress.activeSentenceId || ""}
        data-reader-user-scrolled={userHasScrolled}
        onClick={() => scrollToSentence(progress.activeSentenceId || "")}
      />
    </div>
  );
};
export default BookReaderV2;
