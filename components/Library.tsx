
import React, { useState, useMemo } from 'react';
import { Book, BookStatus, CEFRLevel, User, PlanType, UserBookProgress } from '../types';
import { CheckCircle, Clock, CircleDashed, Lock, Sparkles } from 'lucide-react';
import { t } from '../services/i18n';

interface LibraryProps {
  books: Book[];
  progressMap: Record<string, UserBookProgress>;
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
    // 1. Filter out archived books (users shouldn't see them)
    let visibleBooks = books.filter(b => !b.archived);

    // 2. Filter by Level Tab
    if (activeTab === 'ALL') return visibleBooks;
    return visibleBooks.filter(b => b.level === activeTab);
  }, [books, activeTab]);

  const canAccessBook = (bookPlans: PlanType[]): boolean => {
    // 1. "FREE" planındaki kitaplar HERKESE açıktır.
    // Kullanıcının planı ne olursa olsun (Expired, Trial, Monthly vb.) erişebilir.
    if (bookPlans.includes('FREE')) return true;

    const isTrial = user.subscriptionStatus === 'TRIAL';
    const isExpired = user.subscriptionStatus === 'EXPIRED';

    // 2. Trial allows everything
    if (isTrial) return true;

    // 3. Expired users act like Free users (or restricted to Free content)
    // Yukarıdaki 1. kural zaten FREE kontrolünü yaptığı için buraya düşen expired kullanıcılar reddedilir.
    if (isExpired) {
        return false;
    }

    // 4. Active users: Check if their plan is in the list
    return bookPlans.includes(user.plan);
  };

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
          const progress = progressMap[book.id];
          const status = progress?.status || 'NOT_STARTED';
          const isLocked = !canAccessBook(book.requiredPlan);

          return (
            <div key={book.id} className={`bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border shadow-sm transition-all duration-300 group flex flex-col relative ${getCardStyle(status)} ${isLocked ? 'opacity-80' : 'hover:shadow-xl'}`}>
              
              {/* Lock Overlay */}
              {isLocked && (
                <div className="absolute inset-0 z-20 bg-gray-900/10 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4">
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-full shadow-2xl mb-3">
                    <Lock size={32} className="text-gray-400" />
                  </div>
                  <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-lg">
                    <p className="font-bold text-gray-800 dark:text-white text-sm">
                      {user.subscriptionStatus === 'EXPIRED' ? 'Subscription Expired' : 'Premium Access Required'}
                    </p>
                  </div>
                </div>
              )}

              <div className="h-48 bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <span className={`absolute top-3 right-3 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md
                  ${book.level.startsWith('A') ? 'bg-green-500/80' : book.level.startsWith('B') ? 'bg-yellow-500/80' : 'bg-red-500/80'}`}>
                  {book.level}
                </span>
                <div className="absolute bottom-3 left-3">
                  {getStatusBadge(status)}
                </div>
                {/* Only show Premium badge if it's NOT a purely free book */}
                {!(book.requiredPlan.includes('FREE')) && (
                  <div className="absolute top-3 left-3">
                     <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center shadow-lg">
                       <Sparkles size={10} className="mr-1" /> PREMIUM
                     </span>
                  </div>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-bold text-xl mb-1 dark:text-white line-clamp-1">{book.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{book.author}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-6 flex-1 leading-relaxed">{book.excerpt}</p>
                <button 
                  onClick={() => !isLocked && onSelectBook(book)}
                  disabled={isLocked}
                  className={`w-full py-3 rounded-xl font-bold transition-all shadow-md 
                    ${isLocked 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                      : status === 'COMPLETED' 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300' 
                        : status === 'IN_PROGRESS' 
                          ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/20' 
                          : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900'
                    }`}
                >
                  {isLocked ? 'Locked' : status === 'COMPLETED' ? t('readAgain', user.languagePreference) : status === 'IN_PROGRESS' ? t('continueReading', user.languagePreference) : t('startReading', user.languagePreference)}
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
