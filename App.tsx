import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Profile from './components/Profile';
import Pricing from './components/Pricing'; // New
import { Book, User, VocabularyWord, QuizResult, BookStatus, PlanType } from './types';
import { 
  initStorage, 
  getBooks, 
  getUserVocab, 
  saveUserVocab, 
  getUserProgress, 
  saveUserProgress, 
  saveUser 
} from './services/storage';
import { t } from './services/i18n';
import BookReader from './components/BookReader';
import QuizEngine from './components/QuizEngine';
import AdminPanel from './components/AdminPanel'; 
import { Trophy, Flame, Play, Clock, CheckCircle, Crown, Lock } from 'lucide-react';
import Library from './components/Library';

// --- Vocabulary Wrapper ---
const VocabularyWrapper = ({ user, words, onDelete }: { user: User, words: VocabularyWord[], onDelete: (id: string) => void }) => {
   const [search, setSearch] = useState('');
   const filtered = words.filter(w => 
     w.word.toLowerCase().includes(search.toLowerCase()) || 
     w.translation.toLowerCase().includes(search.toLowerCase())
   );

   const lang = user.languagePreference;

   return (
     <div className="h-full flex flex-col">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
         <h1 className="text-3xl font-black dark:text-white tracking-tight">{t('myVocabulary', lang)} <span className="text-brand-500 text-lg align-top bg-brand-100 px-2 py-1 rounded-lg ml-2">{words.length}</span></h1>
         <input 
             type="text" 
             placeholder={t('searchWords', lang)}
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="w-full sm:w-72 px-5 py-3 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-brand-500 outline-none shadow-sm font-bold"
           />
       </div>

       <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-2">
         <table className="w-full text-left border-collapse">
           <thead className="bg-brand-50 dark:bg-gray-900/50 text-brand-700 dark:text-gray-400 text-sm uppercase tracking-wider sticky top-0 z-10">
             <tr>
               <th className="px-6 py-5 font-black rounded-tl-2xl">{t('word', lang)}</th>
               <th className="px-6 py-5 font-black">{t('translation', lang)}</th>
               <th className="px-6 py-5 font-black hidden md:table-cell">{t('type', lang)}</th>
               <th className="px-6 py-5 font-black hidden lg:table-cell">{t('example', lang)}</th>
               <th className="px-6 py-5 font-black text-right rounded-tr-2xl">{t('actions', lang)}</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
             {filtered.map(word => (
               <tr key={word.id} className="hover:bg-brand-50 dark:hover:bg-gray-700/30 transition-colors group">
                 <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-lg">{word.word}</td>
                 <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">{word.translation}</td>
                 <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell font-medium">{word.type}</td>
                 <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm italic hidden lg:table-cell truncate max-w-xs">"{word.exampleSentence}"</td>
                 <td className="px-6 py-4 text-right">
                   <button onClick={() => onDelete(word.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all">
                      🗑
                   </button>
                 </td>
               </tr>
             ))}
             {filtered.length === 0 && (
               <tr><td colSpan={5} className="text-center py-20 text-gray-400 font-bold">{t('noWords', lang)}</td></tr>
             )}
           </tbody>
         </table>
       </div>
     </div>
   );
};

// --- Dashboard Component ---
const Dashboard = ({ user, vocabCount, onStartQuiz, onUpgradeClick }: { user: User, vocabCount: number, onStartQuiz: () => void, onUpgradeClick: () => void }) => {
  const lang = user.languagePreference;
  const isTrial = user.subscriptionStatus === 'TRIAL';
  const daysLeft = Math.ceil((user.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-600 via-violet-600 to-fun-pink rounded-[2.5rem] p-10 text-white shadow-2xl shadow-brand-500/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-400/20 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
             <h1 className="text-4xl md:text-5xl font-black mb-3 drop-shadow-sm">{t('welcomeBack', lang)}, {user.name}!</h1>
             <p className="text-brand-100 text-xl font-medium flex items-center">
               {isTrial ? (
                 <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-bold mr-3 flex items-center">
                    <Clock size={16} className="mr-2" /> {daysLeft} Days left in Trial
                 </span>
               ) : (
                 <span className="bg-yellow-400/20 text-yellow-200 px-3 py-1 rounded-lg text-sm font-bold mr-3 flex items-center">
                    <Crown size={16} className="mr-2" /> PRO Member
                 </span>
               )}
             </p>
          </div>
          
          {/* Stats Pills */}
          <div className="flex gap-4">
            <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex items-center min-w-[140px] transform hover:scale-105 transition-transform">
              <div className="w-10 h-10 bg-orange-400 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                 <Flame className="text-white fill-white" size={24} />
              </div>
              <div>
                <div className="text-3xl font-black">{user.streak}</div>
                <div className="text-xs text-brand-100 font-bold uppercase tracking-wider">{t('dayStreak', lang)}</div>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex items-center min-w-[140px] transform hover:scale-105 transition-transform">
               <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                 <Trophy className="text-white fill-white" size={24} />
              </div>
              <div>
                <div className="text-3xl font-black">{user.xp}</div>
                <div className="text-xs text-brand-100 font-bold uppercase tracking-wider">{t('totalXp', lang)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isTrial && daysLeft <= 1 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl flex items-center justify-between animate-pulse">
           <div>
             <h3 className="text-red-700 font-bold text-lg">Trial Expiring Soon!</h3>
             <p className="text-red-600">Upgrade now to keep your progress and streak safe.</p>
           </div>
           <button onClick={onUpgradeClick} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Upgrade</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border-2 border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300">
          <h2 className="text-2xl font-black mb-6 dark:text-white flex items-center">
             <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center mr-3">
               <CheckCircle size={20} />
             </div>
             {t('dailyGoal', lang)}
          </h2>
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase text-sm tracking-wide">{t('wordsLearned', lang)}</span>
            <span className="font-black text-2xl dark:text-white text-green-500">12 <span className="text-gray-300 text-lg">/ 20</span></span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden p-1">
            <div className="bg-green-500 h-full rounded-full transition-all duration-1000 shadow-sm" style={{ width: '60%' }}></div>
          </div>
          <p className="mt-4 text-gray-400 text-sm">Keep going! You're almost there.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border-2 border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-brand-200 dark:hover:border-brand-900 transition-all duration-300 flex flex-col justify-between group">
          <div>
            <h2 className="text-2xl font-black mb-2 dark:text-white flex items-center">
              <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center mr-3">
                 <Clock size={20} />
              </div>
              {t('quickQuiz', lang)}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">{t('reviewWords', lang)} ({vocabCount})</p>
            {vocabCount < 5 && (
              <p className="text-red-500 text-sm mt-3 font-bold bg-red-50 inline-block px-3 py-1 rounded-lg">Need 5+ words to start</p>
            )}
          </div>
          <button 
            onClick={onStartQuiz}
            disabled={vocabCount < 5}
            className="mt-6 w-full py-4 bg-brand-600 text-white font-black rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-brand-500/20 hover:bg-brand-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none text-lg"
          >
            <Play size={24} className="mr-2 fill-current" />
            {t('startSession', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(false);

  // Dynamic Data
  const [books, setBooks] = useState<Book[]>([]);
  const [savedWords, setSavedWords] = useState<VocabularyWord[]>([]);
  const [bookProgress, setBookProgress] = useState<Record<string, BookStatus>>({});

  // Initialization
  useEffect(() => {
    initStorage();
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // Subscription Check
  useEffect(() => {
    if (user && user.subscriptionStatus === 'TRIAL') {
      if (Date.now() > user.trialEndsAt) {
         // Trial Expired
         setUser(u => u ? ({ ...u, subscriptionStatus: 'EXPIRED' }) : null);
      }
    }
  }, [user]);

  // Load User Data
  useEffect(() => {
    if (user) {
      setBooks(getBooks()); 
      setSavedWords(getUserVocab(user.id));
      setBookProgress(getUserProgress(user.id));
    }
  }, [user, currentPage]); 

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    // Redirect to pricing if expired immediately
    if (loggedInUser.subscriptionStatus === 'EXPIRED') {
      setCurrentPage('pricing');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setActiveBook(null);
    setCurrentPage('dashboard');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    saveUser(updatedUser); 
  };
  
  const handleToggleLanguage = () => {
    if (!user) return;
    const newUser = { 
      ...user, 
      languagePreference: user.languagePreference === 'TR' ? 'EN' : 'TR' as 'EN' | 'TR'
    };
    handleUpdateUser(newUser);
  };

  const handleSaveWord = (word: VocabularyWord) => {
    if (!user) return;
    const newWords = [word, ...savedWords];
    setSavedWords(newWords);
    saveUserVocab(user.id, newWords);
  };

  const handleDeleteWord = (id: string) => {
    if (!user) return;
    const newWords = savedWords.filter(w => w.id !== id);
    setSavedWords(newWords);
    saveUserVocab(user.id, newWords);
  };

  const handleStartBook = (book: Book) => {
    if (!user) return;
    setActiveBook(book);
    if (!bookProgress[book.id] || bookProgress[book.id] === 'NOT_STARTED') {
      const newProgress = { ...bookProgress, [book.id]: 'IN_PROGRESS' as BookStatus };
      setBookProgress(newProgress);
      saveUserProgress(user.id, newProgress);
    }
  };

  const handleCompleteBook = (bookId: string) => {
    if (!user) return;
    const newProgress = { ...bookProgress, [bookId]: 'COMPLETED' as BookStatus };
    setBookProgress(newProgress);
    saveUserProgress(user.id, newProgress);
  };

  const handleStartQuiz = () => {
    if (savedWords.length < 5) {
      alert("You need at least 5 words to start a quiz.");
      return;
    }
    setIsQuizActive(true);
  };

  const handleQuizComplete = (result: QuizResult) => {
    if (!user) return;
    const newXp = user.xp + (result.score * 10);
    const updatedUser = { ...user, xp: newXp };
    setUser(updatedUser);
    saveUser(updatedUser);
    setIsQuizActive(false);
  };

  const handleUpgrade = (plan: PlanType) => {
    if(!user) return;
    // Upgrade Logic
    const updatedUser: User = {
      ...user,
      subscriptionStatus: 'ACTIVE',
      plan: plan,
      subscriptionEndsAt: Date.now() + (plan === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000
    };
    handleUpdateUser(updatedUser);
    setCurrentPage('dashboard');
    alert("Payment Successful! Welcome to ReadLex PRO.");
  };

  if (!isAuthenticated || !user) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
         <Auth onLogin={handleLogin} />
      </div>
    );
  }

  // Force Pricing if Expired
  if (user.subscriptionStatus === 'EXPIRED' && currentPage !== 'pricing') {
    return (
      <Layout 
        activePage="pricing" 
        onNavigate={() => {}} 
        isDarkMode={isDarkMode} 
        toggleTheme={() => setIsDarkMode(!isDarkMode)} 
        currentUser={user} 
        onToggleLang={() => {}} 
        onLogout={handleLogout}
      >
        <Pricing user={user} onUpgrade={handleUpgrade} />
      </Layout>
    );
  }

  // Render Logic
  const renderContent = () => {
    if (isQuizActive) {
      return (
        <div className="h-full flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-black dark:text-white flex items-center">
              <Clock className="mr-3 text-brand-500" /> Practice Session
            </h2>
            <button onClick={() => setIsQuizActive(false)} className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:text-white text-gray-700 font-bold transition-colors">
              Exit
            </button>
          </div>
          <div className="w-full">
            <QuizEngine words={savedWords} onComplete={handleQuizComplete} onExit={() => setIsQuizActive(false)} />
          </div>
        </div>
      );
    }

    if (activeBook) {
      return (
        <BookReader 
          book={activeBook} 
          onBack={() => setActiveBook(null)} 
          onSaveWord={handleSaveWord}
          savedWords={savedWords}
          onCompleteBook={handleCompleteBook}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard user={user} vocabCount={savedWords.length} onStartQuiz={handleStartQuiz} onUpgradeClick={() => setCurrentPage('pricing')} />;
      case 'library':
        return <Library books={books} progressMap={bookProgress} onSelectBook={handleStartBook} user={user} />;
      case 'vocabulary':
        return <VocabularyWrapper user={user} words={savedWords} onDelete={handleDeleteWord} />;
      case 'profile':
        return <Profile user={user} onUpdate={handleUpdateUser} />;
      case 'pricing':
        return <Pricing user={user} onUpgrade={handleUpgrade} />;
      case 'admin':
        if (user.role !== 'ADMIN') return <div className="p-10 text-center text-red-500 font-bold text-2xl">Access Denied</div>;
        return <AdminPanel currentUser={user} />;
      default:
        return <Dashboard user={user} vocabCount={savedWords.length} onStartQuiz={handleStartQuiz} onUpgradeClick={() => setCurrentPage('pricing')} />;
    }
  };

  return (
    <Layout 
      activePage={currentPage} 
      onNavigate={(p) => {
        setCurrentPage(p);
        setActiveBook(null);
        setIsQuizActive(false);
      }}
      isDarkMode={isDarkMode}
      toggleTheme={() => setIsDarkMode(!isDarkMode)}
      currentUser={user}
      onToggleLang={handleToggleLanguage}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;