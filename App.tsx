import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Profile from './components/Profile';
import { Book, User, VocabularyWord, QuizResult, BookStatus } from './types';
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
import AdminPanel from './components/AdminPanel'; // New
import { Trophy, Flame, Play, Clock, CheckCircle } from 'lucide-react';
import Library from './components/Library';
import Vocabulary from './components/Vocabulary'; // Extracted or inline

// --- Dashboard Component (Translated) ---
const Dashboard = ({ user, vocabCount, onStartQuiz }: { user: User, vocabCount: number, onStartQuiz: () => void }) => {
  const lang = user.languagePreference;
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        <h1 className="text-3xl font-bold mb-2 relative z-10">{t('welcomeBack', lang)}, {user.name}!</h1>
        <p className="text-brand-100 mb-8 relative z-10 text-lg">{t('dayStreak', lang)}: {user.streak}</p>
        
        <div className="flex gap-4 relative z-10">
          <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex items-center min-w-[140px]">
            <Flame className="text-orange-300 mr-3" size={28} />
            <div>
              <div className="text-3xl font-bold">{user.streak}</div>
              <div className="text-sm text-brand-100 font-medium">{t('dayStreak', lang)}</div>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex items-center min-w-[140px]">
            <Trophy className="text-yellow-300 mr-3" size={28} />
            <div>
              <div className="text-3xl font-bold">{user.xp}</div>
              <div className="text-sm text-brand-100 font-medium">{t('totalXp', lang)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">{t('dailyGoal', lang)}</h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">{t('wordsLearned', lang)}</span>
            <span className="font-bold text-xl dark:text-white">12 / 20</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div className="bg-brand-500 h-full rounded-full transition-all duration-1000" style={{ width: '60%' }}></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between group hover:border-brand-200 dark:hover:border-brand-900 transition-colors">
          <div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">{t('quickQuiz', lang)}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('reviewWords', lang)} ({vocabCount})</p>
            {vocabCount < 10 && (
              <p className="text-red-500 text-sm mt-2 font-medium">10+ {t('word', lang).toLowerCase()} needed.</p>
            )}
          </div>
          <button 
            onClick={onStartQuiz}
            className="mt-6 w-full py-4 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-400 font-bold rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            <Play size={20} className="mr-2 fill-current" />
            {t('startSession', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Vocabulary Wrapper (for lazy load) ---
const VocabularyWrapper = ({ user, words, onDelete }: { user: User, words: VocabularyWord[], onDelete: (id: string) => void }) => {
   // Re-using Library's Vocabulary component, but we need to inject the translation capability if we want it perfect.
   // For now, let's just implement the Vocabulary View inline or use the existing one but with a prop?
   // Actually, I'll just import the existing one from 'Vocabulary' component but I need to make sure the existing Vocabulary component
   // is updated to support translations. 
   // Wait, the previous file list didn't include `components/Vocabulary.tsx`. The code was inside App.tsx. 
   // I will use the one defined in the previous App.tsx but simplified here.
   
   // NOTE: In a real refactor, Vocabulary should be its own file. I will inline the component logic here for simplicity,
   // ensuring it uses `t()`.
   
   const [search, setSearch] = useState('');
   const filtered = words.filter(w => 
     w.word.toLowerCase().includes(search.toLowerCase()) || 
     w.translation.toLowerCase().includes(search.toLowerCase())
   );

   const lang = user.languagePreference;

   return (
     <div className="h-full flex flex-col">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
         <h1 className="text-3xl font-bold dark:text-white">{t('myVocabulary', lang)} <span className="text-brand-500 text-lg align-top">{words.length}</span></h1>
         <input 
             type="text" 
             placeholder={t('searchWords', lang)}
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="w-full sm:w-72 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
           />
       </div>

       <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
         <table className="w-full text-left">
           <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm uppercase tracking-wider sticky top-0 z-10">
             <tr>
               <th className="px-6 py-5 font-bold">{t('word', lang)}</th>
               <th className="px-6 py-5 font-bold">{t('translation', lang)}</th>
               <th className="px-6 py-5 font-bold hidden md:table-cell">{t('type', lang)}</th>
               <th className="px-6 py-5 font-bold hidden lg:table-cell">{t('example', lang)}</th>
               <th className="px-6 py-5 font-bold text-right">{t('actions', lang)}</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
             {filtered.map(word => (
               <tr key={word.id} className="hover:bg-brand-50 dark:hover:bg-gray-700/30 transition-colors">
                 <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-lg">{word.word}</td>
                 <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">{word.translation}</td>
                 <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">{word.type}</td>
                 <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm italic hidden lg:table-cell truncate max-w-xs">"{word.exampleSentence}"</td>
                 <td className="px-6 py-4 text-right">
                   <button onClick={() => onDelete(word.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all">
                      🗑
                   </button>
                 </td>
               </tr>
             ))}
             {filtered.length === 0 && (
               <tr><td colSpan={5} className="text-center py-20 text-gray-500">{t('noWords', lang)}</td></tr>
             )}
           </tbody>
         </table>
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

  // Dynamic Data loaded from Storage
  const [books, setBooks] = useState<Book[]>([]);
  const [savedWords, setSavedWords] = useState<VocabularyWord[]>([]);
  const [bookProgress, setBookProgress] = useState<Record<string, BookStatus>>({});

  // Initialization
  useEffect(() => {
    initStorage();
  }, []);

  // Theme effect
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // Load User Data when User changes
  useEffect(() => {
    if (user) {
      setBooks(getBooks()); // Always refresh books (in case admin updated them)
      setSavedWords(getUserVocab(user.id));
      setBookProgress(getUserProgress(user.id));
    }
  }, [user, currentPage]); // Reload when page changes (e.g. back from admin)

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setActiveBook(null);
    setCurrentPage('dashboard');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    saveUser(updatedUser); // Persist
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

  if (!isAuthenticated || !user) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
         <Auth onLogin={handleLogin} />
      </div>
    );
  }

  // Render Logic
  const renderContent = () => {
    // 1. Quiz Mode
    if (isQuizActive) {
      return (
        <div className="h-full flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold dark:text-white flex items-center">
              <Clock className="mr-3 text-brand-500" /> Practice Session
            </h2>
            <button onClick={() => setIsQuizActive(false)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-white text-gray-600 font-medium transition-colors">
              Exit
            </button>
          </div>
          <div className="w-full">
            <QuizEngine words={savedWords} onComplete={handleQuizComplete} onExit={() => setIsQuizActive(false)} />
          </div>
        </div>
      );
    }

    // 2. Reading Mode
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

    // 3. Page Routing
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard user={user} vocabCount={savedWords.length} onStartQuiz={handleStartQuiz} />;
      case 'library':
        return <Library books={books} progressMap={bookProgress} onSelectBook={handleStartBook} user={user} />;
      case 'vocabulary':
        return <VocabularyWrapper user={user} words={savedWords} onDelete={handleDeleteWord} />;
      case 'profile':
        return <Profile user={user} onUpdate={handleUpdateUser} />;
      case 'admin':
        if (user.role !== 'ADMIN') return <div className="p-10 text-center text-red-500">Access Denied</div>;
        return <AdminPanel currentUser={user} />;
      default:
        return <Dashboard user={user} vocabCount={savedWords.length} onStartQuiz={handleStartQuiz} />;
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