// Fixed: Added React to imports to resolve namespace errors
import React, { useState, useRef, useEffect } from 'react';
import { Book, VocabularyWord } from '../types';
import { getWordDefinition, prefetchBookContent, translatePos } from '../services/geminiService';
import { ArrowLeft, Loader2, Star, Volume2, X, CheckCircle, ZoomIn, ZoomOut, Type } from 'lucide-react';

interface BookReaderProps {
  book: Book;
  onBack: () => void;
  onSaveWord: (word: VocabularyWord) => void;
  savedWords: VocabularyWord[];
  onCompleteBook: (bookId: string) => void;
}

interface SelectionState {
  word: string;
  context: string;
  x: number;
  y: number;
}

const FONTS = [
  { name: 'Sans', class: 'font-sans' },
  { name: 'Serif', class: 'font-serif' },
  { name: 'Mono', class: 'font-mono' },
];

const BookReader: React.FC<BookReaderProps> = ({ book, onBack, onSaveWord, savedWords, onCompleteBook }) => {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [definition, setDefinition] = useState<any>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const [fontSize, setFontSize] = useState(19);
  const [currentFont, setCurrentFont] = useState(FONTS[0].class);
  const [showFontMenu, setShowFontMenu] = useState(false);

  useEffect(() => {
    prefetchBookContent(book.content);
  }, [book.id]);

  const tokenizeText = (text: string) => {
    return text.match(/([\w’']+)|([^\w\s]+)|(\s+)/g) || [];
  };

  const handleWordClick = async (word: string, event: React.MouseEvent) => {
    if (!/\w/.test(word)) return;

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = Math.max(16, Math.min(rect.left + rect.width/2 - 160, window.innerWidth - 336)); 
    const y = rect.bottom + window.scrollY + 12;

    const fullSentence = getSentenceContext(book.content, word);

    setSelection({ word, context: fullSentence, x, y });
    setDefinition(null);
    setIsLoadingDef(true);

    try {
        const def = await getWordDefinition(word, fullSentence);
        setDefinition(def);
    } catch (err) {
        console.error("Dictionary Fetch Failed:", err);
    } finally {
        setIsLoadingDef(false);
    }
  };

  const getSentenceContext = (text: string, word: string) => {
    const index = text.indexOf(word);
    if (index === -1) return "";
    const start = Math.max(0, text.lastIndexOf('.', index) + 1);
    let end = text.indexOf('.', index);
    if (end === -1) end = text.length;
    return text.slice(start, end + 1).trim();
  };

  const handleSave = () => {
    if (!definition || !selection) return;
    
    const newWord: VocabularyWord = {
      id: Date.now().toString(),
      word: selection.word,
      translation: definition.meanings[0].translation,
      definition: definition.meanings[0].definition,
      exampleSentence: selection.context,
      type: definition.meanings[0].partOfSpeech, // Already translated in service
      level: book.level,
      sourceBookId: book.id,
      nextReviewDate: new Date(),
      strength: 0
    };
    
    onSaveWord(newWord);
    setSelection(null); 
  };

  const isSaved = (word: string) => {
    const norm = word.toLowerCase().trim();
    return savedWords.some(w => w.word.toLowerCase().trim() === norm);
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const paragraphs = book.content.split('\n').filter(p => p.trim() !== '');

  return (
    <div className="relative min-h-screen bg-[#fdfdfd] dark:bg-gray-950 pb-24">
      {/* Reader Controls */}
      <div className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-30">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-brand-600 dark:text-gray-300 font-bold transition-all">
          <ArrowLeft className="mr-2" size={20} />
          <span>Geri Dön</span>
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
          <header className="mb-12 text-center">
             <h1 className={`text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 ${currentFont}`}>{book.title}</h1>
             <p className="text-gray-400 text-xs font-black uppercase tracking-[0.3em]">{book.author}</p>
          </header>

          <article 
            ref={textRef} 
            className={`leading-relaxed text-gray-800 dark:text-gray-200 ${currentFont} transition-all duration-300`}
            style={{ fontSize: `${fontSize}px` }}
          >
            {paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="mb-10 text-justify">
                {tokenizeText(paragraph).map((token, index) => {
                  const isWord = /\w/.test(token);
                  const saved = isWord && isSaved(token);
                  const active = selection?.word === token;
                  
                  return isWord ? (
                    <span
                      key={index}
                      onClick={(e) => handleWordClick(token, e)}
                      className={`cursor-pointer transition-all rounded-md px-0.5 inline-block
                        ${saved 
                          ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 decoration-yellow-400/50 underline decoration-2 underline-offset-4' 
                          : 'hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600'
                        }
                        ${active ? 'bg-brand-600 text-white scale-110 shadow-lg px-2 rounded-lg' : ''}
                      `}
                    >
                      {token}
                    </span>
                  ) : (
                    <span key={index}>{token}</span>
                  );
                })}
              </p>
            ))}
          </article>

          <footer className="mt-20 pt-16 border-t border-gray-50 dark:border-gray-800 text-center">
             <button
               onClick={() => { onCompleteBook(book.id); onBack(); }}
               className="px-14 py-6 bg-gray-900 dark:bg-brand-600 text-white rounded-[2rem] font-black text-xl hover:scale-105 transition-all shadow-2xl active:scale-95"
             >
               Kitabı Bitirdim
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
              top: Math.min(selection.y, window.innerHeight - 340),
              left: selection.x
            }}
          >
            <div className="p-7">
              <header className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white capitalize truncate pr-2">{selection.word}</h3>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => playAudio(selection.word)} className="p-2.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all"><Volume2 size={22} /></button>
                  <button onClick={() => setSelection(null)} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><X size={22} /></button>
                </div>
              </header>

              {isLoadingDef ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-brand-500 mb-5" size={40} strokeWidth={3} />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Analiz Ediliyor...</p>
                </div>
              ) : (
                definition && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
                    {definition.meanings.map((meaning: any, i: number) => (
                      <div key={i} className="group">
                        <div className="flex flex-col gap-1 mb-2">
                          <span className="text-[10px] font-black uppercase text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-2.5 py-1 rounded-lg self-start">
                            {translatePos(meaning.partOfSpeech)}
                          </span>
                          <span className="font-bold text-2xl text-gray-900 dark:text-white leading-tight">
                            {meaning.translation}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mt-3">
                          {meaning.definition}
                        </p>
                      </div>
                    ))}
                    
                    <button 
                      onClick={handleSave}
                      className={`w-full mt-6 py-5 rounded-2xl font-black text-base transition-all
                        ${isSaved(selection.word) 
                          ? 'bg-green-50 text-green-600 shadow-inner' 
                          : 'bg-brand-600 text-white hover:bg-brand-700 shadow-xl shadow-brand-500/20 active:scale-95'}`}
                    >
                      {isSaved(selection.word) ? (
                        <span className="flex items-center justify-center gap-2"><CheckCircle size={20} /> Kaydedildi</span>
                      ) : (
                        <span className="flex items-center justify-center gap-2"><Star size={20} /> Deftere Ekle</span>
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
