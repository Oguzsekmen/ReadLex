import React, { useState, useMemo } from 'react';
import { Book, BookStatus, CEFRLevel, User } from '../types';
import { CheckCircle, Clock, CircleDashed } from 'lucide-react';
import { t } from '../services/i18n';

interface LibraryProps {
  books: Book[];
  progressMap: Record<string, BookStatus>;
  onSelectBook: (b: Book) => void;
  user: User;
}

const Library: React.FC<LibraryProps> = ({ 
  books, 
  progressMap, 
  onSelectBook,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | CEFRLevel>('ALL');

  const filteredBooks = useMemo(() => {
    if (activeTab === 'ALL') return books;
    return books.filter(b => b.level === activeTab);
  }, [books, activeTab]);

  const getStatusBadge = (status?: BookStatus) => {
    switch(status) {
      case 'COMPLETED':
        return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold flex items-center"><CheckCircle size={12} className="mr-1"/> {t('completed', user.languagePreference)}</span>;
      case 'IN_PROGRESS':
        return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold flex items-center"><Clock size={12} className="mr-1"/> {t('continueReading', user.languagePreference)}</span>;
      default:
        return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-md text-xs font-bold flex items-center"><CircleDashed size={12} className="mr-1"/> {t('notStarted', user.languagePreference)}</span>;
    }
  };

  const getCardStyle = (status?: BookStatus) => {
    if (status === 'COMPLETED') return 'border-green-200 ring-2 ring-green-500/20';
    if (status === 'IN_PROGRESS') return 'border-blue-200 ring-2 ring-blue-500/20';
    return 'border-gray-200';
  };

  const tabs: ('ALL' | CEFRLevel)[] = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white">{t('library', user.languagePreference)}</h1>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              activeTab === tab 
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {tab === 'ALL' ? t('all', user.languagePreference) : tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredBooks.map(book => {
          const status = progressMap[book.id] || 'NOT_STARTED';
          return (
            <div key={book.id} className={`bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col ${getCardStyle(status)}`}>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <span className={`absolute top-3 right-3 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md
                  ${book.level.startsWith('A') ? 'bg-green-500/80' : book.level.startsWith('B') ? 'bg-yellow-500/80' : 'bg-red-500/80'}`}>
                  {book.level}
                </span>
                <div className="absolute bottom-3 left-3">
                  {getStatusBadge(status)}
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-bold text-xl mb-1 dark:text-white line-clamp-1">{book.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{book.author}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-6 flex-1 leading-relaxed">{book.excerpt}</p>
                <button 
                  onClick={() => onSelectBook(book)}
                  className={`w-full py-3 rounded-xl font-bold transition-all shadow-md 
                    ${status === 'COMPLETED' 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300' 
                      : status === 'IN_PROGRESS' 
                        ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/20' 
                        : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900'
                    }`}
                >
                  {status === 'COMPLETED' ? t('readAgain', user.languagePreference) : status === 'IN_PROGRESS' ? t('continueReading', user.languagePreference) : t('startReading', user.languagePreference)}
                </button>
              </div>
            </div>
          );
        })}
        
        {filteredBooks.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400">
            No books found for this level.
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;