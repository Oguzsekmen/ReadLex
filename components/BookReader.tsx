
// Fixed: Added React to imports to resolve namespace errors
import React, { useState, useRef, useEffect } from 'react';
import { Book, VocabularyWord } from '../types';
import { readerLanguageData, ReaderLanguageChapter, PreparedReaderToken, LatestTapGuard } from '../services/readerLanguageData';
import { vocabularyFromPreparedToken } from '../services/readerVocabulary';
import { ArrowLeft, Loader2, Star, Volume2, X, CheckCircle, ZoomIn, ZoomOut, Type, ArrowRight, BookOpen } from 'lucide-react';

interface BookReaderProps {
  book: Book;
  initialChapterIndex: number;
  initialWordIndex?: number; // New Prop for auto-scroll
  onBack: () => void;
  onSaveWord: (word: VocabularyWord) => void;
  savedWords: VocabularyWord[];
  onCompleteChapter: (bookId: string, chapterIndex: number) => void;
  onUpdateProgress: (bookId: string, chapterIndex: number, wordIndex: number) => void; // New callback
}

interface SelectionState {
  word: string;
  context: string;
  translatedContext?: string;
  normalizedWord?: string;
  tokenIndex: number;
  x: number;
  y: number;
}

const FONTS = [
  { name: 'Sans', class: 'font-sans' },
  { name: 'Serif', class: 'font-serif' },
  { name: 'Mono', class: 'font-mono' },
];

const BookReader: React.FC<BookReaderProps> = ({ 
  book, 
  initialChapterIndex, 
  initialWordIndex = 0,
  onBack, 
  onSaveWord, 
  savedWords, 
  onCompleteChapter,
  onUpdateProgress
}) => {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(initialChapterIndex);
  const [lastReadWordIndex, setLastReadWordIndex] = useState(initialWordIndex);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [definition, setDefinition] = useState<any>(null);
  const [translationMessage, setTranslationMessage] = useState<string | null>(null);
  const [languageChapter, setLanguageChapter] = useState<ReaderLanguageChapter | null>(null);
  const latestTapRequest = useRef(new LatestTapGuard());
  const textRef = useRef<HTMLDivElement>(null);

  const [fontSize, setFontSize] = useState(19);
  const [currentFont, setCurrentFont] = useState(FONTS[0].class);
  const [showFontMenu, setShowFontMenu] = useState(false);

  // Safely access chapters with fallback
  const chapters = book.chapters || [];
  
  // Early return if no chapters exist
  if (chapters.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-gray-950 p-6">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Content Unavailable</h2>
            <p className="mb-6 text-gray-500">This book has no chapters content.</p>
            <button onClick={onBack} className="px-4 py-2 bg-brand-600 text-white rounded-lg">Go Back</button>
        </div>
    );
  }

  const currentChapter = chapters[currentChapterIndex] || chapters[0];
  const isLastChapter = currentChapterIndex === chapters.length - 1;

  useEffect(() => {
    // Reset word index when chapter changes, unless it's the initial load
    if (currentChapterIndex !== initialChapterIndex) {
       setLastReadWordIndex(0);
       window.scrollTo(0, 0);
    } else {
       // Initial load auto-scroll
       if (initialWordIndex > 0) {
          setTimeout(() => {
             const el = document.getElementById(`word-${initialWordIndex}`);
             if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
          }, 500); // Small delay to ensure rendering
       }
    }

  }, [currentChapterIndex, book.id]);

  useEffect(() => {
    let active = true;
    if (book.languageProcessingStatus !== 'COMPLETED') {
      setLanguageChapter({ mode: 'unavailable', reason: 'NOT_PREPARED' });
      return () => { active = false; };
    }
    setLanguageChapter(null);
    void readerLanguageData.loadChapter(book.id, currentChapter.id, currentChapter.content)
      .then(result => { if (active) setLanguageChapter(result); })
      .catch(() => { if (active) setLanguageChapter({ mode: 'unavailable', reason: 'MISSING_DATA' }); });
    return () => { active = false; };
  }, [book.id, book.languageProcessingStatus, currentChapter.id, currentChapter.content]);

  const tokenizeText = (text: string) => {
    return text.match(/([\w’']+)|([^\w\s]+)|(\s+)/g) || [];
  };

  const handleWordClick = async (word: string, globalIndex: number, event: React.MouseEvent, preparedToken?: PreparedReaderToken) => {
    if (!/\w/.test(word)) return;

    // Logic: Update last read word only if we are moving forward
    if (globalIndex > lastReadWordIndex) {
        setLastReadWordIndex(globalIndex);
        onUpdateProgress(book.id, currentChapterIndex, globalIndex);
    }

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = Math.max(16, Math.min(rect.left + rect.width/2 - 160, window.innerWidth - 336)); 
    const y = rect.bottom + window.scrollY + 12;

    const requestId = latestTapRequest.current.next();
    setSelection({ word, context: '', normalizedWord: preparedToken?.normalized || undefined, tokenIndex: globalIndex, x, y });
    setDefinition(null);
    setTranslationMessage(null);
    setIsLoadingDef(true);

    try {
        if (!preparedToken || languageChapter?.mode !== 'prepared') {
          if (latestTapRequest.current.isLatest(requestId)) setTranslationMessage('Bu kitap için çeviri henüz hazırlanmadı.');
          return;
        }
        const resolved = await readerLanguageData.resolve(book.id, currentChapter.id, currentChapter.content, preparedToken.index);
        if (!latestTapRequest.current.isLatest(requestId)) return;
        if (resolved.state !== 'ready') { setTranslationMessage('Hazırlanmış çeviri verisi kullanılamıyor.'); return; }
        setSelection(previous => previous && previous.tokenIndex === preparedToken.index ? { ...previous, word: resolved.token.text, normalizedWord: resolved.token.normalized || undefined, context: resolved.sentence?.sourceText || '', translatedContext: resolved.sentence?.translatedText } : previous);
        if (!resolved.dictionary) { setTranslationMessage('Bu kelime için çeviri henüz kullanılamıyor.'); return; }
        setDefinition({ word: resolved.token.text, meanings: [{ partOfSpeech: resolved.dictionary.type || 'Kelime', translation: resolved.dictionary.translation, definition: resolved.dictionary.definition || 'Hazırlanmış sözlük çevirisi', example: resolved.sentence?.sourceText || '', translatedExample: resolved.sentence?.translatedText || '' }] });
    } catch {
        if (latestTapRequest.current.isLatest(requestId)) setTranslationMessage('Çeviri verisi yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
        if (latestTapRequest.current.isLatest(requestId)) setIsLoadingDef(false);
    }
  };

  const handleSave = () => {
    if (!definition || !selection) return;
    
    const token: PreparedReaderToken = { index: selection.tokenIndex, text: selection.word, normalized: selection.normalizedWord || null, start: 0, end: selection.word.length, sentenceId: '' , isWord: true };
    const newWord: VocabularyWord = vocabularyFromPreparedToken(book, currentChapter.id, token, { id: '', word: selection.word, normalizedWord: selection.normalizedWord || selection.word.toLowerCase(), translation: definition.meanings[0].translation, definition: definition.meanings[0].definition, type: definition.meanings[0].partOfSpeech }, selection.context ? { id: '', sourceText: selection.context, translatedText: selection.translatedContext || '', sourceHash: '', chapterContentHash: '', processingVersion: '' } : undefined);
    
    onSaveWord(newWord);
    setSelection(null); 
  };

  const isSaved = (word: string, normalized?: string | null) => {
    const norm = normalized || word.toLowerCase().trim();
    return savedWords.some(w => (w.normalizedWord || w.word.toLowerCase().trim()) === norm && w.sourceBookId === book.id && w.sourceChapterId === currentChapter.id);
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleNext = () => {
    onCompleteChapter(book.id, currentChapterIndex);
    if (isLastChapter) {
        onBack(); // Go back to Chapter List (which will now show 100%)
    } else {
        setCurrentChapterIndex(prev => prev + 1);
    }
  };

  const paragraphs = (currentChapter.content || '').split('\n').filter(p => p.trim() !== '');
  let globalWordCounter = 0; // Global counter for the entire chapter

  return (
    <div className="relative min-h-screen bg-[#fdfdfd] dark:bg-gray-950 pb-24">
      {/* Reader Controls */}
      <div className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-30">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-brand-600 dark:text-gray-300 font-bold transition-all">
          <ArrowLeft className="mr-2" size={20} />
          <span>Bölümler</span>
        </button>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
             <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="p-2 text-gray-500 hover:text-brand-600"><ZoomOut size={16} /></button>
             <span className="px-2 flex items-center text-[10px] font-black text-gray-400 border-x border-gray-200 dark:border-gray-700">{fontSize}px</span>
             <button onClick={() => setFontSize(Math.min(42, fontSize + 2))} className="p-2 text-gray-500 hover:text-brand-600"><ZoomIn size={16} /></button>
          </div>
          <button 
            onClick={() => setShowFontMenu(!showFontMenu)} 
            className={`p-2 rounded-xl transition-all ${showFontMenu ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
          >
            <Type size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {showFontMenu && (
          <div className="mb-8 flex gap-3 justify-center bg-white dark:bg-gray-900 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
             {FONTS.map(f => (
               <button 
                key={f.name}
                onClick={() => { setCurrentFont(f.class); setShowFontMenu(false); }}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${currentFont === f.class ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
               >
                 {f.name}
               </button>
             ))}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 p-8 md:p-16">
          <header className="mb-12 text-center border-b border-gray-100 dark:border-gray-800 pb-8">
             <p className="text-brand-600 font-bold uppercase tracking-widest text-xs mb-2">Chapter {currentChapterIndex + 1}</p>
             <h1 className={`text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 ${currentFont}`}>{currentChapter.title}</h1>
             <p className="text-gray-400 text-xs font-black uppercase tracking-[0.3em]">{book.title}</p>
          </header>

          <article 
            ref={textRef} 
            className={`leading-relaxed text-gray-800 dark:text-gray-200 ${currentFont} transition-all duration-300 ${languageChapter?.mode === 'prepared' ? 'whitespace-pre-wrap' : ''}`}
            style={{ fontSize: `${fontSize}px` }}
          >
            {languageChapter?.mode === 'prepared' ? languageChapter.tokens.map(token => {
              const saved = token.isWord && isSaved(token.text, token.normalized); const isLastRead = token.index === lastReadWordIndex; const active = selection?.tokenIndex === token.index;
              if (!token.isWord) return <span key={token.index}>{token.text}</span>;
              return <span key={token.index} id={`word-${token.index}`} onClick={event => handleWordClick(token.text, token.index, event, token)} className={`cursor-pointer transition-all rounded-md px-0.5 inline-block ${saved ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 decoration-yellow-400/50 underline decoration-2 underline-offset-4' : isLastRead ? 'text-red-600 font-black decoration-red-200 underline decoration-2 underline-offset-4' : 'hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600'} ${active ? 'bg-brand-600 text-white scale-110 shadow-lg px-2 rounded-lg' : ''}`}>{token.text}</span>;
            }) : paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="mb-10 text-justify">
                {tokenizeText(paragraph).map((token, index) => {
                  const isWord = /\w/.test(token);
                  const saved = isWord && isSaved(token);
                  
                  let wordElement = null;
                  
                  if (isWord) {
                     const myGlobalIndex = globalWordCounter++;
                     const isLastRead = myGlobalIndex === lastReadWordIndex;
                     const active = selection?.tokenIndex === myGlobalIndex;

                     wordElement = (
                        <span
                          key={index}
                          id={`word-${myGlobalIndex}`}
                          onClick={(e) => handleWordClick(token, myGlobalIndex, e)}
                          className={`cursor-pointer transition-all rounded-md px-0.5 inline-block
                            ${saved 
                              ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 decoration-yellow-400/50 underline decoration-2 underline-offset-4' 
                              : isLastRead 
                                ? 'text-red-600 font-black decoration-red-200 underline decoration-2 underline-offset-4'
                                : 'hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600'
                            }
                            ${active ? 'bg-brand-600 text-white scale-110 shadow-lg px-2 rounded-lg' : ''}
                          `}
                        >
                          {token}
                        </span>
                     );
                  } else {
                     wordElement = <span key={index}>{token}</span>;
                  }
                  
                  return wordElement;
                })}
              </p>
            ))}
          </article>

          <footer className="mt-20 pt-16 border-t border-gray-50 dark:border-gray-800 text-center">
             <button
               onClick={handleNext}
               className="px-10 py-5 bg-gray-900 dark:bg-brand-600 text-white rounded-[2rem] font-black text-lg hover:scale-105 transition-all shadow-2xl active:scale-95 flex items-center justify-center mx-auto"
             >
               {isLastChapter ? (
                  <> <CheckCircle className="mr-3" /> Kitabı Bitir </>
               ) : (
                  <> Sonraki Bölüm <ArrowRight className="ml-3" /> </>
               )}
             </button>
          </footer>
        </div>
      </div>

      {/* Dictionary Popup */}
      {selection && (
        <>
          <div className="fixed inset-0 z-40 bg-black/5 lg:bg-transparent" onClick={() => setSelection(null)} />
          <div 
            className="fixed z-50 w-[320px] bg-white dark:bg-gray-800 rounded-[2rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ 
              top: Math.min(selection.y, window.innerHeight - 350),
              left: selection.x
            }}
          >
            <div className="p-6">
              <header className="flex justify-between items-start mb-2">
                <div>
                   <h3 className="text-2xl font-black text-gray-900 dark:text-white capitalize truncate pr-2">{selection.word}</h3>
                   <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">İngilizce</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => playAudio(selection.word)} className="p-2.5 rounded-full text-brand-600 bg-brand-50 hover:bg-brand-100 transition-all"><Volume2 size={20} /></button>
                  <button onClick={() => setSelection(null)} className="p-2.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><X size={20} /></button>
                </div>
              </header>

              {isLoadingDef ? (
                <div className="py-8 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-brand-500 mb-3" size={32} strokeWidth={3} />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Çevriliyor...</p>
                </div>
              ) : translationMessage ? (
                <div className="py-8 text-center text-sm font-bold text-gray-500">{translationMessage}</div>
              ) : (
                definition && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
                    {definition.meanings.map((meaning: any, i: number) => (
                      <div key={i} className="group">
                        <div className="mt-4 mb-4">
                           <span className="text-[10px] font-black uppercase text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-lg mb-1 inline-block">
                            {meaning.partOfSpeech || 'Kelime'}
                          </span>
                           <div className="font-bold text-3xl text-brand-600 dark:text-brand-400 leading-tight">
                            {meaning.translation}
                          </div>
                        </div>

                        {/* Örnek Cümle ve Çevirisi */}
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                           <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Örnek Cümle</p>
                           <p className="text-sm text-gray-800 dark:text-gray-200 font-medium italic leading-relaxed mb-2">
                             "{meaning.example}"
                           </p>
                           {meaning.translatedExample && (
                               <p className="text-sm text-brand-600 dark:text-brand-400 font-medium leading-relaxed border-t border-gray-200 dark:border-gray-700 pt-2">
                                 {meaning.translatedExample}
                               </p>
                           )}
                        </div>
                      </div>
                    ))}
                    
                    <button 
                      onClick={handleSave}
                      className={`w-full mt-2 py-4 rounded-xl font-black text-base transition-all
                        ${isSaved(selection.word, selection.normalizedWord)
                          ? 'bg-green-50 text-green-600 shadow-inner' 
                          : 'bg-brand-600 text-white hover:bg-brand-700 shadow-xl shadow-brand-500/20 active:scale-95'}`}
                    >
                      {isSaved(selection.word, selection.normalizedWord) ? (
                        <span className="flex items-center justify-center gap-2"><CheckCircle size={18} /> Kaydedildi</span>
                      ) : (
                        <span className="flex items-center justify-center gap-2"><Star size={18} /> Deftere Ekle</span>
                      )}
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BookReader;
