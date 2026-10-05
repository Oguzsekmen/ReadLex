import React from "react";
import { AudioLines, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";

type Props = {
  speaking: boolean;
  paused: boolean;
  rate: number;
  progressPercent: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  bounds?: { left: number; width: number };
  onPlayPause: () => void;
  onBackThreeWords: () => void;
  onForwardThreeWords: () => void;
  onRateChange: (rate: number) => void;
  onClose: () => void;
};

export const ReadAlongPlayer: React.FC<Props> = ({
  speaking,
  paused,
  rate,
  progressPercent,
  canMovePrevious,
  canMoveNext,
  bounds,
  onPlayPause,
  onBackThreeWords,
  onForwardThreeWords,
  onRateChange,
  onClose,
}) => {
  const status = speaking
    ? "Metin okunuyor..."
    : paused
      ? "Okuma duraklatıldı"
      : "Okumaya hazır";
  const position = bounds
    ? {
        left: `max(var(--safe-left), ${Math.max(12, bounds.left)}px)`,
        width: `min(${bounds.width}px, calc(100vw - var(--safe-left) - var(--safe-right) - 24px))`,
      }
    : {
        left: "max(var(--safe-left), 12px)",
        right: "max(var(--safe-right), 12px)",
      };
  return (
    <aside
      aria-label="Sesli okuma oynatıcısı"
      data-reader-player="floating"
      style={position}
      className="fixed bottom-[calc(1rem+var(--safe-bottom))] z-40 rounded-[20px] border border-brand-500/20 bg-[#faf8ff]/65 p-3.5 shadow-[0_8px_28px_rgba(60,40,120,0.13)] backdrop-blur-[14px] dark:border-brand-400/20 dark:bg-gray-950/65 sm:p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-700 dark:text-brand-300 ${speaking ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true">
            <AudioLines size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 dark:text-white">Sesli okuma</p>
            <p aria-live="polite" className="truncate text-xs font-medium text-gray-600 dark:text-gray-300">{status}</p>
          </div>
        </div>
        <span className="text-xs font-black tabular-nums text-brand-700 dark:text-brand-300">{Math.round(progressPercent)}%</span>
      </div>
      <div aria-label="Metin okuma ilerlemesi" className="mb-3 h-1.5 overflow-hidden rounded-full bg-brand-200/70 dark:bg-brand-950/80">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="grid grid-cols-[44px_44px_minmax(56px,1fr)_44px_52px] items-center justify-items-center gap-1 sm:grid-cols-[48px_48px_minmax(60px,1fr)_48px_56px] sm:gap-2">
        <button aria-label="Sesli okumayı kapat" title="Sesli okumayı kapat" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 transition-colors hover:bg-brand-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-gray-200"><X size={19} /></button>
        <button aria-label="3 kelime geri git" title="3 kelime geri git" disabled={!canMovePrevious} onClick={onBackThreeWords} className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 transition-colors hover:bg-brand-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-200"><RotateCcw size={20} /><span className="sr-only">3</span></button>
        <button aria-label={speaking ? "Sesli okumayı duraklat" : "Sesli okumayı başlat"} title={speaking ? "Sesli okumayı duraklat" : "Sesli okumayı başlat"} onClick={onPlayPause} className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-500/30 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{speaking ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}</button>
        <button aria-label="3 kelime ileri git" title="3 kelime ileri git" disabled={!canMoveNext} onClick={onForwardThreeWords} className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 transition-colors hover:bg-brand-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-200"><RotateCw size={20} /><span className="sr-only">3</span></button>
        <label className="flex h-11 min-w-[44px] items-center justify-center rounded-xl text-xs font-black text-gray-700 hover:bg-brand-500/10 dark:text-gray-200"><span className="sr-only">Okuma hızını değiştir</span><select aria-label="Okuma hızını değiştir" value={rate} onChange={(event) => onRateChange(Number(event.target.value))} className="w-full cursor-pointer appearance-none bg-transparent text-center outline-none">{[0.75, 1, 1.25, 1.5].map((value) => <option key={value} value={value}>{value}x</option>)}</select></label>
      </div>
    </aside>
  );
};
