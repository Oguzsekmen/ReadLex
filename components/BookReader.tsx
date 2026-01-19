import React, { useState, useRef, useEffect } from 'react';
import { Book, VocabularyWord } from '../types';
import { getWordDefinition } from '../services/geminiService';
import { ArrowLeft, Loader2, Star, Volume2, X, CheckCircle, BookOpen } from 'lucide-react';

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

const BookReader: React.FC<BookReaderProps> = ({ book, onBack, onSaveWord, savedWords, onCompleteBook }) => {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [definition, setDefinition] = useState<any>(null);
  const textRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative min-h-[90vh] bg-[#f8f5f2] dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between z-20 shadow-sm">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-brand-600 dark:text-gray-400 font-medium">
          <ArrowLeft className="mr-2" size={20} />
          Back to Library
        </button>
        <div className="text-center">
          <h2 className="font-bold text-gray-900 dark:text-white">{book.title}</h2>
        </div>
        <div className="w-20"></div> 
      </div>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 md:p-16 relative">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-400 to-purple-500 rounded-t-3xl"></div>
          
          <div className="flex items-center justify-center mb-10">
            <span className="px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-sm font-bold tracking-wide">
              Level {book.level}
            </span>
          </div>

          <div 
            ref={textRef} 
            className="text-2xl md:text-3xl leading-loose font-serif text-gray-800 dark:text-gray-200"
          >
            {tokenizeText(book.content).map((token, index) => {
              const isWord = /\w/.test(token);
              const saved = isWord && isSaved(token);
              return isWord ? (
                <span
                  key={index}
                  onClick={(e) => handleWordClick(token, e)}
                  className={`cursor-pointer transition-all duration-200 rounded px-1
                    ${saved 
                      ? 'bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 font-medium' 
                      : 'hover:bg-brand-100 dark:hover:bg-brand-900/50 hover:text-brand-700'
                    }
                    ${selection?.word === token ? 'bg-brand-300 dark:bg-brand-700 text-brand-900' : ''}
                  `}
                >
                  {token}
                </span>
              ) : (
                <span key={index}>{token}</span>
              );
            })}
          </div>

          <div className="mt-16 pt-10 border-t-2 border-dashed border-gray-100 dark:border-gray-700 flex flex-col items-center">
             <div className="text-gray-400 mb-4 flex items-center text-sm">
                <BookOpen size={16} className="mr-2" />
                End of Chapter
             </div>
             <button
               onClick={() => {
                 onCompleteBook(book.id);
                 onBack();
               }}
               className="group flex items-center px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-full font-bold text-lg shadow-lg shadow-green-500/30 transition-all transform hover:scale-105 active:scale-95"
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
            className="fixed inset-0 z-20 bg-transparent"
            onClick={() => setSelection(null)}
          />
          <div 
            className="fixed z-30 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ 
              top: Math.min(selection.y, window.innerHeight - 400),
              left: Math.max(10, Math.min(selection.x, window.innerWidth - 330))
            }}
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white capitalize font-serif">{selection.word}</h3>
                  {definition?.phonetic && <span className="text-sm text-gray-500 font-mono">{definition.phonetic}</span>}
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => playAudio(selection.word)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-brand-600">
                    <Volume2 size={20} />
                  </button>
                  <button onClick={() => setSelection(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {isLoadingDef ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="animate-spin text-brand-500 w-8 h-8" />
                </div>
              ) : (
                <div className="space-y-4 mt-2">
                  {definition?.meanings.map((meaning: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-white bg-brand-600 px-2 py-1 rounded-md">
                          {meaning.partOfSpeech}
                        </span>
                        <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                          {meaning.translation}
                        </span>
                      </div>
                      <p className="text-base text-gray-600 dark:text-gray-300 mb-2 leading-snug">
                        {meaning.definition}
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                        <p className="text-sm italic text-gray-600 dark:text-gray-400">
                          "{meaning.example}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {!isLoadingDef && (
              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
                {isSaved(selection.word) ? (
                   <div className="w-full py-2 flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-bold">
                     <Star size={18} className="fill-current mr-2" />
                     Saved
                   </div>
                ) : (
                  <button 
                    onClick={handleSave}
                    className="w-full flex items-center justify-center px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all shadow-md shadow-brand-500/20"
                  >
                    <Star size={18} className="mr-2" />
                    Add to Favorites
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