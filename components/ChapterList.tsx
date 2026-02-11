
import React from 'react';
import { Book, UserBookProgress } from '../types';
import { PlayCircle, CheckCircle, Lock, ArrowLeft, BookOpen, Play } from 'lucide-react';

interface ChapterListProps {
  book: Book;
  progress?: UserBookProgress;
  onSelectChapter: (chapterIndex: number) => void;
  onBack: () => void;
}

const ChapterList: React.FC<ChapterListProps> = ({ book, progress, onSelectChapter, onBack }) => {
  const chapters = book.chapters || [];

  const completedChapters = progress?.currentChapterIndex || 0;
  const totalChapters = chapters.length;
  const percentage = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  // Find the index to "Continue"
  const continueIndex = Math.min(completedChapters, totalChapters - 1);

  return (
    <div className="min-h-screen bg-[#F0F4F8] dark:bg-gray-950 pb-20">
      {/* Header with Cover */}
      <div className="relative h-64 md:h-80 w-full bg-gray-900 overflow-hidden">
        <img src={book.coverUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F0F4F8] dark:from-gray-950 to-transparent" />
        
        <div className="absolute top-0 left-0 p-6 z-20">
           <button onClick={onBack} className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-full text-white transition-all">
             <ArrowLeft size={24} />
           </button>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-20 flex flex-col md:flex-row items-end md:items-center gap-6">
           <img 
              src={book.coverUrl} 
              className="w-32 h-48 object-cover rounded-lg shadow-2xl border-4 border-white dark:border-gray-800 hidden md:block" 
           />
           <div className="flex-1">
             <span className={`px-3 py-1 rounded-md text-xs font-bold text-white mb-2 inline-block
                ${book.level.startsWith('A') ? 'bg-green-500' : book.level.startsWith('B') ? 'bg-yellow-500' : 'bg-red-500'}`}>
                {book.level}
             </span>
             <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white mb-2 leading-tight">{book.title}</h1>
             <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400">
                <BookOpen size={16} className="mr-2" /> {totalChapters} Chapters
                <span className="mx-3">•</span>
                {book.totalWords} Words
             </div>
           </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        <div className="flex flex-col md:flex-row gap-6 mb-8">
           {/* Progress Panel */}
           {progress && progress.status !== 'NOT_STARTED' && totalChapters > 0 && (
              <div className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                 <div className="flex justify-between items-center mb-2">
                    <span className="font-bold dark:text-white">İlerlemen</span>
                    <span className="font-black text-brand-600">{percentage}%</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div className="bg-brand-600 h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                 </div>
              </div>
           )}

           {/* Continue Button */}
           {progress && progress.status === 'IN_PROGRESS' && totalChapters > 0 && (
              <button 
                onClick={() => onSelectChapter(continueIndex)}
                className="bg-brand-600 text-white px-8 py-6 rounded-[2rem] font-black text-lg shadow-xl shadow-brand-500/20 hover:bg-brand-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
              >
                 <Play className="fill-current" /> Kaldığın Yerden Devam Et
              </button>
           )}
        </div>

        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6">Bölümler</h2>

        <div className="space-y-4">
           {chapters.map((chapter, index) => {
              const isCompleted = index < completedChapters;
              const isCurrent = index === completedChapters;
              const canRead = index <= completedChapters || progress?.status === 'COMPLETED';

              return (
                <div 
                   key={chapter.id}
                   onClick={() => canRead && onSelectChapter(index)}
                   className={`group relative bg-white dark:bg-gray-800 p-5 rounded-2xl border transition-all duration-300 flex items-center
                      ${canRead ? 'cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-lg' : 'opacity-60 cursor-not-allowed border-gray-100 dark:border-gray-800'}
                      ${isCurrent ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-100 dark:border-gray-700'}
                   `}
                >
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-5 font-black text-lg shrink-0
                      ${isCompleted ? 'bg-green-100 text-green-600' : isCurrent ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}
                   `}>
                      {isCompleted ? <CheckCircle size={24} /> : index + 1}
                   </div>

                   <div className="flex-1">
                      <h3 className={`font-bold text-lg ${canRead ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                         {chapter.title}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                         {Math.ceil((chapter.content || '').split(' ').length / 150)} min read
                      </p>
                   </div>

                   <div className="ml-4">
                      {canRead ? (
                        <PlayCircle size={28} className={`${isCurrent ? 'text-brand-600' : 'text-gray-300 group-hover:text-brand-500'}`} />
                      ) : (
                        <Lock size={24} className="text-gray-300" />
                      )}
                   </div>
                </div>
              );
           })}

           {chapters.length === 0 && (
             <div className="p-8 text-center text-gray-400 font-bold bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
               No chapters available. Please update the book content.
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ChapterList;
