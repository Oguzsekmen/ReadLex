import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgressWriteScheduler, ReaderProgressUpdate, shouldPersistProgress } from '../services/readerEngine';

export const useReaderProgress = (initial: ReaderProgressUpdate, onPersist: (update: ReaderProgressUpdate) => void) => {
  const [current, setCurrent] = useState(initial); const currentRef = useRef(initial); const persisted = useRef<ReaderProgressUpdate>(); const scheduler = useRef(new ProgressWriteScheduler()); const persistRef = useRef(onPersist);
  useEffect(() => { persistRef.current = onPersist; }, [onPersist]);
  const flush = useCallback(() => { if (shouldPersistProgress(persisted.current, currentRef.current)) { persisted.current = currentRef.current; scheduler.current.flush(persistRef.current); } }, []);
  const update = useCallback((patch: Partial<ReaderProgressUpdate>) => { const next = { ...currentRef.current, ...patch }; currentRef.current = next; setCurrent(next); if (shouldPersistProgress(persisted.current, next)) scheduler.current.schedule(next, value => { persisted.current = value; persistRef.current(value); }); }, []);
  useEffect(() => { currentRef.current = initial; persisted.current = undefined; setCurrent(initial); return () => flush(); }, [initial.chapterId, initial.chapterContentHash, flush]);
  useEffect(() => { const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); }; document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility); }, [flush]);
  return { progress: current, updateProgress: update, flushProgress: flush };
};
