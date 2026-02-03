import React, { useState } from 'react';
import { User } from '../types';
import { getUsers, saveUser, getUserByEmail } from '../services/storage';
import { Mail, Lock, User as UserIcon, ArrowRight, BookOpen, Globe } from 'lucide-react';
import { t } from '../services/i18n';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [lang, setLang] = useState<'TR' | 'EN'>('TR'); // Default language

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@') || password.length < 4) {
      setError('Please provide a valid email and a password (min 4 chars).');
      return;
    }

    if (isLogin) {
      // LOGIN LOGIC
      const user = getUserByEmail(email);
      if (user && user.password === password) {
        onLogin(user);
      } else {
        setError('Invalid email or password.');
      }
    } else {
      // REGISTER LOGIC
      const existing = getUserByEmail(email);
      if (existing) {
        setError('This email is already registered.');
        return;
      }

      // NEW USER LOGIC: Start with 'Trailer' plan (3 Days)
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      
      const newUser: User = {
        id: 'u-' + Date.now(),
        email,
        name: name,
        password: password,
        avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${name.replace(/\s/g,'')}`, // Default Avatar
        role: 'USER',
        languagePreference: lang, 
        streak: 0,
        xp: 0,
        dailyGoal: 25, // Start with 25 words goal
        lastVisitDate: Date.now(),
        subscriptionStatus: 'ACTIVE', // Active but with a short expiry (Trailer)
        plan: 'TRAILER', // Special Trailer Plan
        trialEndsAt: Date.now() + THREE_DAYS_MS,
        subscriptionEndsAt: Date.now() + THREE_DAYS_MS
      };

      saveUser(newUser);
      onLogin(newUser);
    }
  };

  const toggleLang = () => {
    setLang(prev => prev === 'TR' ? 'EN' : 'TR');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] dark:bg-gray-900 px-4 font-sans relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-fun-pink/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      
      {/* Language Toggle (Top Right) */}
      <button 
        onClick={toggleLang}
        className="absolute top-6 right-6 z-20 flex items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-md hover:scale-105 transition-transform font-bold text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700"
      >
        <Globe size={18} className="mr-2 text-brand-500" />
        {lang === 'TR' ? 'Türkçe' : 'English'}
      </button>

      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/50 dark:border-gray-700">
        <div className="bg-gradient-to-tr from-brand-600 to-fun-pink p-10 text-center relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
           <div className="flex justify-center mb-4">
             <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
                <BookOpen size={32} strokeWidth={3} />
             </div>
           </div>
           <h1 className="text-4xl font-black text-white mb-2 tracking-tight">ReadLex</h1>
           <p className="text-brand-100 font-bold">{lang === 'TR' ? 'Öğrenme yolculuğuna başla!' : 'Start your learning journey!'}</p>
        </div>
        
        <div className="p-8">
          <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-6 text-center">
            {isLogin 
              ? (lang === 'TR' ? 'Tekrar Hoş Geldin!' : 'Jump Back In!') 
              : (lang === 'TR' ? 'Maceraya Katıl' : 'Join the Adventure')}
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center">
               <span className="mr-2">⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative group">
                <UserIcon className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-brand-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder={lang === 'TR' ? 'Ad Soyad' : 'Full Name'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:border-brand-500 focus:ring-0 outline-none transition-all font-bold"
                  required
                />
              </div>
            )}
            
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-brand-500 transition-colors" size={20} />
              <input
                type="email"
                placeholder={lang === 'TR' ? 'E-posta Adresi' : 'Email Address'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:border-brand-500 focus:ring-0 outline-none transition-all font-bold"
                required
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-brand-500 transition-colors" size={20} />
              <input
                type="password"
                placeholder={lang === 'TR' ? 'Şifre' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:border-brand-500 focus:ring-0 outline-none transition-all font-bold"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-brand-500/30 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center mt-6"
            >
              {isLogin 
                ? (lang === 'TR' ? 'Giriş Yap' : 'Lets Go!') 
                : (lang === 'TR' ? 'Ücretsiz Kayıt Ol (3 Gün Deneme)' : 'Create Account (3-Day Trial)')}
              <ArrowRight size={24} className="ml-2" />
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 font-bold transition-colors"
            >
              {isLogin 
                ? (lang === 'TR' ? "Hesabın yok mu? Kayıt Ol" : "Don't have an account? Sign Up") 
                : (lang === 'TR' ? "Zaten hesabın var mı? Giriş Yap" : "Already have an account? Sign In")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;