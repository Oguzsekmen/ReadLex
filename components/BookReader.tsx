import React, { useState, useRef, useEffect } from 'react';
import { Book, VocabularyWord } from '../types';
import { getWordDefinition } from '../services/geminiService';
import { ArrowLeft, Loader2, Star, Volume2, X, CheckCircle, BookOpen, ZoomIn, ZoomOut, Type } from 'lucide-react';

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

// 4 Font Options as requested
const FONTS = [
  { name: 'Modern (Sans)', class: 'font-sans' },
  { name: 'Classic (Serif)', class: 'font-serif' },
  { name: 'Typewriter (Mono)', class: 'font-mono' },
  { name: 'Playful', class: "font-['Comic_Sans_MS',_'Chalkboard_SE',_sans-serif]" },
];

const BookReader: React.FC<BookReaderProps> = ({ book, onBack, onSaveWord, savedWords, onCompleteBook }) => {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [definition, setDefinition] = useState<any>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Appearance State
  const [fontSize, setFontSize] = useState(20); // Default 20px (xl)
  const [currentFont, setCurrentFont] = useState(FONTS[0].class);
  const [showFontMenu, setShowFontMenu] = useState(false);

  // Helper to split text but keep punctuation accessible for display
  const tokenizeText = (text: string) => {
    return text.match(/([\w’']+)|([^\w\s]+)|(\s+)/g) || [];
  };

  const handleWordClick = async (word: string, event: React.MouseEvent) => {
    if (!/\w/.test(word)) return;

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 320); 
    const y = rect.bottom + window.scrollY + 10;

    const fullSentence = getSentenceContext(book.content, word);

    setSelection({ word, context: fullSentence, x, y });
    setDefinition(null);
    setIsLoadingDef(true);

    const def = await getWordDefinition(word, fullSentence);
    setDefinition(def);
    setIsLoadingDef(false);
  };

  const getSentenceContext = (text: string, word: string) => {
    const index = text.indexOf(word);
    const start = text.lastIndexOf('.', index) + 1;
    let end = text.indexOf('.', index);
    if (end === -1) end = text.length;
    return text.slice(start, end).trim();
  };

  const handleSave = () => {
    if (!definition || !selection) return;
    
    const newWord: VocabularyWord = {
      id: Date.now().toString(),
      word: definition.word,
      translation: definition.meanings[0].translation,
      definition: definition.meanings[0].definition,
      exampleSentence: definition.meanings[0].example,
      type: definition.meanings[0].partOfSpeech,
      level: book.level,
      sourceBookId: book.id,
      nextReviewDate: new Date(),
      strength: 0
    };
    
    onSaveWord(newWord);
    setSelection(null); 
  };

  const isSaved = (word: string) => {
    return savedWords.some(w => w.word.toLowerCase() === word.toLowerCase());
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Split content into paragraphs
  const paragraphs = book.content.split('\n');

  return (
    <div className="relative min-h-[90vh] bg-[#f8f5f2] dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between z-20 shadow-sm">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-brand-600 dark:text-gray-400 font-medium">
          <ArrowLeft className="mr-2" size={20} />
          <span className="hidden sm:inline">Back</span>
        </button>
        
        {/* Reader Controls */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-1.5 shadow-inner">
          {/* Zoom Out */}
          <button 
            onClick={() => setFontSize(Math.max(14, fontSize - 2))}
            className="p-2 text-gray-600 hover:bg-white hover:text-brand-600 hover:shadow-sm dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-all"
            title="Küçült"
          >
            <ZoomOut size={20} />
          </button>
          
          {/* Font Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowFontMenu(!showFontMenu)}
              className={`p-2 rounded-lg transition-all flex items-center ${showFontMenu ? 'bg-white shadow-sm text-brand-600' : 'text-gray-600 hover:bg-white hover:text-brand-600 hover:shadow-sm dark:text-gray-300 dark:hover:bg-gray-700'}`}
              title="Yazı Tipi"
            >
              <Type size={20} />
            </button>
            
            {showFontMenu && (
              <>
              <div className="fixed inset-0 z-20" onClick={() => setShowFontMenu(false)} />
              <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl p-2 w-48 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-xs font-bold text-gray-400 uppercase px-3 py-2 mb-1">Yazı Tipi Seç</div>
                {FONTS.map(f => (
                  <button
                    key={f.name}
                    onClick={() => { setCurrentFont(f.class); setShowFontMenu(false); }}
                    className={`w-full text-left px-3 py-3 rounded-lg text-sm mb-1 flex items-center justify-between ${currentFont === f.class ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-300 font-bold' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                  >
                    <span className={f.class}>{f.name}</span>
                    {currentFont === f.class && <CheckCircle size={14} />}
                  </button>
                ))}
              </div>
              </>
            )}
          </div>

          {/* Zoom In */}
          <button 
            onClick={() => setFontSize(Math.min(36, fontSize + 2))}
            className="p-2 text-gray-600 hover:bg-white hover:text-brand-600 hover:shadow-sm dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-all"
            title="Büyüt"
          >
            <ZoomIn size={20} />
          </button>
        </div>

        <div className="w-16"></div> 
      </div>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 md:p-12 relative transition-all duration-300">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-400 to-purple-500 rounded-t-3xl"></div>
          
          <div className="text-center mb-8 border-b border-gray-100 dark:border-gray-700 pb-6">
             <h2 className={`text-3xl font-bold text-gray-900 dark:text-white mb-3 ${currentFont}`}>{book.title}</h2>
             <span className="px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-sm font-bold tracking-wide">
              Level {book.level}
            </span>
          </div>

          <div 
            ref={textRef} 
            className={`leading-loose text-gray-800 dark:text-gray-200 ${currentFont} transition-all duration-200`}
            style={{ fontSize: `${fontSize}px` }}
          >
            {paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="mb-8">
                {tokenizeText(paragraph).map((token, index) => {
                  const isWord = /\w/.test(token);
                  const saved = isWord && isSaved(token);
                  return isWord ? (
                    <span
                      key={index}
                      onClick={(e) => handleWordClick(token, e)}
                      className={`cursor-pointer transition-all duration-200 rounded px-1 border-b-2 border-transparent hover:border-brand-300
                        ${saved 
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300' 
                          : 'hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-700'
                        }
                        ${selection?.word === token ? 'bg-brand-200 dark:bg-brand-800 text-brand-900 dark:text-white' : ''}
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
          </div>

          <div className="mt-16 pt-10 border-t-2 border-dashed border-gray-100 dark:border-gray-700 flex flex-col items-center">
             <div className="text-gray-400 mb-4 flex items-center text-sm font-bold uppercase tracking-widest">
                <BookOpen size={16} className="mr-2" />
                End of Chapter
             </div>
             <button
               onClick={() => {
                 onCompleteBook(book.id);
                 onBack();
               }}
               className="group flex items-center px-10 py-5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-green-500/30 transition-all transform hover:scale-105 active:scale-95"
             >
               <CheckCircle className="mr-3 group-hover:rotate-12 transition-transform" size={24} />
               Finish & Mark Complete
             </button>
          </div>
        </div>
      </div>

      {/* Definition Popup */}
      {selection && (
        <>
          <div 
            className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[1px]"
            onClick={() => setSelection(null)}
          />
          <div 
            className="fixed z-40 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ 
              top: Math.min(selection.y, window.innerHeight - 450),
              left: Math.max(16, Math.min(selection.x, window.innerWidth - 336))
            }}
          >
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white capitalize font-serif tracking-tight">{selection.word}</h3>
                  {definition?.phonetic && <span className="text-sm text-gray-500 font-mono tracking-wide">{definition.phonetic}</span>}
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => playAudio(selection.word)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-brand-600 transition-colors">
                    <Volume2 size={22} />
                  </button>
                  <button onClick={() => setSelection(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 transition-colors">
                    <X size={22} />
                  </button>
                </div>
              </div>

              {isLoadingDef ? (
                <div className="py-10 flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="animate-spin text-brand-500 w-10 h-10 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider">Translating...</span>
                </div>
              ) : (
                <div className="space-y-4 mt-2">
                  {definition?.meanings.map((meaning: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white bg-brand-600 px-2 py-1 rounded-md shadow-sm shadow-brand-500/30">
                          {meaning.partOfSpeech}
                        </span>
                        <span className="font-bold text-xl text-gray-900 dark:text-gray-100">
                          {meaning.translation}
                        </span>
                      </div>
                      <p className="text-base text-gray-600 dark:text-gray-300 mb-3 leading-snug">
                        {meaning.definition}
                      </p>
                      <div className="bg-brand-50 dark:bg-brand-900/10 p-3 rounded-xl border border-brand-100 dark:border-brand-900/30 relative">
                        <div className="absolute top-3 left-3 w-1 h-full bg-brand-300/50 rounded-full"></div>
                         <p className="text-sm italic text-gray-600 dark:text-gray-400 pl-2">
                          "{meaning.example}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {!isLoadingDef && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
                {isSaved(selection.word) ? (
                   <div className="w-full py-3 flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-bold shadow-inner">
                     <Star size={20} className="fill-current mr-2" />
                     In Vocabulary
                   </div>
                ) : (
                  <button 
                    onClick={handleSave}
                    className="w-full flex items-center justify-center px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95"
                  >
                    <Star size={20} className="mr-2" />
                    Add to Vocabulary
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BookReader;