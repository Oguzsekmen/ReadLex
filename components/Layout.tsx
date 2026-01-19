import React, { useState } from 'react';
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, Menu, User, X, Moon, Sun, Globe, Shield, Sparkles, Crown } from 'lucide-react';
import { t } from '../services/i18n';
import { User as UserType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  currentUser: UserType;
  onToggleLang: () => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activePage, 
  onNavigate, 
  isDarkMode, 
  toggleTheme,
  currentUser,
  onToggleLang,
  onLogout
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const lang = currentUser.languagePreference;

  const NavItem = ({ page, icon: Icon, label, extraClass = "" }: { page: string; icon: any; label: string, extraClass?: string }) => {
    const isActive = activePage === page || (activePage.startsWith(page) && page !== 'dashboard');
    return (
      <button
        onClick={() => {
          onNavigate(page);
          setIsMobileMenuOpen(false);
        }}
        className={`group flex items-center w-full px-5 py-4 text-base font-bold transition-all rounded-2xl mb-2 hover:scale-105 active:scale-95 ${
          isActive
            ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30'
            : 'text-gray-600 hover:bg-white hover:shadow-md dark:text-gray-400 dark:hover:bg-gray-800'
        } ${extraClass}`}
      >
        <Icon size={24} className={`mr-3 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-brand-500'}`} />
        {label}
      </button>
    );
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''} bg-[#F0F4F8] dark:bg-gray-950 font-sans`}>
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[#F8FAFC] dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col p-4">
          <div className="p-4 flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
              <div className="w-10 h-10 bg-gradient-to-tr from-brand-500 to-fun-pink rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/30 transform -rotate-6">
                <BookOpen size={24} strokeWidth={3} />
              </div>
              <span className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Read<span className="text-brand-600">Lex</span></span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 bg-white p-2 rounded-xl shadow-sm">
              <X size={24} />
            </button>
          </div>

          <div className="px-2 mb-6">
             {currentUser.subscriptionStatus === 'TRIAL' && (
                <div className="bg-gradient-to-br from-orange-400 to-fun-pink p-4 rounded-2xl text-white shadow-lg relative overflow-hidden group cursor-pointer" onClick={() => onNavigate('pricing')}>
                   <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-xs bg-white/20 px-2 py-1 rounded-lg">FREE TRIAL</span>
                        <Crown size={20} className="fill-yellow-300 text-yellow-300 animate-pulse" />
                      </div>
                      <p className="font-bold text-sm leading-tight">Upgrade to keep learning!</p>
                   </div>
                   <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                </div>
             )}
          </div>

          <nav className="flex-1 space-y-1">
            <NavItem page="dashboard" icon={LayoutDashboard} label={t('dashboard', lang)} />
            <NavItem page="library" icon={BookOpen} label={t('library', lang)} />
            <NavItem page="vocabulary" icon={GraduationCap} label={t('vocabulary', lang)} />
            <NavItem page="profile" icon={User} label={t('profile', lang)} />
            
            {currentUser.role === 'ADMIN' && (
               <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <p className="px-5 text-xs font-extrabold text-gray-400 uppercase mb-3 tracking-wider">Admin Zone</p>
                  <NavItem page="admin" icon={Shield} label={t('adminPanel', lang)} extraClass="!bg-gray-800 !text-white hover:!bg-gray-700" />
               </div>
            )}
          </nav>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex gap-2">
              <button 
                onClick={onToggleLang}
                className="flex-1 flex items-center justify-center py-3 text-sm font-bold bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-brand-50 hover:text-brand-600 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-all"
              >
                <Globe size={18} className="mr-2" />
                {lang}
              </button>

              <button 
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center py-3 text-sm font-bold bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-brand-50 hover:text-brand-600 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-all"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            <button 
              onClick={onLogout}
              className="flex items-center w-full px-5 py-3 text-sm font-bold text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            >
              <LogOut size={20} className="mr-3" />
              {t('signOut', lang)}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto h-screen relative">
        <header className="lg:hidden bg-[#F8FAFC]/90 backdrop-blur-md dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
            <span className="font-extrabold text-gray-900 dark:text-white">ReadLex</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-500 bg-white p-2 rounded-lg shadow-sm">
            <Menu size={24} />
          </button>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;