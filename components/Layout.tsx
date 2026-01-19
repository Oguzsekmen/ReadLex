import React, { useState } from 'react';
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, Menu, User, X, Moon, Sun, Globe, Shield } from 'lucide-react';
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

  const NavItem = ({ page, icon: Icon, label }: { page: string; icon: any; label: string }) => {
    const isActive = activePage === page || (activePage.startsWith(page) && page !== 'dashboard');
    return (
      <button
        onClick={() => {
          onNavigate(page);
          setIsMobileMenuOpen(false);
        }}
        className={`flex items-center w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1 ${
          isActive
            ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
        }`}
      >
        <Icon size={20} className="mr-3" />
        {label}
      </button>
    );
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                L
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">LexiFlow</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-gray-500">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-4">
            <NavItem page="dashboard" icon={LayoutDashboard} label={t('dashboard', lang)} />
            <NavItem page="library" icon={BookOpen} label={t('library', lang)} />
            <NavItem page="vocabulary" icon={GraduationCap} label={t('vocabulary', lang)} />
            <NavItem page="profile" icon={User} label={t('profile', lang)} />
            
            {currentUser.role === 'ADMIN' && (
               <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="px-4 text-xs font-bold text-gray-400 uppercase mb-2">Admin</p>
                  <NavItem page="admin" icon={Shield} label={t('adminPanel', lang)} />
               </div>
            )}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
            <button 
              onClick={onToggleLang}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg"
            >
              <Globe size={20} className="mr-3" />
              {lang === 'TR' ? 'English' : 'Türkçe'}
            </button>

            <button 
              onClick={toggleTheme}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg"
            >
              {isDarkMode ? <Sun size={20} className="mr-3" /> : <Moon size={20} className="mr-3" />}
              {isDarkMode ? t('lightMode', lang) : t('darkMode', lang)}
            </button>

            <button 
              onClick={onLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg"
            >
              <LogOut size={20} className="mr-3" />
              {t('signOut', lang)}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950 overflow-y-auto h-screen">
        <header className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
            <span className="font-bold text-gray-900 dark:text-white">LexiFlow</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-500">
            <Menu size={24} />
          </button>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;