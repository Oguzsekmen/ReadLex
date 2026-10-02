import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

export const useReaderScroll = (articleRef: RefObject<HTMLElement>) => {
  const programmaticUntil = useRef(0); const [userHasScrolled, setUserHasScrolled] = useState(false);
  const markProgrammatic = () => { programmaticUntil.current = Date.now() + 700; };
  const scrollToId = useCallback((id: string, behavior: ScrollBehavior = 'smooth') => { const element = document.getElementById(id); if (!element) return false; markProgrammatic(); element.scrollIntoView({ behavior, block: 'center', inline: 'nearest' }); return true; }, []);
  const scrollToToken = useCallback((tokenIndex: number, behavior: ScrollBehavior = 'smooth') => scrollToId(`reader-token-${tokenIndex}`, behavior), [scrollToId]);
  const scrollToSentence = useCallback((sentenceId: string, behavior: ScrollBehavior = 'smooth') => {
    const element = articleRef.current?.querySelector<HTMLElement>(`[data-sentence-anchor="${sentenceId}"]`);
    if (!element) return false; markProgrammatic(); element.scrollIntoView({ behavior, block: 'center', inline: 'nearest' }); return true;
  }, [articleRef]);
  useEffect(() => { const onScroll = () => { if (Date.now() > programmaticUntil.current) setUserHasScrolled(true); }; window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  return { scrollToToken, scrollToSentence, userHasScrolled, resetUserScroll: () => setUserHasScrolled(false), articleRef };
};
