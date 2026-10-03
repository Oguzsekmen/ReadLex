import React from 'react';
import { Pause, Play, Repeat2, SkipBack, SkipForward } from 'lucide-react';

type Props = {
  speaking: boolean;
  paused: boolean;
  rate: number;
  progressPercent: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  canRepeat: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRateChange: (rate: number) => void;
};

export const ReadAlongPlayer: React.FC<Props> = ({ speaking, paused, rate, progressPercent, canMovePrevious, canMoveNext, canRepeat, onPlayPause, onPrevious, onNext, onRepeat, onRateChange }) => (
  <aside aria-label="Sesli okuma oynatıcısı" className="fixed inset-x-0 bottom-0 z-40 pl-[max(.75rem,var(--safe-left))] pr-[max(.75rem,var(--safe-right))] pb-[calc(.75rem+var(--safe-bottom))]">
    <div className="mx-auto max-w-3xl rounded-2xl border border-brand-200 bg-white/95 p-3 shadow-2xl backdrop-blur dark:border-brand-800 dark:bg-gray-900/95">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-gray-600 dark:text-gray-300"><span>Sesli okuma</span><span>{Math.round(progressPercent)}%</span></div>
      <div aria-label="Okuma ilerlemesi" className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-full rounded-full bg-brand-600 transition-[width] duration-200" style={{ width: `${progressPercent}%` }} /></div>
      <div className="flex items-center justify-between gap-1">
        <button aria-label="Önceki cümle" title="Önceki cümle" disabled={!canMovePrevious} onClick={onPrevious} className="rounded-xl p-3 text-gray-600 disabled:opacity-30 dark:text-gray-300"><SkipBack size={20} /></button>
        <button aria-label={speaking ? 'Duraklat' : 'Sesli okumayı başlat'} onClick={onPlayPause} className="rounded-full bg-brand-600 p-4 text-white shadow-lg"><>{speaking ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}</></button>
        <button aria-label="Sonraki cümle" title="Sonraki cümle" disabled={!canMoveNext} onClick={onNext} className="rounded-xl p-3 text-gray-600 disabled:opacity-30 dark:text-gray-300"><SkipForward size={20} /></button>
        <button aria-label="Cümleyi tekrar oku" title="Cümleyi tekrar oku" disabled={!canRepeat} onClick={onRepeat} className="rounded-xl p-3 text-gray-600 disabled:opacity-30 dark:text-gray-300"><Repeat2 size={20} /></button>
        <select aria-label="Okuma hızı" value={rate} onChange={event => onRateChange(Number(event.target.value))} className="rounded-lg border bg-transparent px-2 py-2 text-xs font-bold dark:border-gray-700">
          {[0.75, 1, 1.25, 1.5].map(value => <option key={value} value={value}>{value}x</option>)}
        </select>
      </div>
      {paused && <p className="mt-2 text-center text-xs text-gray-500">Duraklatıldı</p>}
    </div>
  </aside>
);
